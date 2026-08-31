-- =====================================================================
-- 22 — "Dias de Sol"/"Dias de Noite" do resumo pessoal da home: totais
-- históricos, não sequência em andamento.
--
-- v_player_current_streak (20260701002300) media a ilha de dias mais
-- recente com predominância de vitórias/derrotas — um streak. O pedido
-- real é uma contagem cumulativa: cada dia civil do jogador soma 1 ponto
-- para "Dia de Sol" (vitórias > derrotas naquele dia) ou 1 ponto para
-- "Dia de Noite" (derrotas > vitórias). Dia empatado não conta para
-- nenhum dos dois — mesmo critério neutro que v_player_current_streak
-- já usava para dias empatados.
--
-- Base: v_player_daily_stats (20260701001200_strict_math_resenha.sql),
-- que já agrupa vitórias/derrotas por jogador por dia civil no fuso do
-- grupo. v_player_current_streak fica sem nenhum consumidor depois desta
-- migration (só era usada no resumo pessoal da home) — removida.
-- =====================================================================

create or replace view public.v_player_sun_night_totals
with (security_invoker = true) as
select
  pds.group_id,
  pds.player_id,
  p.display_name,
  p.avatar_url,
  count(*) filter (where pds.wins > pds.losses)::bigint as sunny_days,
  count(*) filter (where pds.losses > pds.wins)::bigint as night_days
from public.v_player_daily_stats pds
join public.players p on p.id = pds.player_id
group by pds.group_id, pds.player_id, p.display_name, p.avatar_url;

comment on view public.v_player_sun_night_totals is
  'Total histórico de Dias de Sol (dias civis com mais vitórias que derrotas) e Dias de Noite (dias civis com mais derrotas que vitórias) de cada jogador. Dias empatados não contam para nenhum dos dois.';

grant select on public.v_player_sun_night_totals to authenticated;

drop view if exists public.v_player_current_streak;
