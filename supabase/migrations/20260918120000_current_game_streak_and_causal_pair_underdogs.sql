-- =====================================================================
-- 22 — Sequência atual por PARTIDA (não por dia) + zebra de dupla causal.
--
-- 1) v_player_current_game_streak: a Resenha pede "Fulano está a X jogos
--    sem perder!" — uma sequência em andamento contada em partidas, não
--    em dias civis. v_player_current_streak (20260701002300) foi
--    corrigida de propósito para contar DIAS (Dia de Sol/Dia de Noite);
--    reaproveitar essa view aqui daria o número errado. Esta view nova
--    replica a mesma lógica de "ilhas" de v_player_streaks, mas pega só
--    o bloco cronologicamente mais recente (a sequência em andamento),
--    igual v_player_current_streak fazia antes de virar diária.
--
-- 2) v_pair_underdogs: a zebra de dupla comparava o win rate ALL-TIME de
--    cada dupla (calculado com TODAS as partidas, inclusive as
--    posteriores à partida analisada) — ao contrário de
--    v_individual_underdogs, que já usa só o histórico ANTES da partida
--    (window function `rows between unbounded preceding and 1
--    preceding`). Com duplas dinâmicas e o volume de jogos crescendo, o
--    win rate all-time de cada dupla converge pra perto da média do
--    grupo, então a diferença de 15 pontos raramente aparece mais em
--    partidas recentes — a lista de zebras parece "parada". A correção
--    troca para o mesmo critério causal (só o que já tinha acontecido
--    até ali), igual ao individual.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 22.1 — v_player_current_game_streak
-- ---------------------------------------------------------------------
create or replace view public.v_player_current_game_streak
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

comment on view public.v_player_current_game_streak is
  'Sequência de vitórias ou derrotas em andamento contada em PARTIDAS (o bloco de jogos mais recente de cada jogador) — diferente de v_player_current_streak, que conta dias civis. Base do card "X jogos sem perder" na Resenha.';

grant select on public.v_player_current_game_streak to authenticated;

-- ---------------------------------------------------------------------
-- 22.2 — v_pair_underdogs causal (win rate só com o histórico anterior).
-- ---------------------------------------------------------------------
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
    ms.player_high,
    m.created_at as match_created_at
  from public.v_match_sides ms
  join public.v_valid_matches m on m.id = ms.match_id
),
-- Uma linha por (partida, lado); cada lado tem sua própria identidade de
-- dupla (player_low/player_high), então o par (match_id, player_low,
-- player_high) já identifica a linha sem ambiguidade.
with_priors as (
  select
    s.*,
    count(*) over (
      partition by s.group_id, s.player_low, s.player_high
      order by s.played_at, s.match_created_at, s.match_id
      rows between unbounded preceding and 1 preceding
    )::bigint as prior_games,
    count(*) filter (where s.won) over (
      partition by s.group_id, s.player_low, s.player_high
      order by s.played_at, s.match_created_at, s.match_id
      rows between unbounded preceding and 1 preceding
    )::bigint as prior_wins
  from sides s
),
matched as (
  select
    winner.match_id,
    winner.group_id,
    winner.played_at,
    winner.player_low as winner_low,
    winner.player_high as winner_high,
    winner.prior_games as winner_prior_games,
    winner.prior_wins as winner_prior_wins,
    loser.player_low as loser_low,
    loser.player_high as loser_high,
    loser.prior_games as loser_prior_games,
    loser.prior_wins as loser_prior_wins
  from with_priors winner
  join with_priors loser
    on loser.match_id = winner.match_id and loser.side <> winner.side
  where winner.won and not loser.won
),
scored as (
  select
    m.*,
    (m.winner_prior_wins::numeric / m.winner_prior_games) as winner_prior_win_rate,
    (m.loser_prior_wins::numeric / m.loser_prior_games) as loser_prior_win_rate
  from matched m
  -- Dupla estreando (sem partida anterior) não tem win rate prévio pra
  -- comparar — não dá pra chamar de zebra sem histórico.
  where m.winner_prior_games > 0 and m.loser_prior_games > 0
)
select
  s.match_id,
  s.group_id,
  s.played_at,
  s.winner_low::text || ':' || s.winner_high::text as winner_pair_key,
  wp.ids as winner_player_ids,
  wp.names as winner_player_names,
  s.winner_prior_games as winner_games,
  s.winner_prior_win_rate as winner_win_rate,
  s.loser_low::text || ':' || s.loser_high::text as loser_pair_key,
  lp.ids as loser_player_ids,
  lp.names as loser_player_names,
  s.loser_prior_games as loser_games,
  s.loser_prior_win_rate as loser_win_rate,
  (s.loser_prior_win_rate - s.winner_prior_win_rate) as win_rate_gap
from scored s
cross join lateral (
  select
    array_agg(p.id order by p.sort_order, p.display_name, p.id) as ids,
    array_agg(p.display_name order by p.sort_order, p.display_name, p.id) as names
  from public.players p
  where p.id in (s.winner_low, s.winner_high)
) wp
cross join lateral (
  select
    array_agg(p.id order by p.sort_order, p.display_name, p.id) as ids,
    array_agg(p.display_name order by p.sort_order, p.display_name, p.id) as names
  from public.players p
  where p.id in (s.loser_low, s.loser_high)
) lp
where (s.loser_prior_win_rate - s.winner_prior_win_rate) >= 0.15
order by s.played_at desc;

comment on view public.v_pair_underdogs is
  'Zebra de dupla: a dupla vencedora tinha win rate pelo menos 15 pontos percentuais menor que a perdedora, considerando só as partidas de cada dupla ANTES desta (mesmo critério causal de v_individual_underdogs). Duplas sem partida anterior ficam de fora.';

grant select on public.v_pair_underdogs to authenticated;
