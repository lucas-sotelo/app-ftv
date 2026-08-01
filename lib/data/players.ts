import type { PlayerRow } from "@/lib/supabase/database.types";
import type { Client } from "./types";

export async function listPlayers(
  supabase: Client,
  groupId: string,
  options: { onlyActive?: boolean } = {},
): Promise<PlayerRow[]> {
  let query = supabase
    .from("players")
    .select("*")
    .eq("group_id", groupId)
    .order("sort_order", { ascending: true })
    .order("display_name", { ascending: true });

  if (options.onlyActive) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getPlayer(supabase: Client, playerId: string): Promise<PlayerRow | null> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPlayersByIds(supabase: Client, ids: string[]): Promise<PlayerRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("players").select("*").in("id", ids);
  if (error) throw error;
  return data ?? [];
}

/** Jogador deste grupo vinculado ao usuário autenticado, se existir. */
export async function getMyPlayer(
  supabase: Client,
  groupId: string,
  userId: string,
): Promise<PlayerRow | null> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("group_id", groupId)
    .eq("linked_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
