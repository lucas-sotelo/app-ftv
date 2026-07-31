-- =====================================================================
-- 10 — Resenha: estatísticas divertidas do grupo.
--
-- Mesma regra da camada de estatísticas: tudo calculado no Postgres,
-- zero matemática no client. Todas as views usam security_invoker = true
-- e são construídas em cima de public.v_match_participants /
-- public.v_match_sides, que já filtram partidas confirmadas e não
-- excluídas (public.v_valid_matches) e já respeitam a RLS de
-- public.matches / public.match_players via o usuário autenticado.
--
-- Recortes diários usam groups.timezone (default 'America/Sao_Paulo'):
-- "dia" aqui é sempre o dia civil do fuso do grupo, não UTC.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 10.1 — Base: desempenho de cada jogador por dia civil do grupo.
-- ---------------------------------------------------------------------
create or replace view public.v_player_daily_stats
with (security_invoker = true) as
select
  vp.group_id,
  vp.player_id,
  (vp.played_at at time zone g.timezone)::date as play_date,
  count(*)::bigint as games,
  count(*) filter (where vp.won)::bigint as wins,
  count(*) filter (where not vp.won)::bigint as losses
from public.v_match_participants vp
join public.groups g on g.id = vp.group_id
group by vp.group_id, vp.player_id, (vp.played_at at time zone g.timezone)::date;

comment on view public.v_player_daily_stats is
  'Vitórias/derrotas de cada jogador por dia civil, no fuso do grupo. Base de v_daily_kings e v_daily_lanterns.';

-- ---------------------------------------------------------------------
-- 10.2 — Rei da Praia diário: quem mais venceu em cada dia.
-- Empate inclui todos os jogadores no topo (rank() consecutivo).
-- ---------------------------------------------------------------------
create or replace view public.v_daily_kings
with (security_invoker = true) as
with ranked as (
  select
    pds.group_id,
    pds.play_date,
    pds.player_id,
    pds.games,
    pds.wins,
    pds.losses,
    rank() over (
      partition by pds.group_id, pds.play_date
      order by pds.wins desc
    ) as rnk
  from public.v_player_daily_stats pds
  where pds.wins > 0
)
select
  r.group_id,
  r.play_date,
  r.player_id,
  p.display_name,
  p.avatar_url,
  r.games,
  r.wins,
  r.losses
from ranked r
join public.players p on p.id = r.player_id
where r.rnk = 1;

comment on view public.v_daily_kings is
  'Rei(s) da Praia por dia: jogador(es) com mais vitórias naquele dia civil do grupo.';

-- ---------------------------------------------------------------------
-- 10.3 — Lanterna da Praia diário: quem mais perdeu em cada dia.
-- ---------------------------------------------------------------------
create or replace view public.v_daily_lanterns
with (security_invoker = true) as
with ranked as (
  select
    pds.group_id,
    pds.play_date,
    pds.player_id,
    pds.games,
    pds.wins,
    pds.losses,
    rank() over (
      partition by pds.group_id, pds.play_date
      order by pds.losses desc
    ) as rnk
  from public.v_player_daily_stats pds
  where pds.losses > 0
)
select
  r.group_id,
  r.play_date,
  r.player_id,
  p.display_name,
  p.avatar_url,
  r.games,
  r.wins,
  r.losses
from ranked r
join public.players p on p.id = r.player_id
where r.rnk = 1;

comment on view public.v_daily_lanterns is
  'Lanterna(s) da Praia por dia: jogador(es) com mais derrotas naquele dia civil do grupo.';

