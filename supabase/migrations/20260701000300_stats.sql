-- =====================================================================
-- 04 — Camada de estatísticas.
--
-- Tudo é calculado no Postgres a partir de IDs de jogador. Nome nunca
-- entra em cálculo — só em exibição. Só entram partidas com
-- status = 'confirmed' e deleted_at is null.
--
-- As views usam security_invoker = true: sem isso a view rodaria como o
-- dono e furaria a RLS das tabelas de baixo.
-- =====================================================================

create or replace view public.v_valid_matches
with (security_invoker = true) as
select
  m.id,
  m.group_id,
  m.session_id,
  m.played_at,
  m.winning_side,
  m.team_a_score,
  m.team_b_score
from public.matches m
where m.status = 'confirmed'
  and m.deleted_at is null;

comment on view public.v_valid_matches is
  'Partidas que contam para estatística: confirmadas e não excluídas logicamente.';

-- Uma linha por jogador por partida válida.
create or replace view public.v_match_participants
with (security_invoker = true) as
select
  mp.match_id,
  mp.player_id,
  mp.side,
  mp.slot,
  m.group_id,
  m.played_at,
  m.session_id,
  (mp.side = m.winning_side) as won
from public.match_players mp
join public.v_valid_matches m on m.id = mp.match_id;

-- Uma linha por lado por partida válida, já com a dupla em forma canônica
-- (menor id, maior id). A ordem em que a dupla foi digitada é irrelevante.
create or replace view public.v_match_sides
with (security_invoker = true) as
select
  mp.match_id,
  mp.side,
  m.group_id,
  m.played_at,
  m.session_id,
  bool_or(mp.side = m.winning_side) as won,
  min(mp.player_id::text)::uuid as player_low,
  max(mp.player_id::text)::uuid as player_high
from public.match_players mp
join public.v_valid_matches m on m.id = mp.match_id
group by mp.match_id, mp.side, m.group_id, m.played_at, m.session_id;

grant select on public.v_valid_matches to authenticated;
grant select on public.v_match_participants to authenticated;
grant select on public.v_match_sides to authenticated;

