-- =====================================================================
-- Corrige os "Destaques" da home do grupo (líder individual e melhor
-- dupla): eles ignoravam a regra de elegibilidade do ranking oficial
-- (groups.min_attendance_percent), então uma dupla com 1 jogo e 100%
-- de aproveitamento aparecia como "Melhor dupla" mesmo sem presença
-- suficiente. stats_players já calculava attendance_percent/
-- meets_min_attendance (20260701000900_ranking_min_attendance_percent.sql)
-- — esta migration estende o mesmo cálculo (jogos da dupla / total de
-- partidas do grupo) para stats_pairs, para que o front (app/[groupSlug]/
-- page.tsx) possa filtrar por row.meets_min_attendance igual já faz na
-- tela de Ranking completo para jogadores.
--
-- p_min_attendance_percent tem default 0, então a aba "Duplas" da tela
-- de Estatísticas (que usa um filtro manual de mínimo de jogos, não o
-- percentual de presença) continua se comportando exatamente igual.
-- =====================================================================

drop function if exists public.stats_pairs(uuid, timestamptz, timestamptz, uuid, uuid, integer);

create or replace function public.stats_pairs(
  p_group_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_session_id uuid default null,
  p_player_id uuid default null,
  p_min_games integer default 1,
  p_min_attendance_percent numeric default 0
)
returns table (
  rank_position bigint,
  pair_key text,
  player_ids uuid[],
  player_names text[],
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
    select ms.*
    from public.v_match_sides ms
    where ms.group_id = p_group_id
      and (p_from is null or ms.played_at >= p_from)
      and (p_to is null or ms.played_at < p_to)
      and (p_session_id is null or ms.session_id = p_session_id)
      and (
        p_player_id is null
        or exists (
          select 1 from public.v_match_participants f
          where f.match_id = ms.match_id and f.player_id = p_player_id
        )
      )
  ),
  total as (
    select count(distinct s.match_id)::bigint as total_matches from scoped s
  ),
  agg as (
    select
      s.player_low,
      s.player_high,
      count(*)::bigint as games,
      count(*) filter (where s.won)::bigint as wins,
      count(*) filter (where not s.won)::bigint as losses
    from scoped s
    group by s.player_low, s.player_high
  ),
  labelled as (
    select
      a.player_low::text || ':' || a.player_high::text as pair_key,
      d.ids as player_ids,
      d.names as player_names,
      a.games,
      a.wins,
      a.losses,
      (a.wins::numeric / a.games) as win_rate,
      d.names[1] as first_name,
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
    -- A ordem de exibição segue sort_order; a identidade da dupla, não.
    cross join lateral (
      select
        array_agg(p.id order by p.sort_order, p.display_name, p.id) as ids,
        array_agg(p.display_name order by p.sort_order, p.display_name, p.id) as names
      from public.players p
      where p.id in (a.player_low, a.player_high)
    ) d
    cross join total t
    where a.games >= greatest(coalesce(p_min_games, 1), 1)
  )
  select
    row_number() over (
      partition by l.meets_min_attendance
      order by l.win_rate desc, l.games desc, l.wins desc, l.first_name asc, l.pair_key asc
    ) as rank_position,
    l.pair_key,
    l.player_ids,
    l.player_names,
    l.games,
    l.wins,
    l.losses,
    l.win_rate,
    l.total_group_matches,
    l.attendance_percent,
    l.meets_min_attendance
  from labelled l
  order by l.meets_min_attendance desc, l.win_rate desc, l.games desc, l.wins desc, l.first_name asc, l.pair_key asc;
$$;

revoke execute on function public.stats_pairs(uuid, timestamptz, timestamptz, uuid, uuid, integer, numeric) from public;
grant execute on function public.stats_pairs(uuid, timestamptz, timestamptz, uuid, uuid, integer, numeric) to authenticated;
