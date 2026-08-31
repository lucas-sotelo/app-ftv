-- =====================================================================
-- 23 — Campeão/Lanterna do mês: histórico completo, mês a mês.
--
-- A versão anterior (componente MonthlyChampionsSection) chamava
-- stats_players filtrando só o mês corrente. O pedido agora é a lista de
-- TODOS os meses que tiveram partida no grupo, cada um com seu próprio
-- campeão e lanterna — então a agregação vira uma view (uma linha por
-- jogador por mês), não mais uma chamada de RPC por mês.
--
-- Mesma regra de elegibilidade do ranking oficial (stats_players):
-- attendance_percent/meets_min_attendance calculados sobre o total de
-- partidas DAQUELE mês (não do grupo inteiro), usando o
-- group.min_attendance_percent vigente. O front escolhe o campeão (maior
-- win_rate elegível) e o lanterna (menor win_rate elegível) de cada mês
-- só particionando a lista já ordenada — mesmo padrão já usado para
-- "Destaques" na home (leader/bestPair via find() num array vindo pronto
-- do banco), nenhum cálculo de estatística no cliente.
-- =====================================================================

create or replace view public.v_player_monthly_stats
with (security_invoker = true) as
with player_month as (
  select
    vp.group_id,
    vp.player_id,
    (date_trunc('month', vp.played_at at time zone g.timezone))::date as month_start,
    g.timezone,
    count(*)::bigint as games,
    count(*) filter (where vp.won)::bigint as wins,
    count(*) filter (where not vp.won)::bigint as losses
  from public.v_match_participants vp
  join public.groups g on g.id = vp.group_id
  group by vp.group_id, vp.player_id, (date_trunc('month', vp.played_at at time zone g.timezone))::date, g.timezone
),
month_totals as (
  select
    vp.group_id,
    (date_trunc('month', vp.played_at at time zone g.timezone))::date as month_start,
    count(distinct vp.match_id)::bigint as total_matches
  from public.v_match_participants vp
  join public.groups g on g.id = vp.group_id
  group by vp.group_id, (date_trunc('month', vp.played_at at time zone g.timezone))::date
)
select
  pm.group_id,
  pm.player_id,
  p.display_name,
  p.nickname,
  p.avatar_url,
  pm.month_start,
  pm.games,
  pm.wins,
  pm.losses,
  (pm.wins::numeric / pm.games) as win_rate,
  mt.total_matches as total_month_matches,
  case
    when mt.total_matches > 0 then (pm.games::numeric / mt.total_matches) * 100
    else 0
  end as attendance_percent,
  (
    mt.total_matches > 0
    and (pm.games::numeric / mt.total_matches) * 100
      >= greatest(coalesce(g.min_attendance_percent, 0), 0)
  ) as meets_min_attendance
from player_month pm
join month_totals mt on mt.group_id = pm.group_id and mt.month_start = pm.month_start
join public.groups g on g.id = pm.group_id
join public.players p on p.id = pm.player_id
order by pm.month_start desc, win_rate desc, pm.games desc, pm.wins desc, p.display_name asc;

comment on view public.v_player_monthly_stats is
  'Uma linha por jogador por mês civil (fuso do grupo) com games/wins/losses/win_rate e a mesma elegibilidade de ranking oficial (attendance_percent/meets_min_attendance) calculada sobre o total de partidas DAQUELE mês. Base do histórico de Campeão/Lanterna do mês.';

grant select on public.v_player_monthly_stats to authenticated;
