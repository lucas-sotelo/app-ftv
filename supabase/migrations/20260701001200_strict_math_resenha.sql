-- =====================================================================
-- 12 — Resenha: precisão absoluta (regras de ouro).
--
-- Mesma disciplina das migrations 10/11: tudo calculado no Postgres via
-- views security_invoker = true. Esta migration:
--
--   1) Reizinho/Lanterna passam a ser decididos pelo DELTA diário
--      (vitórias - derrotas), não mais pela contagem bruta de
--      vitórias/derrotas — ex.: 3V/1D e 2V/0D têm o mesmo delta (+2) e
--      empatam no topo, mesmo com contagens brutas diferentes.
--   2) v_head_to_head_directed é recriada com o join explícito
--      mp1.side <> mp2.side (parceiro de dupla nunca conta como
--      confronto direto).
--   3) Nova view v_individual_underdogs: zebra individual (jogador
--      historicamente "freguês" que vira o jogo).
--   4) v_player_streaks: o tie-break de ordenação cronológica passava
--      por match_id (uuid aleatório). Partidas de uma mesma rodada
--      passada têm todas o mesmo `played_at` (meio-dia local — ver
--      lib/utils/played-at.ts:composePlayedAt), então o desempate por
--      uuid embaralhava a ordem real de entrada e furava a contagem de
--      sequências. Troca para played_at -> matches.created_at ->
--      match_id, que reflete a ordem real de registro.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 12.0 — Base: expor matches.created_at nas views encadeadas, para
-- servir de tie-break cronológico estável (ver 12.4).
-- ---------------------------------------------------------------------
create or replace view public.v_valid_matches
with (security_invoker = true) as
select
  m.id,
  m.group_id,
  m.session_id,
  m.played_at,
  m.winning_side,
  m.team_a_score,
  m.team_b_score,
  m.created_at
from public.matches m
where m.status = 'confirmed'
  and m.deleted_at is null;

comment on view public.v_valid_matches is
  'Partidas que contam para estatística: confirmadas e não excluídas logicamente.';

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
  (mp.side = m.winning_side) as won,
  m.created_at as match_created_at
from public.match_players mp
join public.v_valid_matches m on m.id = mp.match_id;

grant select on public.v_valid_matches to authenticated;
grant select on public.v_match_participants to authenticated;

-- ---------------------------------------------------------------------
-- 12.1 — Reizinho / Lanterna pelo delta diário.
-- ---------------------------------------------------------------------
create or replace view public.v_player_daily_stats
with (security_invoker = true) as
select
  vp.group_id,
  vp.player_id,
  (vp.played_at at time zone g.timezone)::date as play_date,
  count(*)::bigint as games,
  count(*) filter (where vp.won)::bigint as wins,
  count(*) filter (where not vp.won)::bigint as losses,
  (count(*) filter (where vp.won) - count(*) filter (where not vp.won))::bigint as delta
from public.v_match_participants vp
join public.groups g on g.id = vp.group_id
group by vp.group_id, vp.player_id, (vp.played_at at time zone g.timezone)::date;

comment on view public.v_player_daily_stats is
  'Vitórias/derrotas/delta (V-D) de cada jogador por dia civil, no fuso do grupo. Base do Reizinho/Lanterna diário.';

-- Reizinho(s) do dia: maior delta POSITIVO do dia. Sem empate: rank()
-- consecutivo inclui todos no topo. Dia sem ninguém com delta > 0 não
-- coroa Reizinho nenhum.
create or replace view public.v_daily_king_of_day
with (security_invoker = true) as
with ranked as (
  select
    pds.group_id,
    pds.play_date,
    pds.player_id,
    pds.games,
    pds.wins,
    pds.losses,
    pds.delta,
    rank() over (
      partition by pds.group_id, pds.play_date
      order by pds.delta desc
    ) as rnk
  from public.v_player_daily_stats pds
)
select group_id, play_date, player_id, games, wins, losses, delta
from ranked
where rnk = 1 and delta > 0;

comment on view public.v_daily_king_of_day is
  'Reizinho(s) de cada dia civil: jogador(es) com o maior delta positivo (vitórias - derrotas) naquele dia.';

-- Lanterna(s) do dia: maior delta NEGATIVO do dia (equivalente a maior
-- (derrotas - vitórias)). Dia sem ninguém com delta < 0 não coroa
-- Lanterna nenhum.
create or replace view public.v_daily_lantern_of_day
with (security_invoker = true) as
with ranked as (
  select
    pds.group_id,
    pds.play_date,
    pds.player_id,
    pds.games,
    pds.wins,
    pds.losses,
    pds.delta,
    rank() over (
      partition by pds.group_id, pds.play_date
      order by pds.delta asc
    ) as rnk
  from public.v_player_daily_stats pds
)
select group_id, play_date, player_id, games, wins, losses, delta
from ranked
where rnk = 1 and delta < 0;

