-- =====================================================================
-- 09 — Critério de ranking por percentual de presença.
--
-- O corte de "quem entra no ranking oficial" deixa de ser um número
-- absoluto de jogos (ranking_min_games) e passa a ser um percentual de
-- presença: jogos do jogador dividido pelo total de partidas válidas do
-- grupo no período. O cálculo continua 100% no Postgres — stats_players
-- já devolve o percentual e o boolean de elegibilidade prontos, o front
-- só particiona a lista.
-- =====================================================================

alter table public.groups
  add column if not exists min_attendance_percent numeric not null default 0;

alter table public.groups
  add constraint groups_min_attendance_percent_range
    check (min_attendance_percent >= 0 and min_attendance_percent <= 100);

alter table public.groups
  drop column if exists ranking_min_games;

-- create_group_with_owner perde p_ranking_min_games — a coluna não existe
-- mais, então a função precisa ser recriada com assinatura menor.
drop function if exists public.create_group_with_owner(text, text, text, integer);
drop function if exists public.create_group_with_owner(text, text, text, integer, text);

create or replace function public.create_group_with_owner(
  p_name text,
  p_slug text default null,
  p_timezone text default 'America/Sao_Paulo',
  p_city text default null
)
returns public.groups
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_base text;
  v_slug text;
  v_try integer := 0;
  v_group public.groups;
begin
  if v_uid is null then
    raise exception 'É preciso estar autenticado para criar um grupo.'
      using errcode = '42501', hint = 'FTV_UNAUTHENTICATED';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Informe o nome do grupo.'
      using errcode = 'check_violation', hint = 'FTV_INVALID_NAME';
  end if;

  v_base := coalesce(public.slugify(p_slug), public.slugify(p_name), 'grupo');
  v_slug := v_base;
  loop
    exit when not exists (select 1 from public.groups g where g.slug = v_slug);
    v_try := v_try + 1;
    v_slug := v_base || '-' || v_try::text;
    if v_try > 200 then
      raise exception 'Não foi possível gerar um endereço único para o grupo.'
        using errcode = 'check_violation', hint = 'FTV_SLUG_EXHAUSTED';
    end if;
  end loop;

  insert into public.groups (name, slug, timezone, city, created_by)
  values (btrim(p_name), v_slug, coalesce(nullif(btrim(p_timezone), ''), 'America/Sao_Paulo'),
          nullif(btrim(p_city), ''), v_uid)
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, v_uid, 'owner');

  perform public.write_audit(v_group.id, 'group', v_group.id, 'create', null, to_jsonb(v_group));

  return v_group;
end;
$$;

revoke execute on function public.create_group_with_owner(text, text, text, text) from public;
grant execute on function public.create_group_with_owner(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- stats_players: troca o filtro por número mínimo de jogos (p_min_games)
-- por percentual mínimo de presença (p_min_attendance_percent). A função
-- devolve todo mundo que jogou ao menos 1 partida no período — quem entra
-- no ranking oficial (meets_min_attendance) vira o particionamento visual
-- entre "ranking principal" e "aspirantes" no front, sem recalcular nada.
-- ---------------------------------------------------------------------
drop function if exists public.stats_players(uuid, timestamptz, timestamptz, uuid, uuid, integer);

create or replace function public.stats_players(
  p_group_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_session_id uuid default null,
  p_player_id uuid default null,
  p_min_attendance_percent numeric default 0
)
returns table (
  "position" bigint,
  player_id uuid,
  display_name text,
  avatar_url text,
  sort_order integer,
  active boolean,
  is_guest boolean,
  games bigint,
  wins bigint,
  losses bigint,
  win_rate numeric,
  total_group_matches bigint,
  attendance_percent numeric,
  meets_min_attendance boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with scoped as (
    select vp.*
    from public.v_match_participants vp
    where vp.group_id = p_group_id
      and (p_from is null or vp.played_at >= p_from)
      and (p_to is null or vp.played_at < p_to)
      and (p_session_id is null or vp.session_id = p_session_id)
      -- Filtrar por jogador significa "somente as partidas dele".
      and (
        p_player_id is null
        or exists (
          select 1 from public.v_match_participants f
          where f.match_id = vp.match_id and f.player_id = p_player_id
        )
      )
  ),
  total as (
    select count(distinct s.match_id)::bigint as total_matches from scoped s
  ),
  agg as (
    select
      s.player_id,
      count(*)::bigint as games,
      count(*) filter (where s.won)::bigint as wins,
      count(*) filter (where not s.won)::bigint as losses
    from scoped s
    group by s.player_id
  ),
  enriched as (
    select
      a.player_id,
      p.display_name,
      p.avatar_url,
      p.sort_order,
      p.active,
      p.is_guest,
      a.games,
      a.wins,
      a.losses,
      (a.wins::numeric / a.games) as win_rate,
      t.total_matches as total_group_matches,
      case
        when t.total_matches > 0 then (a.games::numeric / t.total_matches) * 100
        else 0
      end as attendance_percent,
      (
        t.total_matches > 0
        and (a.games::numeric / t.total_matches) * 100
          >= greatest(coalesce(p_min_attendance_percent, 0), 0)
      ) as meets_min_attendance
    from agg a
    join public.players p on p.id = a.player_id
    cross join total t
  )
  select
    row_number() over (
      partition by e.meets_min_attendance
      order by e.win_rate desc, e.games desc, e.wins desc, e.display_name asc
    ) as "position",
    e.player_id,
    e.display_name,
    e.avatar_url,
    e.sort_order,
    e.active,
    e.is_guest,
    e.games,
    e.wins,
    e.losses,
    e.win_rate,
    e.total_group_matches,
    e.attendance_percent,
    e.meets_min_attendance
  from enriched e
  order by e.meets_min_attendance desc, e.win_rate desc, e.games desc, e.wins desc, e.display_name asc;
$$;

revoke execute on function public.stats_players(uuid, timestamptz, timestamptz, uuid, uuid, numeric) from public;
grant execute on function public.stats_players(uuid, timestamptz, timestamptz, uuid, uuid, numeric) to authenticated;
