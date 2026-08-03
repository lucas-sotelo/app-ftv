-- =====================================================================
-- 21 — Corrige v_player_current_streak: "Dia de Sol" / "Dia de Noite"
-- deve ser uma contagem de DIAS consecutivos com predominância de
-- vitórias ou derrotas, não de partidas isoladas em sequência.
--
-- A versão anterior (20260701002000_my_ranking_and_current_streak.sql)
-- tratava cada partida como uma unidade da "ilha" de streak — duas
-- vitórias seguidas no mesmo dia (ou em dias diferentes) contavam como
-- streak de 2, mesmo sem nenhuma noção de "dia". Alinhando com o
-- modelo correto:
--   A) Agrupa partidas do jogador por dia civil (fuso do grupo), via
--      v_player_daily_stats (já existente, 20260701001200).
--   B) Cada dia vira um resultado agregado: 'win' se vitórias > derrotas,
--      'loss' se derrotas > vitórias, ou nulo em caso de empate no dia
--      (dia neutro — não conta nem quebra a sequência).
--   C) A streak em andamento é a "ilha" mais recente desses dias.
-- =====================================================================

create or replace view public.v_player_current_streak
with (security_invoker = true) as
with daily_result as (
  select
    group_id,
    player_id,
    play_date,
    case
      when wins > losses then 'win'
      when losses > wins then 'loss'
    end as day_result
  from public.v_player_daily_stats
  where wins <> losses
),
ordered as (
  select
    group_id,
    player_id,
    play_date,
    day_result,
    row_number() over (
      partition by group_id, player_id
      order by play_date
    )
    - row_number() over (
      partition by group_id, player_id, day_result
      order by play_date
    ) as streak_group
  from daily_result
),
streaks as (
  select
    group_id,
    player_id,
    day_result,
    streak_group,
    count(*)::bigint as streak_length,
    max(play_date) as streak_end_at
  from ordered
  group by group_id, player_id, day_result, streak_group
),
current_streak as (
  select distinct on (group_id, player_id)
    group_id, player_id, day_result, streak_length, streak_end_at
  from streaks
  order by group_id, player_id, streak_end_at desc
)
select
  c.group_id,
  c.player_id,
  p.display_name,
  p.avatar_url,
  c.day_result as streak_type,
  c.streak_length,
  -- CREATE OR REPLACE VIEW não permite mudar o tipo de uma coluna
  -- existente: streak_end_at já era timestamptz (max(played_at)) na
  -- versão anterior da view, então convertemos o play_date (date) de
  -- volta pra manter a mesma assinatura de saída.
  c.streak_end_at::timestamptz as streak_end_at
from current_streak c
join public.players p on p.id = c.player_id;

comment on view public.v_player_current_streak is
  'Sequência de Dias de Sol (vitórias > derrotas no dia) ou Dias de Noite (derrotas > vitórias no dia) em andamento — o bloco de dias mais recente, agregado por dia civil no fuso do grupo (v_player_daily_stats). Dias empatados são neutros: não contam nem quebram a sequência.';

grant select on public.v_player_current_streak to authenticated;
