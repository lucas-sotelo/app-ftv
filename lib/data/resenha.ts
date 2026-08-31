import type {
  DailyKingRow,
  DailyLanternRow,
  MassacreRow,
  PairUnderdogRow,
  PlayerStreakRow,
  PlayerSunNightTotalsRow,
} from "@/lib/supabase/database.types";
import type { Client } from "./types";

/**
 * Resenha: estatísticas divertidas do grupo. Tudo já vem pronto das views em
 * supabase/migrations/20260701001000_resenha_stats.sql (com as correções de
 * 20260701001100_fix_resenha_logic.sql e 20260701001200_strict_math_resenha.sql)
 * — o front só busca e formata, sem recalcular nada.
 */

export async function fetchDailyKings(
  supabase: Client,
  groupId: string,
  limit = 5,
): Promise<DailyKingRow[]> {
  const { data, error } = await supabase
    .from("v_daily_kings")
    .select("*")
    .eq("group_id", groupId)
    .order("times_as_king", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchDailyLanterns(
  supabase: Client,
  groupId: string,
  limit = 5,
): Promise<DailyLanternRow[]> {
  const { data, error } = await supabase
    .from("v_daily_lanterns")
    .select("*")
    .eq("group_id", groupId)
    .order("times_as_lantern", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchPlayerStreaks(
  supabase: Client,
  groupId: string,
): Promise<PlayerStreakRow[]> {
  const { data, error } = await supabase
    .from("v_player_streaks")
    .select("*")
    .eq("group_id", groupId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchPairUnderdogs(
  supabase: Client,
  groupId: string,
  limit = 5,
): Promise<PairUnderdogRow[]> {
  const { data, error } = await supabase
    .from("v_pair_underdogs")
    .select("*")
    .eq("group_id", groupId)
    .order("played_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/**
 * Totais históricos de Dias de Sol (mais vitórias que derrotas no dia) e
 * Dias de Noite (mais derrotas que vitórias no dia) de cada jogador — ver
 * v_player_sun_night_totals em
 * supabase/migrations/20260831204107_player_sun_night_totals.sql.
 */
export async function fetchPlayerSunNightTotals(
  supabase: Client,
  groupId: string,
): Promise<PlayerSunNightTotalsRow[]> {
  const { data, error } = await supabase
    .from("v_player_sun_night_totals")
    .select("*")
    .eq("group_id", groupId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchBiggestMassacres(
  supabase: Client,
  groupId: string,
  limit = 5,
): Promise<MassacreRow[]> {
  const { data, error } = await supabase
    .from("v_biggest_massacres")
    .select("*")
    .eq("group_id", groupId)
    .order("win_rate", { ascending: false })
    .order("games", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
