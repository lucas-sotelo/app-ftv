-- =====================================================================
-- 21 — Índice de performance faltante.
--
-- O schema em 20260701000000_init_schema.sql já cobre bem os acessos mais
-- comuns (matches por group_id+played_at, índice parcial de partidas
-- ativas, match_players_player_idx). O gap real: consultas de dupla e de
-- sequência (v_match_sides, v_player_streaks, v_player_current_streak)
-- filtram jogador *e* lado, e hoje só existe índice single-column em
-- player_id. Índices de player_badges ficam na própria migration que cria
-- a tabela (20260701002200), não faz sentido apontar para algo que ainda
-- não existe nesta ordem.
-- =====================================================================

create index if not exists match_players_player_side_idx
  on public.match_players (player_id, side);