comment on view public.v_daily_lantern_of_day is
  'Lanterna(s) de cada dia civil: jogador(es) com o maior delta negativo (derrotas - vitórias) naquele dia.';

-- Histórico: quantos dias cada jogador foi coroado. Mesma forma de
-- colunas das views anteriores (group_id, player_id, display_name,
-- avatar_url, times_as_king/times_as_lantern) — CREATE OR REPLACE é
-- seguro, não precisa DROP.
create or replace view public.v_daily_kings
with (security_invoker = true) as
select
  k.group_id,
  k.player_id,
  p.display_name,
  p.avatar_url,
  count(*)::bigint as times_as_king
from public.v_daily_king_of_day k
join public.players p on p.id = k.player_id
group by k.group_id, k.player_id, p.display_name, p.avatar_url
order by times_as_king desc, p.display_name;

comment on view public.v_daily_kings is
  'Quantos dias civis cada jogador terminou como Reizinho (maior delta V-D do dia), ordenado do maior para o menor.';

create or replace view public.v_daily_lanterns
with (security_invoker = true) as
select
  l.group_id,
  l.player_id,
  p.display_name,
  p.avatar_url,
  count(*)::bigint as times_as_lantern
from public.v_daily_lantern_of_day l
join public.players p on p.id = l.player_id
group by l.group_id, l.player_id, p.display_name, p.avatar_url
order by times_as_lantern desc, p.display_name;

comment on view public.v_daily_lanterns is
  'Quantos dias civis cada jogador terminou como Lanterna (maior delta D-V do dia), ordenado do maior para o menor.';

grant select on public.v_player_daily_stats to authenticated;
grant select on public.v_daily_king_of_day to authenticated;
grant select on public.v_daily_lantern_of_day to authenticated;
grant select on public.v_daily_kings to authenticated;
grant select on public.v_daily_lanterns to authenticated;

-- ---------------------------------------------------------------------
-- 12.2 — Freguesia/Massacre: join corrigido (lados opostos).
--
-- match_players do "atacante" e da "vítima" só podem vir de lados
-- diferentes na mesma partida (mp1.side <> mp2.side); parceiro de
-- dupla nunca é confronto direto.
-- ---------------------------------------------------------------------
create or replace view public.v_head_to_head_events
with (security_invoker = true) as
select
  m.id as match_id,
  m.group_id,
  m.played_at,
  m.created_at as match_created_at,
  mp1.player_id as attacker_id,
  mp2.player_id as victim_id,
  (mp1.side = m.winning_side) as attacker_won
from public.match_players mp1
join public.match_players mp2
  on mp2.match_id = mp1.match_id
  and mp1.side <> mp2.side
join public.v_valid_matches m on m.id = mp1.match_id;

comment on view public.v_head_to_head_events is
  'Um par (atacante, vítima) por partida por direção, só entre jogadores em lados opostos (mp1.side <> mp2.side). Parceiro de dupla nunca conta. Base de v_head_to_head_directed e v_individual_underdogs.';

create or replace view public.v_head_to_head_directed
with (security_invoker = true) as
select
  group_id,
  attacker_id,
  victim_id,
  count(*)::bigint as games,
  count(*) filter (where attacker_won)::bigint as wins,
  (count(*) filter (where attacker_won))::numeric / count(*) as win_rate
from public.v_head_to_head_events
group by group_id, attacker_id, victim_id;

comment on view public.v_head_to_head_directed is
  'Confronto direto direcionado (atacante x vítima), só entre jogadores em lados opostos. Parceiros de dupla nunca contam. Base de v_biggest_massacres.';

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
  'Maior percentual de vitórias de um jogador contra um adversário específico (freguesia/massacre), com mínimo de 4 confrontos diretos em lados opostos.';

grant select on public.v_head_to_head_events to authenticated;
grant select on public.v_head_to_head_directed to authenticated;
grant select on public.v_biggest_massacres to authenticated;

