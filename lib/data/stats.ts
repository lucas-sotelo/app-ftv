import type {
  GroupOverviewRow,
  PairH2HRow,
  PairStatRow,
  PlayerH2HRow,
  PlayerMonthlyStatRow,
  PlayerStatRow,
} from "@/lib/supabase/database.types";
import type { ResolvedPeriod } from "@/lib/utils/period";
import { periodToRpcArgs } from "@/lib/utils/period";
import type { Client } from "./types";

export interface StatsQuery {
  groupId: string;
  period: ResolvedPeriod;
  sessionId?: string | null;
  playerId?: string | null;
  minGames?: number;
}

/**
 * Todas as estatísticas vêm do Postgres. O frontend só formata.
 * As funções são SECURITY INVOKER: quem não é membro não recebe linha alguma.
 */
export async function fetchPlayerStats(
  supabase: Client,
  q: Omit<StatsQuery, "minGames"> & { minAttendancePercent?: number },
): Promise<PlayerStatRow[]> {
  const { data, error } = await supabase.rpc("stats_players", {
    p_group_id: q.groupId,
    ...periodToRpcArgs(q.period),
    p_session_id: q.sessionId ?? null,
    p_player_id: q.playerId ?? null,
    p_min_attendance_percent: q.minAttendancePercent ?? 0,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPairStats(
  supabase: Client,
  q: StatsQuery & { minAttendancePercent?: number },
): Promise<PairStatRow[]> {
  const { data, error } = await supabase.rpc("stats_pairs", {
    p_group_id: q.groupId,
    ...periodToRpcArgs(q.period),
    p_session_id: q.sessionId ?? null,
    p_player_id: q.playerId ?? null,
    p_min_games: q.minGames ?? 1,
    p_min_attendance_percent: q.minAttendancePercent ?? 0,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPlayerHeadToHead(
  supabase: Client,
  q: Omit<StatsQuery, "playerId"> & { perspectivePlayerId?: string | null },
): Promise<PlayerH2HRow[]> {
  const { data, error } = await supabase.rpc("stats_player_head_to_head", {
    p_group_id: q.groupId,
    ...periodToRpcArgs(q.period),
    p_session_id: q.sessionId ?? null,
    p_perspective_player_id: q.perspectivePlayerId ?? null,
    p_min_games: q.minGames ?? 1,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPairHeadToHead(
  supabase: Client,
  q: Omit<StatsQuery, "playerId"> & { perspectivePair?: string[] | null },
): Promise<PairH2HRow[]> {
  const { data, error } = await supabase.rpc("stats_pair_head_to_head", {
    p_group_id: q.groupId,
    ...periodToRpcArgs(q.period),
    p_session_id: q.sessionId ?? null,
    p_perspective_pair: q.perspectivePair ?? null,
    p_min_games: q.minGames ?? 1,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fetchGroupOverview(
  supabase: Client,
  groupId: string,
): Promise<GroupOverviewRow | null> {
  const { data, error } = await supabase.rpc("group_overview", { p_group_id: groupId });
  if (error) throw error;
  return data?.[0] ?? null;
}

/**
 * Uma linha por jogador por mês civil (fuso do grupo), já ordenada por
 * month_start desc e win_rate desc dentro do mês — base do histórico de
 * Campeão/Lanterna do mês. Ver v_player_monthly_stats em
 * supabase/migrations/20260831205641_player_monthly_stats.sql.
 */
export async function fetchPlayerMonthlyStats(
  supabase: Client,
  groupId: string,
): Promise<PlayerMonthlyStatRow[]> {
  const { data, error } = await supabase
    .from("v_player_monthly_stats")
    .select("*")
    .eq("group_id", groupId)
    .order("month_start", { ascending: false })
    .order("win_rate", { ascending: false })
    .order("games", { ascending: false })
    .order("wins", { ascending: false })
    .order("display_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
