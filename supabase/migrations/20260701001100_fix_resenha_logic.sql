-- =====================================================================
-- 11 — Correções de regra de negócio na Resenha.
--
-- 1) v_head_to_head_directed: reescrito para juntar match_players
--    diretamente com mp1.side <> mp2.side explícito, deixando claro que
--    parceiros de dupla (mesmo lado) nunca contam como confronto direto.
-- 2) v_daily_kings / v_daily_lanterns: eram só o líder do último dia.
--    Agora agregam o HISTÓRICO inteiro: quantos dias cada jogador foi
--    Reizinho/Lanterna, ordenado do maior para o menor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 11.1 — Confronto direto direcionado, join explícito por lado oposto.
-- Mesma saída (group_id, attacker_id, victim_id, games, wins, win_rate)
-- de antes, então CREATE OR REPLACE VIEW é seguro aqui.
-- ---------------------------------------------------------------------
create or replace view public.v_head_to_head_directed
with (security_invoker = true) as
with duels as (
  select
    m.group_id,
    mp1.player_id as attacker_id,
    mp2.player_id as victim_id,
    (mp1.side = m.winning_side) as attacker_won
  from public.match_players mp1
  join public.match_players mp2
    on mp2.match_id = mp1.match_id
    and mp1.side <> mp2.side
  join public.v_valid_matches m on m.id = mp1.match_id
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
  'Confronto direto direcionado (atacante x vítima), só entre jogadores em lados opostos (mp1.side <> mp2.side). Parceiros de dupla nunca contam. Base de v_biggest_massacres.';

-- ---------------------------------------------------------------------
-- 11.2 — Reizinho/Lanterna: contagem histórica de dias como líder, não
-- só o último dia. Estrutura de colunas mudou (times_as_king/lantern no
-- lugar de play_date/games/wins/losses), então precisa DROP + CREATE —
-- CREATE OR REPLACE VIEW não permite remover/renomear colunas.
-- ---------------------------------------------------------------------
drop view if exists public.v_daily_kings;

create view public.v_daily_kings
with (security_invoker = true) as
with ranked as (
  select
    pds.group_id,
    pds.play_date,
    pds.player_id,
    rank() over (
      partition by pds.group_id, pds.play_date
      order by pds.wins desc
    ) as rnk
  from public.v_player_daily_stats pds
  where pds.wins > 0
),
leader_days as (
  select group_id, player_id
  from ranked
  where rnk = 1
)
select
  ld.group_id,
  ld.player_id,
  p.display_name,
  p.avatar_url,
  count(*)::bigint as times_as_king
from leader_days ld
join public.players p on p.id = ld.player_id
group by ld.group_id, ld.player_id, p.display_name, p.avatar_url
order by times_as_king desc, p.display_name;

comment on view public.v_daily_kings is
  'Quantos dias civis cada jogador terminou como Reizinho (mais vitórias no dia), ordenado do maior para o menor.';

drop view if exists public.v_daily_lanterns;

create view public.v_daily_lanterns
with (security_invoker = true) as
with ranked as (
  select
    pds.group_id,
    pds.play_date,
    pds.player_id,
    rank() over (
      partition by pds.group_id, pds.play_date
      order by pds.losses desc
    ) as rnk
  from public.v_player_daily_stats pds
  where pds.losses > 0
),
leader_days as (
  select group_id, player_id
  from ranked
  where rnk = 1
)
select
  ld.group_id,
  ld.player_id,
  p.display_name,
  p.avatar_url,
  count(*)::bigint as times_as_lantern
from leader_days ld
join public.players p on p.id = ld.player_id
group by ld.group_id, ld.player_id, p.display_name, p.avatar_url
order by times_as_lantern desc, p.display_name;

comment on view public.v_daily_lanterns is
  'Quantos dias civis cada jogador terminou como Lanterna (mais derrotas no dia), ordenado do maior para o menor.';

-- DROP VIEW derruba os grants — reconceder.
grant select on public.v_daily_kings to authenticated;
grant select on public.v_daily_lanterns to authenticated;
