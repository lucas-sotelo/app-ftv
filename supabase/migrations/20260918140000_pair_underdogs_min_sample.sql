-- =====================================================================
-- 23 — v_pair_underdogs: amostra mínima pra virar zebra.
--
-- A correção causal (20260918120000) exigia só "prior_games > 0" —
-- suficiente pra não usar informação futura, mas não pra evitar ruído de
-- amostra pequena. Duplas são dinâmicas: é comum uma combinação
-- específica de dois jogadores ter jogado junta só 1 ou 2 vezes antes de
-- uma partida, e nesse tamanho de amostra o win rate da DUPLA (não dos
-- jogadores individualmente) é 0% ou 100% quase por acaso.
--
-- Foi assim que "Heitor + Sotelo" apareceu como zebra ao vencer
-- "Muralha + Alex": mesmo Heitor sendo o líder do ranking individual, a
-- combinação Heitor+Sotelo tinha poucos jogos juntos antes daquela
-- partida — o win rate baixo refletia amostra pequena, não fraqueza real
-- da dupla.
--
-- Corrige exigindo pelo menos 4 jogos anteriores de cada lado — mesmo
-- piso já usado no resto da Resenha para "história o bastante pra
-- valer" (v_biggest_massacres.games >= 4, v_individual_underdogs com
-- gap de pelo menos 4 vitórias).
-- =====================================================================

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
  -- Menos de 4 jogos anteriores é amostra pequena demais pra confiar no
  -- win rate da dupla especificamente (ver nota no topo do arquivo).
  where m.winner_prior_games >= 4 and m.loser_prior_games >= 4
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
  'Zebra de dupla: a dupla vencedora tinha win rate pelo menos 15 pontos percentuais menor que a perdedora, considerando só as partidas de cada dupla ANTES desta (mesmo critério causal de v_individual_underdogs) e com pelo menos 4 jogos anteriores de cada lado (evita ruído de amostra pequena em duplas dinâmicas).';

grant select on public.v_pair_underdogs to authenticated;
