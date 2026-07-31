-- =====================================================================
-- 13 — Reizinho/Lanterna: vitórias/derrotas absolutas no dia, não delta.
--
-- A migration 12 (20260701001200_strict_math_resenha.sql) decidia o
-- Reizinho/Lanterna do dia pelo DELTA (vitórias - derrotas), o que fazia
-- 3V/1D (delta +2) empatar com 2V/0D (delta +2) mesmo tendo contagens
-- brutas diferentes. Esta migration troca para:
--
--   Reizinho do dia: maior número absoluto de VITÓRIAS no dia.
--     Empate em vitórias -> desempate por MENOR número de derrotas.
--     Empate ainda persistindo -> todos os empatados são coroados.
--   Lanterna do dia: maior número absoluto de DERROTAS no dia.
--     Empate em derrotas -> desempate por MENOR número de vitórias.
--     Empate ainda persistindo -> todos os empatados levam a lanterna.
--
-- v_daily_kings / v_daily_lanterns (contagem histórica de dias como
-- Reizinho/Lanterna) não mudam de forma: continuam agregando
-- v_daily_king_of_day / v_daily_lantern_of_day em count(*) por jogador.
--
-- v_player_daily_stats mantém a coluna delta (não usada mais aqui, mas
-- inofensiva e potencialmente útil para outras estatísticas futuras) via
-- CREATE OR REPLACE. v_daily_king_of_day / v_daily_lantern_of_day e as
-- views que dependem delas precisam de DROP + CREATE, pois a coluna
-- `delta` sai da lista de colunas.
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
    rank() over (
      partition by pds.group_id, pds.play_date
      order by pds.wins desc, pds.losses asc
    ) as rnk
  from public.v_player_daily_stats pds
)
select group_id, play_date, player_id, games, wins, losses
from ranked
where rnk = 1 and wins > 0;

comment on view public.v_daily_king_of_day is
  'Reizinho(s) de cada dia civil: maior número absoluto de vitórias no dia; empate em vitórias é desempatado por menor número de derrotas; empate remanescente coroa todos.';

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
  'Quantos dias civis cada jogador terminou como Reizinho (mais vitórias no dia, desempate por menos derrotas), ordenado do maior para o menor.';

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
    rank() over (
      partition by pds.group_id, pds.play_date
      order by pds.losses desc, pds.wins asc
    ) as rnk
  from public.v_player_daily_stats pds
)
select group_id, play_date, player_id, games, wins, losses
from ranked
where rnk = 1 and losses > 0;

comment on view public.v_daily_lantern_of_day is
  'Lanterna(s) de cada dia civil: maior número absoluto de derrotas no dia; empate em derrotas é desempatado por menor número de vitórias; empate remanescente entrega a lanterna a todos.';

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
  'Quantos dias civis cada jogador terminou como Lanterna (mais derrotas no dia, desempate por menos vitórias), ordenado do maior para o menor.';

-- DROP VIEW derruba os grants — reconceder.
grant select on public.v_daily_king_of_day to authenticated;
grant select on public.v_daily_kings to authenticated;
grant select on public.v_daily_lantern_of_day to authenticated;
grant select on public.v_daily_lanterns to authenticated;