-- ---------------------------------------------------------------------
-- 8.1 — Estatística individual
-- ---------------------------------------------------------------------
create or replace function public.stats_players(
  p_group_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_session_id uuid default null,
  p_player_id uuid default null,
  p_min_games integer default 1
)
returns table (
  rank_position bigint,
  player_id uuid,
  display_name text,
  avatar_url text,
  sort_order integer,
  active boolean,
  is_guest boolean,
  games bigint,
  wins bigint,
  losses bigint,
  win_rate numeric
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
  agg as (
    select
      s.player_id,
      count(*)::bigint as games,
      count(*) filter (where s.won)::bigint as wins,
      count(*) filter (where not s.won)::bigint as losses
    from scoped s
    group by s.player_id
  )
  select
    row_number() over (
      order by (a.wins::numeric / a.games) desc, a.games desc, a.wins desc, p.display_name asc
    ) as rank_position,
    a.player_id,
    p.display_name,
    p.avatar_url,
    p.sort_order,
    p.active,
    p.is_guest,
    a.games,
    a.wins,
    a.losses,
    (a.wins::numeric / a.games) as win_rate
  from agg a
  join public.players p on p.id = a.player_id
  where a.games >= greatest(coalesce(p_min_games, 1), 1)
  order by win_rate desc, a.games desc, a.wins desc, p.display_name asc;
$$;

-- ---------------------------------------------------------------------
-- 8.2 — Estatística de duplas
-- ---------------------------------------------------------------------
create or replace function public.stats_pairs(
  p_group_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_session_id uuid default null,
  p_player_id uuid default null,
  p_min_games integer default 1
)
returns table (
  rank_position bigint,
  pair_key text,
  player_ids uuid[],
  player_names text[],
  games bigint,
  wins bigint,
  losses bigint,
  win_rate numeric
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
      d.names[1] as first_name
    from agg a
    -- A ordem de exibição segue sort_order; a identidade da dupla, não.
    cross join lateral (
      select
        array_agg(p.id order by p.sort_order, p.display_name, p.id) as ids,
        array_agg(p.display_name order by p.sort_order, p.display_name, p.id) as names
      from public.players p
      where p.id in (a.player_low, a.player_high)
    ) d
    where a.games >= greatest(coalesce(p_min_games, 1), 1)
  )
  select
    row_number() over (
      order by l.win_rate desc, l.games desc, l.wins desc, l.first_name asc, l.pair_key asc
    ) as rank_position,
    l.pair_key,
    l.player_ids,
    l.player_names,
    l.games,
    l.wins,
    l.losses,
    l.win_rate
  from labelled l
  order by l.win_rate desc, l.games desc, l.wins desc, l.first_name asc, l.pair_key asc;
$$;

-- ---------------------------------------------------------------------
-- 8.3 — Confronto individual (jogador x jogador)
--
-- Parceiros de dupla NÃO contam como confronto entre si: o join só
-- cruza o lado A com o lado B.
-- ---------------------------------------------------------------------
create or replace function public.stats_player_head_to_head(
  p_group_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_session_id uuid default null,
  p_perspective_player_id uuid default null,
  p_min_games integer default 1
)
returns table (
  player_1_id uuid,
  player_1_name text,
  player_2_id uuid,
  player_2_name text,
  games bigint,
  player_1_wins bigint,
  player_2_wins bigint,
  player_1_win_rate numeric,
  player_2_win_rate numeric
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
  ),
  duels as (
    select a.player_id as pa, b.player_id as pb, a.won as a_won
    from scoped a
    join scoped b on b.match_id = a.match_id
    where a.side = 'A' and b.side = 'B'
  ),
  canon as (
    select
      least(d.pa, d.pb) as p1,
      greatest(d.pa, d.pb) as p2,
      count(*)::bigint as games,
      count(*) filter (
        where (d.pa < d.pb and d.a_won) or (d.pa > d.pb and not d.a_won)
      )::bigint as p1_wins
    from duels d
    group by 1, 2
  ),
  joined as (
    select
      c.p1, c.p2, c.games, c.p1_wins, (c.games - c.p1_wins) as p2_wins,
      a.display_name as n1, a.sort_order as so1,
      b.display_name as n2, b.sort_order as so2
    from canon c
    join public.players a on a.id = c.p1
    join public.players b on b.id = c.p2
    where c.games >= greatest(coalesce(p_min_games, 1), 1)
      and (
        p_perspective_player_id is null
        or c.p1 = p_perspective_player_id
        or c.p2 = p_perspective_player_id
      )
  ),
  oriented as (
    select
      -- Na página de um jogador ele é sempre o lado principal.
      -- Na visão geral, quem tem mais vitórias no confronto aparece antes.
      case
        when p_perspective_player_id is not null then j.p2 = p_perspective_player_id
        when j.p2_wins <> j.p1_wins then j.p2_wins > j.p1_wins
        when j.so2 <> j.so1 then j.so2 < j.so1
        else j.n2 < j.n1
      end as flip,
      j.*
    from joined j
  )
  select
    case when o.flip then o.p2 else o.p1 end as player_1_id,
    case when o.flip then o.n2 else o.n1 end as player_1_name,
    case when o.flip then o.p1 else o.p2 end as player_2_id,
    case when o.flip then o.n1 else o.n2 end as player_2_name,
    o.games,
    case when o.flip then o.p2_wins else o.p1_wins end as player_1_wins,
    case when o.flip then o.p1_wins else o.p2_wins end as player_2_wins,
    (case when o.flip then o.p2_wins else o.p1_wins end)::numeric / o.games as player_1_win_rate,
    (case when o.flip then o.p1_wins else o.p2_wins end)::numeric / o.games as player_2_win_rate
  from oriented o
  order by o.games desc, player_1_win_rate desc, player_1_name asc, player_2_name asc;
$$;

-- ---------------------------------------------------------------------
-- 8.4 — Confronto entre duplas
-- ---------------------------------------------------------------------
create or replace function public.stats_pair_head_to_head(
  p_group_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_session_id uuid default null,
  p_perspective_pair uuid[] default null,
  p_min_games integer default 1
)
returns table (
  pair_1_key text,
  pair_1_ids uuid[],
  pair_1_names text[],
  pair_2_key text,
  pair_2_ids uuid[],
  pair_2_names text[],
  games bigint,
  pair_1_wins bigint,
  pair_2_wins bigint,
  pair_1_win_rate numeric,
  pair_2_win_rate numeric
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
  ),
  duels as (
    select
      array[a.player_low, a.player_high] as pa,
      array[b.player_low, b.player_high] as pb,
      a.won as a_won
    from scoped a
    join scoped b on b.match_id = a.match_id
    where a.side = 'A' and b.side = 'B'
  ),
  canon as (
    select
      case when d.pa < d.pb then d.pa else d.pb end as k1,
      case when d.pa < d.pb then d.pb else d.pa end as k2,
      count(*)::bigint as games,
      count(*) filter (
        where (d.pa < d.pb and d.a_won) or (d.pa > d.pb and not d.a_won)
      )::bigint as k1_wins
    from duels d
    group by 1, 2
  ),
  filtered as (
    select c.*, (c.games - c.k1_wins) as k2_wins
    from canon c
    where c.games >= greatest(coalesce(p_min_games, 1), 1)
      and (
        p_perspective_pair is null
        or c.k1 = (select array_agg(x order by x) from unnest(p_perspective_pair) x)
        or c.k2 = (select array_agg(x order by x) from unnest(p_perspective_pair) x)
      )
  ),
  oriented as (
    select
      f.*,
      case
        when p_perspective_pair is not null
          then f.k2 = (select array_agg(x order by x) from unnest(p_perspective_pair) x)
        when f.k2_wins <> f.k1_wins then f.k2_wins > f.k1_wins
        else f.k2 < f.k1
      end as flip
    from filtered f
  )
  select
    array_to_string(case when o.flip then o.k2 else o.k1 end, ':') as pair_1_key,
    d1.ids as pair_1_ids,
    d1.names as pair_1_names,
    array_to_string(case when o.flip then o.k1 else o.k2 end, ':') as pair_2_key,
    d2.ids as pair_2_ids,
    d2.names as pair_2_names,
    o.games,
    case when o.flip then o.k2_wins else o.k1_wins end as pair_1_wins,
    case when o.flip then o.k1_wins else o.k2_wins end as pair_2_wins,
    (case when o.flip then o.k2_wins else o.k1_wins end)::numeric / o.games as pair_1_win_rate,
    (case when o.flip then o.k1_wins else o.k2_wins end)::numeric / o.games as pair_2_win_rate
  from oriented o
  cross join lateral (
    select
      array_agg(p.id order by p.sort_order, p.display_name, p.id) as ids,
      array_agg(p.display_name order by p.sort_order, p.display_name, p.id) as names
    from public.players p
    where p.id = any (case when o.flip then o.k2 else o.k1 end)
  ) d1
  cross join lateral (
    select
      array_agg(p.id order by p.sort_order, p.display_name, p.id) as ids,
      array_agg(p.display_name order by p.sort_order, p.display_name, p.id) as names
    from public.players p
    where p.id = any (case when o.flip then o.k1 else o.k2 end)
  ) d2
  order by o.games desc, pair_1_win_rate desc, pair_1_key asc, pair_2_key asc;
$$;

-- ---------------------------------------------------------------------
-- Resumo do grupo (dashboard)
-- ---------------------------------------------------------------------
create or replace function public.group_overview(p_group_id uuid)
returns table (
  total_matches bigint,
  total_sessions bigint,
  active_players bigint,
  total_players bigint,
  last_played_at timestamptz,
  last_session_id uuid,
  last_session_played_on date
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.v_valid_matches m where m.group_id = p_group_id)::bigint,
    (select count(distinct m.session_id) from public.v_valid_matches m
      where m.group_id = p_group_id and m.session_id is not null)::bigint,
    (select count(*) from public.players p where p.group_id = p_group_id and p.active)::bigint,
    (select count(*) from public.players p where p.group_id = p_group_id)::bigint,
    (select max(m.played_at) from public.v_valid_matches m where m.group_id = p_group_id),
    (select s.id from public.sessions s where s.group_id = p_group_id
      order by s.played_on desc limit 1),
    (select s.played_on from public.sessions s where s.group_id = p_group_id
      order by s.played_on desc limit 1);
$$;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke execute on function public.stats_players(uuid, timestamptz, timestamptz, uuid, uuid, integer) from public;
revoke execute on function public.stats_pairs(uuid, timestamptz, timestamptz, uuid, uuid, integer) from public;
revoke execute on function public.stats_player_head_to_head(uuid, timestamptz, timestamptz, uuid, uuid, integer) from public;
revoke execute on function public.stats_pair_head_to_head(uuid, timestamptz, timestamptz, uuid, uuid[], integer) from public;
revoke execute on function public.group_overview(uuid) from public;

grant execute on function public.stats_players(uuid, timestamptz, timestamptz, uuid, uuid, integer) to authenticated;
grant execute on function public.stats_pairs(uuid, timestamptz, timestamptz, uuid, uuid, integer) to authenticated;
grant execute on function public.stats_player_head_to_head(uuid, timestamptz, timestamptz, uuid, uuid, integer) to authenticated;
grant execute on function public.stats_pair_head_to_head(uuid, timestamptz, timestamptz, uuid, uuid[], integer) to authenticated;
grant execute on function public.group_overview(uuid) to authenticated;