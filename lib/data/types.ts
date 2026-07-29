import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  GroupRole,
  GroupRow,
  MatchSide,
  PlayerRow,
  SessionRow,
} from "@/lib/supabase/database.types";

export type Client = SupabaseClient<Database>;

export interface GroupContext {
  group: GroupRow;
  role: GroupRole;
}

export interface MatchPlayerRef {
  playerId: string;
  displayName: string;
  sortOrder: number;
  active: boolean;
  isGuest: boolean;
  avatarUrl: string | null;
  side: MatchSide;
  slot: number;
}

export interface MatchListItem {
  id: string;
  groupId: string;
  sessionId: string | null;
  playedAt: string;
  winningSide: MatchSide;
  teamAScore: number | null;
  teamBScore: number | null;
  status: "confirmed" | "voided";
  notes: string | null;
  deletedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  teamA: MatchPlayerRef[];
  teamB: MatchPlayerRef[];
}

export interface SessionGroup {
  sessionId: string | null;
  playedOn: string;
  title: string | null;
  location: string | null;
  matches: MatchListItem[];
}

export type { GroupRow, PlayerRow, SessionRow, GroupRole, MatchSide };
