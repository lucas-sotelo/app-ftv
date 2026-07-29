import type { MatchSide } from "@/lib/supabase/database.types";
import type { Client, MatchListItem, MatchPlayerRef, SessionGroup } from "./types";

const MATCH_SELECT = `
  id, group_id, session_id, played_at, winning_side, team_a_score, team_b_score,
  status, notes, deleted_at, created_by, created_at, updated_at,
  match_players (
    player_id, side, slot,
    players ( id, display_name, sort_order, active, is_guest, avatar_url )
  )
` as const;

interface RawMatch {
  id: string;
  group_id: string;
  session_id: string | null;
  played_at: string;
  winning_side: MatchSide;
  team_a_score: number | null;
  team_b_score: number | null;
  status: "confirmed" | "voided";
  notes: string | null;
  deleted_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  match_players: {
    player_id: string;
    side: MatchSide;
    slot: number;
    players: {
      id: string;
      display_name: string;
      sort_order: number;
      active: boolean;
      is_guest: boolean;
      avatar_url: string | null;
    } | null;
  }[];
}

function toMatchItem(raw: RawMatch): MatchListItem {
  const refs: MatchPlayerRef[] = raw.match_players.map((mp) => ({
    playerId: mp.player_id,
    displayName: mp.players?.display_name ?? "Jogador removido",
    sortOrder: mp.players?.sort_order ?? 0,
    active: mp.players?.active ?? true,
    isGuest: mp.players?.is_guest ?? false,
    avatarUrl: mp.players?.avatar_url ?? null,
    side: mp.side,
    slot: mp.slot,
  }));

  // A ordem de exibição segue sort_order; a identidade da dupla não depende
  // disso, então reordenar aqui é puramente visual.
  const bySide = (side: MatchSide) =>
    refs
      .filter((r) => r.side === side)
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.displayName.localeCompare(b.displayName, "pt-BR") ||
          a.slot - b.slot,
      );

  return {
    id: raw.id,
    groupId: raw.group_id,
    sessionId: raw.session_id,
    playedAt: raw.played_at,
    winningSide: raw.winning_side,
    teamAScore: raw.team_a_score,
    teamBScore: raw.team_b_score,
    status: raw.status,
    notes: raw.notes,
    deletedAt: raw.deleted_at,
    createdBy: raw.created_by,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    teamA: bySide("A"),
    teamB: bySide("B"),
  };
}

export interface MatchQueryOptions {
  from?: string | null;
  to?: string | null;
  playerId?: string | null;
  sessionId?: string | null;
  includeRemoved?: boolean;
  limit?: number;
}

export async function listMatches(
  supabase: Client,
  groupId: string,
  options: MatchQueryOptions = {},
): Promise<MatchListItem[]> {
  let query = supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("group_id", groupId)
    .order("played_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 200);

  if (!options.includeRemoved) {
    query = query.is("deleted_at", null).eq("status", "confirmed");
  }
  if (options.from) query = query.gte("played_at", options.from);
  if (options.to) query = query.lt("played_at", options.to);
  if (options.sessionId) query = query.eq("session_id", options.sessionId);

  const { data, error } = await query;
  if (error) throw error;

  let items = (data as unknown as RawMatch[]).map(toMatchItem);

  // Filtrar por jogador exige olhar a escalação, que já veio embutida.
  if (options.playerId) {
    items = items.filter((m) =>
      [...m.teamA, ...m.teamB].some((p) => p.playerId === options.playerId),
    );
  }

  return items;
}

export async function getMatch(supabase: Client, matchId: string): Promise<MatchListItem | null> {
  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("id", matchId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return toMatchItem(data as unknown as RawMatch);
}

export async function listSessions(supabase: Client, groupId: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("group_id", groupId)
    .order("played_on", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Agrupa o histórico por rodada/data, que é como o pessoal lembra dos jogos. */
export function groupMatchesBySession(
  matches: MatchListItem[],
  sessions: { id: string; played_on: string; title: string | null; location: string | null }[],
  timeZone: string,
): SessionGroup[] {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const buckets = new Map<string, SessionGroup>();

  for (const match of matches) {
    const session = match.sessionId ? sessionById.get(match.sessionId) : undefined;
    const playedOn = session?.played_on ?? isoDateInZone(match.playedAt, timeZone);
    const key = session?.id ?? `data:${playedOn}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        sessionId: session?.id ?? null,
        playedOn,
        title: session?.title ?? null,
        location: session?.location ?? null,
        matches: [],
      };
      buckets.set(key, bucket);
    }
    bucket.matches.push(match);
  }

  return [...buckets.values()].sort((a, b) => b.playedOn.localeCompare(a.playedOn));
}

function isoDateInZone(isoTimestamp: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoTimestamp));
}