-- ---------------------------------------------------------------------
-- 10.4 — Sequências de Sol (vitórias) e Chuva (derrotas).
--
-- Técnica clássica de "ilhas": row_number() geral menos row_number()
-- particionado por resultado dá um id estável por sequência consecutiva
-- de won/lost, na ordem cronológica de cada jogador.
-- ---------------------------------------------------------------------
create or replace view public.v_player_streaks
with (security_invoker = true) as
with ordered as (
  select
    vp.group_id,
    vp.player_id,
    vp.played_at,
    vp.match_id,
    vp.won,
    row_number() over (
      partition by vp.group_id, vp.player_id
      order by vp.played_at, vp.match_id
    )
    - row_number() over (
      partition by vp.group_id, vp.player_id, vp.won
      order by vp.played_at, vp.match_id
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
    min(played_at) as streak_start_at,
    max(played_at) as streak_end_at
  from ordered
  group by group_id, player_id, won, streak_group
),
best_win_streak as (
  select distinct on (group_id, player_id)
    group_id, player_id, streak_length, streak_start_at, streak_end_at
  from streaks
  where won
  order by group_id, player_id, streak_length desc, streak_end_at desc
),
best_loss_streak as (
  select distinct on (group_id, player_id)
    group_id, player_id, streak_length, streak_start_at, streak_end_at
  from streaks
  where not won
  order by group_id, player_id, streak_length desc, streak_end_at desc
),
combined as (
  select
    coalesce(bw.group_id, bl.group_id) as group_id,
    coalesce(bw.player_id, bl.player_id) as player_id,
    bw.streak_length as win_streak_length,
    bw.streak_start_at as win_streak_start_at,
    bw.streak_end_at as win_streak_end_at,
    bl.streak_length as loss_streak_length,
    bl.streak_start_at as loss_streak_start_at,
    bl.streak_end_at as loss_streak_end_at
  from best_win_streak bw
  full outer join best_loss_streak bl
    on bl.group_id = bw.group_id and bl.player_id = bw.player_id
)
select
  c.group_id,
  c.player_id,
  p.display_name,
  p.avatar_url,
  coalesce(c.win_streak_length, 0)::bigint as longest_win_streak,
  c.win_streak_start_at as longest_win_streak_start_at,
  c.win_streak_end_at as longest_win_streak_end_at,
  coalesce(c.loss_streak_length, 0)::bigint as longest_loss_streak,
  c.loss_streak_start_at as longest_loss_streak_start_at,
  c.loss_streak_end_at as longest_loss_streak_end_at
from combined c
join public.players p on p.id = c.player_id;

comment on view public.v_player_streaks is
  'Maior sequência histórica de vitórias (Dias de Sol) e derrotas (Dias de Chuva) consecutivas de cada jogador.';

-- ---------------------------------------------------------------------
-- 10.5 — Zebras de dupla.
--
-- Win rate histórico por dupla (mesma identidade canônica usada em
-- stats_pairs: LEAST/GREATEST dos dois ids). Uma "zebra" é uma partida
-- em que a dupla vencedora tinha win rate histórico pelo menos 15 pontos
-- percentuais menor que o da dupla perdedora. O win rate é cumulativo
-- (inclui a própria partida), igual ao critério de stats_pairs.
-- ---------------------------------------------------------------------
create or replace view public.v_pair_win_rates
with (security_invoker = true) as
select
  ms.group_id,
  ms.player_low,
  ms.player_high,
  count(*)::bigint as games,
  count(*) filter (where ms.won)::bigint as wins,
  (count(*) filter (where ms.won))::numeric / count(*) as win_rate
from public.v_match_sides ms
group by ms.group_id, ms.player_low, ms.player_high;

comment on view public.v_pair_win_rates is
  'Win rate histórico por dupla (identidade canônica LEAST/GREATEST). Base de v_pair_underdogs.';

create or replace view public.v_pair_underdogs
with (security_invoker = true) as
with sides as (
  select
    ms.match_id,
    ms.group_id,
    ms.side,
    ms.played_at,
    ms.won,
    ms.player_low,
    ms.player_high
  from public.v_match_sides ms
),
matched as (
  select
    winner.match_id,
    winner.group_id,
    winner.played_at,
    winner.player_low as winner_low,
    winner.player_high as winner_high,
    loser.player_low as loser_low,
    loser.player_high as loser_high
  from sides winner
  join sides loser
    on loser.match_id = winner.match_id and loser.side <> winner.side
  where winner.won and not loser.won
),
rated as (
  select
    m.*,
    wr.games as winner_games,
    wr.win_rate as winner_win_rate,
    lr.games as loser_games,
    lr.win_rate as loser_win_rate
  from matched m
  join public.v_pair_win_rates wr
    on wr.group_id = m.group_id
    and wr.player_low = m.winner_low and wr.player_high = m.winner_high
  join public.v_pair_win_rates lr
    on lr.group_id = m.group_id
    and lr.player_low = m.loser_low and lr.player_high = m.loser_high
)
select
  r.match_id,
  r.group_id,
  r.played_at,
  r.winner_low::text || ':' || r.winner_high::text as winner_pair_key,
  wp.ids as winner_player_ids,
  wp.names as winner_player_names,
  r.winner_games,
  r.winner_win_rate,
  r.loser_low::text || ':' || r.loser_high::text as loser_pair_key,
  lp.ids as loser_player_ids,
  lp.names as loser_player_names,
  r.loser_games,
  r.loser_win_rate,
  (r.loser_win_rate - r.winner_win_rate) as win_rate_gap
from rated r
cross join lateral (
  select
    array_agg(p.id order by p.sort_order, p.display_name, p.id) as ids,
    array_agg(p.display_name order by p.sort_order, p.display_name, p.id) as names
  from public.players p
  where p.id in (r.winner_low, r.winner_high)
) wp
cross join lateral (
  select
    array_agg(p.id order by p.sort_order, p.display_name, p.id) as ids,
    array_agg(p.display_name order by p.sort_order, p.display_name, p.id) as names
  from public.players p
  where p.id in (r.loser_low, r.loser_high)
) lp
where (r.loser_win_rate - r.winner_win_rate) >= 0.15
order by r.played_at desc;

comment on view public.v_pair_underdogs is
  'Partidas "zebra": dupla vencedora com win rate histórico pelo menos 15pp menor que o da dupla perdedora.';

-- ---------------------------------------------------------------------
-- 10.6 — O Massacre do Grupo: confronto direto mais lopsided.
--
-- Direcionado (atacante -> vítima), ao contrário de
-- stats_player_head_to_head que devolve o par não-ordenado. Exige pelo
-- menos 4 confrontos diretos entre os dois para entrar na lista — evita
-- que 1 vitória isolada apareça como "100% de massacre".
-- ---------------------------------------------------------------------
create or replace view public.v_head_to_head_directed
with (security_invoker = true) as
with scoped as (
  select vp.* from public.v_match_participants vp
),
duels as (
  select a.group_id, a.player_id as attacker_id, b.player_id as victim_id, a.won as attacker_won
  from scoped a
  join scoped b on b.match_id = a.match_id
  where a.side = 'A' and b.side = 'B'
  union all
  select b.group_id, b.player_id as attacker_id, a.player_id as victim_id, b.won as attacker_won
  from scoped a
  join scoped b on b.match_id = a.match_id
  where a.side = 'A' and b.side = 'B'
)
select
  group_id,
  attacker_id,
  victim_id,
  count(*)::bigint as games,
  count(*) filter (where attacker_won)::bigint as wins,
  (count(*) filter (where attacker_won))::numeric / count(*) as win_rate
from duels
group by group_id, attacker_id, victim_id;

comment on view public.v_head_to_head_directed is
  'Confronto direto direcionado (atacante x vítima). Parceiros de dupla não contam como confronto. Base de v_biggest_massacres.';

create or replace view public.v_biggest_massacres
with (security_invoker = true) as
select
  h.group_id,
  h.attacker_id,
  pa.display_name as attacker_name,
  pa.avatar_url as attacker_avatar_url,
  h.victim_id,
  pv.display_name as victim_name,
  pv.avatar_url as victim_avatar_url,
  h.games,
  h.wins,
  h.win_rate
from public.v_head_to_head_directed h
join public.players pa on pa.id = h.attacker_id
join public.players pv on pv.id = h.victim_id
where h.games >= 4
order by h.win_rate desc, h.games desc;

comment on view public.v_biggest_massacres is
  'Maior percentual de vitórias de um jogador contra um adversário específico, com mínimo de 4 confrontos diretos.';

-- ---------------------------------------------------------------------
-- Grants
--
-- Views com security_invoker = true checam privilégios do usuário que
-- consulta, inclusive nas views intermediárias referenciadas por baixo —
-- por isso todas (não só as finais) precisam de GRANT SELECT explícito.
-- A RLS de public.matches / public.match_players / public.players
-- continua sendo a autorização real: sem ser membro do grupo, a
-- consulta simplesmente não retorna linha nenhuma.
-- ---------------------------------------------------------------------
grant select on public.v_player_daily_stats to authenticated;
grant select on public.v_daily_kings to authenticated;
grant select on public.v_daily_lanterns to authenticated;
grant select on public.v_player_streaks to authenticated;
grant select on public.v_pair_win_rates to authenticated;
grant select on public.v_pair_underdogs to authenticated;
grant select on public.v_head_to_head_directed to authenticated;
grant select on public.v_biggest_massacres to authenticated;
