-- =====================================================================
-- 16 — Reizinho/Lanterna: "Destaque Isolado" (sem desempate).
--
-- A migration 15 (20260701001500_fix_kings_logic.sql) coroava TODOS os
-- jogadores empatados no topo (vitórias para Reizinho, derrotas para
-- Lanterna) quando o desempate secundário também empatava. A regra de
-- negócio mudou: o título só existe se houver um único destaque isolado
-- no dia. Empate no número máximo (de vitórias ou de derrotas) significa
-- que NINGUÉM ganha o título naquele dia — o desempate por derrotas/
-- vitórias deixa de ser usado.
--
--   Reizinho do dia: máximo de vitórias no dia. Só é coroado se
--     exatamente um jogador atingiu esse máximo.
--   Lanterna do dia: máximo de derrotas no dia. Só leva a lanterna se
--     exatamente um jogador atingiu esse máximo.
--
-- v_daily_kings / v_daily_lanterns continuam agregando
-- v_daily_king_of_day / v_daily_lantern_of_day em count(*) por jogador,
-- sem mudança de forma.
-- =====================================================================

drop view if exists public.v_daily_kings;
drop view if exists public.v_daily_king_of_day;

create view public.v_daily_king_of_day
with (security_invoker = true) as
with ranked as (
  select
    pds.group_id,
    pds.play_date,
    pds.player_id,
    pds.games,
    pds.wins,
    pds.losses,
    max(pds.wins) over (partition by pds.group_id, pds.play_date) as max_wins
  from public.v_player_daily_stats pds
),
counted as (
  select
    r.*,
    count(*) filter (where r.wins = r.max_wins)
      over (partition by r.group_id, r.play_date) as top_count
  from ranked r
)
select group_id, play_date, player_id, games, wins, losses
from counted
where wins = max_wins and wins > 0 and top_count = 1;

comment on view public.v_daily_king_of_day is
  'Reizinho de cada dia civil: jogador com o número máximo de vitórias no dia, apenas quando esse máximo é atingido por um único jogador (Destaque Isolado). Empate no máximo não coroa ninguém.';

create view public.v_daily_kings
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
  'Quantos dias civis cada jogador terminou como Reizinho isolado (máximo de vitórias no dia, sem empate), ordenado do maior para o menor.';

drop view if exists public.v_daily_lanterns;
drop view if exists public.v_daily_lantern_of_day;

create view public.v_daily_lantern_of_day
with (security_invoker = true) as
with ranked as (
  select
    pds.group_id,
    pds.play_date,
    pds.player_id,
    pds.games,
    pds.wins,
    pds.losses,
    max(pds.losses) over (partition by pds.group_id, pds.play_date) as max_losses
  from public.v_player_daily_stats pds
),
counted as (
  select
    r.*,
    count(*) filter (where r.losses = r.max_losses)
      over (partition by r.group_id, r.play_date) as top_count
  from ranked r
)
select group_id, play_date, player_id, games, wins, losses
from counted
where losses = max_losses and losses > 0 and top_count = 1;

comment on view public.v_daily_lantern_of_day is
  'Lanterna de cada dia civil: jogador com o número máximo de derrotas no dia, apenas quando esse máximo é atingido por um único jogador (Destaque Isolado). Empate no máximo não entrega a lanterna a ninguém.';

create view public.v_daily_lanterns
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
  'Quantos dias civis cada jogador terminou como Lanterna isolado (máximo de derrotas no dia, sem empate), ordenado do maior para o menor.';

-- DROP VIEW derruba os grants — reconceder.
grant select on public.v_daily_king_of_day to authenticated;
grant select on public.v_daily_kings to authenticated;
grant select on public.v_daily_lantern_of_day to authenticated;
grant select on public.v_daily_lanterns to authenticated;