-- ---------------------------------------------------------------------
-- 12.3 — Zebra Individual: A venceu B, mas B era historicamente
-- dominante (pelo menos 4 vitórias de vantagem sobre A no confronto
-- direto, olhando só para o que aconteceu ANTES desta partida).
--
-- Uma linha por partida por par de adversários em lados opostos
-- (player_low < player_high evita contar cada duelo duas vezes). Para
-- cada linha, uma window function soma as vitórias anteriores de cada
-- lado do par (rows between unbounded preceding and 1 preceding =
-- estritamente antes desta partida, na mesma ordem cronológica
-- estável de v_player_streaks: played_at -> match_created_at ->
-- match_id).
-- ---------------------------------------------------------------------
create or replace view public.v_individual_underdogs
with (security_invoker = true) as
with pairwise_duels as (
  select
    m.id as match_id,
    m.group_id,
    m.played_at,
    m.created_at as match_created_at,
    mp1.player_id as player_low,
    mp2.player_id as player_high,
    case when mp1.side = m.winning_side then mp1.player_id else mp2.player_id end as winner_id,
    case when mp1.side = m.winning_side then mp2.player_id else mp1.player_id end as loser_id
  from public.match_players mp1
  join public.match_players mp2
    on mp2.match_id = mp1.match_id
    and mp1.side <> mp2.side
    and mp1.player_id < mp2.player_id
  join public.v_valid_matches m on m.id = mp1.match_id
),
with_priors as (
  select
    pd.*,
    count(*) filter (where pd.winner_id = pd.player_low) over (
      partition by pd.group_id, pd.player_low, pd.player_high
      order by pd.played_at, pd.match_created_at, pd.match_id
      rows between unbounded preceding and 1 preceding
    )::bigint as prior_low_wins,
    count(*) filter (where pd.winner_id = pd.player_high) over (
      partition by pd.group_id, pd.player_low, pd.player_high
      order by pd.played_at, pd.match_created_at, pd.match_id
      rows between unbounded preceding and 1 preceding
    )::bigint as prior_high_wins
  from pairwise_duels pd
),
scored as (
  select
    wp.match_id,
    wp.group_id,
    wp.played_at,
    wp.winner_id as underdog_id,
    wp.loser_id as favorite_id,
    case when wp.winner_id = wp.player_low then wp.prior_low_wins else wp.prior_high_wins end as underdog_prior_wins,
    case when wp.winner_id = wp.player_low then wp.prior_high_wins else wp.prior_low_wins end as favorite_prior_wins
  from with_priors wp
)
select
  s.match_id,
  s.group_id,
  s.played_at,
  s.underdog_id,
  pu.display_name as underdog_name,
  pu.avatar_url as underdog_avatar_url,
  s.favorite_id,
  pf.display_name as favorite_name,
  pf.avatar_url as favorite_avatar_url,
  s.underdog_prior_wins,
  s.favorite_prior_wins,
  (s.favorite_prior_wins - s.underdog_prior_wins) as prior_win_gap
from scored s
join public.players pu on pu.id = s.underdog_id
join public.players pf on pf.id = s.favorite_id
where (s.favorite_prior_wins - s.underdog_prior_wins) >= 4
order by s.played_at desc;

comment on view public.v_individual_underdogs is
  'Zebra individual: partidas em que o vencedor vinha perdendo o confronto direto por pelo menos 4 vitórias de diferença até (sem incluir) esta partida.';

grant select on public.v_individual_underdogs to authenticated;

-- ---------------------------------------------------------------------
-- 12.4 — Blindagem de v_player_streaks: tie-break cronológico estável.
--
-- played_at sozinho empata sempre que uma rodada passada é lançada de
-- uma vez (composePlayedAt fixa meio-dia local para o dia inteiro da
-- rodada — ver lib/utils/played-at.ts). O desempate por match_id
-- (uuid aleatório) então decidia a ordem "real" das partidas do dia ao
-- acaso, e podia juntar ou cortar sequências no lugar errado. Troca
-- para match_created_at (ordem real de inserção) antes do match_id.
-- Mantém o filtro estrito em partidas válidas (status = 'confirmed' e
-- deleted_at is null), herdado de v_match_participants/v_valid_matches.
-- ---------------------------------------------------------------------
create or replace view public.v_player_streaks
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
  'Maior sequência histórica de vitórias (Dias de Sol) e derrotas (Dias de Chuva) consecutivas de cada jogador, com desempate cronológico estável (played_at -> match_created_at -> match_id).';

grant select on public.v_player_streaks to authenticated;

-- v_pair_win_rates / v_pair_underdogs não mudam de regra nesta
-- migration, só reconcedendo select por segurança (CREATE OR REPLACE
-- preserva ACL, mas mantemos explícito por padrão do arquivo).
grant select on public.v_pair_win_rates to authenticated;
grant select on public.v_pair_underdogs to authenticated;
