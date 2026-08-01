import type { Client } from "./types";

/**
 * Conquistas: infraestrutura de exibição. A concessão (player_badges) é
 * escrita exclusivamente pelo servidor — ver
 * supabase/migrations/20260701002200_create_badges.sql. Aqui só se busca e
 * formata, sem calcular nada.
 */
export interface PlayerBadgeEntry {
  badgeId: string;
  key: string;
  icon: string;
  label: string;
  description: string;
  awardedAt: string;
}

interface RawPlayerBadge {
  player_id: string;
  awarded_at: string;
  badges: {
    id: string;
    key: string;
    icon: string;
    label: string;
    description: string;
  } | null;
}

function toEntry(row: RawPlayerBadge): PlayerBadgeEntry | null {
  if (!row.badges) return null;
  return {
    badgeId: row.badges.id,
    key: row.badges.key,
    icon: row.badges.icon,
    label: row.badges.label,
    description: row.badges.description,
    awardedAt: row.awarded_at,
  };
}

export async function fetchPlayerBadges(
  supabase: Client,
  playerId: string,
): Promise<PlayerBadgeEntry[]> {
  const { data, error } = await supabase
    .from("player_badges")
    .select("player_id, awarded_at, badges (id, key, icon, label, description)")
    .eq("player_id", playerId)
    .order("awarded_at", { ascending: false });
  if (error) throw error;
  return ((data as unknown as RawPlayerBadge[]) ?? [])
    .map(toEntry)
    .filter((entry): entry is PlayerBadgeEntry => entry !== null);
}

/** Últimas conquistas de vários jogadores de uma vez, para cards/tabelas de ranking. */
export async function fetchLatestBadgesByPlayer(
  supabase: Client,
  groupId: string,
  playerIds: string[],
  limitPerPlayer = 3,
): Promise<Map<string, PlayerBadgeEntry[]>> {
  if (playerIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("player_badges")
    .select("player_id, awarded_at, badges (id, key, icon, label, description)")
    .eq("group_id", groupId)
    .in("player_id", playerIds)
    .order("awarded_at", { ascending: false });
  if (error) throw error;

  const byPlayer = new Map<string, PlayerBadgeEntry[]>();
  for (const row of (data as unknown as RawPlayerBadge[]) ?? []) {
    const entry = toEntry(row);
    if (!entry) continue;
    const existing = byPlayer.get(row.player_id) ?? [];
    if (existing.length >= limitPerPlayer) continue;
    existing.push(entry);
    byPlayer.set(row.player_id, existing);
  }
  return byPlayer;
}
