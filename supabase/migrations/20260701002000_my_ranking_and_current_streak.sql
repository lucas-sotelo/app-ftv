-- =====================================================================
-- 20 — Posição do usuário em cada grupo + sequência atual (streak aberta).
--
-- Suporta dois pontos de engajamento:
--   1) my_ranking_positions(): usada em /comecar para mostrar "3º no
--      Ranking" ao lado da cidade de cada grupo, sem uma chamada por
--      grupo — resolve auth.uid() -> jogador vinculado -> posição, para
--      todos os grupos do usuário, numa única query set-based.
--   2) v_player_current_streak: mesma lógica de "ilhas" de
--      v_player_streaks (20260701001200_strict_math_resenha.sql), mas
--      pega o bloco cronologicamente mais recente por jogador (a
--      sequência em andamento), não o maior histórico.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 20.1 — my_ranking_positions()
--
-- security invoker: a CTE "scoped" só enxerga partidas dos grupos onde o
-- próprio usuário é membro (RLS de matches/players já garante isso), então
-- não precisa (nem deve) rodar como definer.
-- ---------------------------------------------------------------------
create or replace function public.my_ranking_positions()
returns table (
  group_id uuid,
  player_id uuid,
  "position" bigint,
  meets_min_attendance boolean,
  win_rate numeric
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with my_players as (
    select p.id as player_id, p.group_id
    from public.players p
    where p.linked_user_id = (select auth.uid())
  ),
  scoped as (
    select vp.*
    from public.v_match_participants vp
    where vp.group_id in (select mp.group_id from my_players mp)
  ),
  total as (
    select s.group_id, count(distinct s.match_id)::bigint as total_matches
    from scoped s
    group by s.group_id
  ),
  agg as (
    select
      s.group_id,
      s.player_id,
      count(*)::bigint as games,
      count(*) filter (where s.won)::bigint as wins
    from scoped s
    group by s.group_id, s.player_id
  ),
  enriched as (
    select
      a.group_id,
      a.player_id,
      p.display_name,
      a.games,
      a.wins,
      (a.wins::numeric / a.games) as win_rate,
      case
        when t.total_matches > 0 then (a.games::numeric / t.total_matches) * 100
        else 0
      end as attendance_percent,
      g.min_attendance_percent
    from agg a
    join public.players p on p.id = a.player_id
    join public.groups g on g.id = a.group_id
    join total t on t.group_id = a.group_id
  ),
  flagged as (
    select
      e.*,
      (
        e.attendance_percent >= greatest(coalesce(e.min_attendance_percent, 0), 0)
      ) as meets_min_attendance
    from enriched e
  ),
  ranked as (
    select
      f.group_id,
      f.player_id,
      f.win_rate,
      f.meets_min_attendance,
      row_number() over (
        partition by f.group_id, f.meets_min_attendance
        order by f.win_rate desc, f.games desc, f.wins desc, f.display_name asc
      ) as "position"
    from flagged f
  )
  select r.group_id, r.player_id, r."position", r.meets_min_attendance, r.win_rate
  from ranked r
  join my_players mp on mp.group_id = r.group_id and mp.player_id = r.player_id;
$$;

revoke execute on function public.my_ranking_positions() from public;
grant execute on function public.my_ranking_positions() to authenticated;

-- ---------------------------------------------------------------------
-- 20.2 — v_player_current_streak: sequência em andamento (não a maior
-- histórica). Mesmo tie-break estável de v_player_streaks: played_at ->
-- match_created_at -> match_id.
-- ---------------------------------------------------------------------
create or replace view public.v_player_current_streak
with (security_invoker = true) as
with ordered as (
  select
    vp.group_id,
    vp.player_id,
    vp.played_at,
    vp.match_created_at,
    vp.match_id,
    vp.won,
    row_number() over (
      partition by vp.group_id, vp.player_id
      order by vp.played_at, vp.match_created_at, vp.match_id
    )
    - row_number() over (
      partition by vp.group_id, vp.player_id, vp.won
      order by vp.played_at, vp.match_created_at, vp.match_id
    ) as streak_group
  from public.v_match_participants vp
),
streaks as (
  select
    group_id,
    player_id,
    won,
    streak_group,
    count(*)::bigint as streak_length,
    max(played_at) as streak_end_at
  from ordered
  group by group_id, player_id, won, streak_group
),
current_streak as (
  select distinct on (group_id, player_id)
    group_id, player_id, won, streak_length, streak_end_at
  from streaks
  order by group_id, player_id, streak_end_at desc
)
select
  c.group_id,
  c.player_id,
  p.display_name,
  p.avatar_url,
  case when c.won then 'win' else 'loss' end as streak_type,
  c.streak_length,
  c.streak_end_at
from current_streak c
join public.players p on p.id = c.player_id;

comment on view public.v_player_current_streak is
  'Sequência de vitórias ou derrotas em andamento (o bloco mais recente), diferente de v_player_streaks que guarda o maior histórico.';

grant select on public.v_player_current_streak to authenticated;
