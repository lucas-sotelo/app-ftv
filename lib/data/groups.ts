import type {
  GlobalUserStatsRow,
  GroupRole,
  GroupRow,
  MyRankingPositionRow,
} from "@/lib/supabase/database.types";
import type { Client, GroupContext } from "./types";

export interface UserGroup {
  group: GroupRow;
  role: GroupRole;
}

/** Grupos de que o usuário participa. A RLS já limita o que volta. */
export async function listUserGroups(supabase: Client): Promise<UserGroup[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("role, groups!inner(*)")
    .order("joined_at", { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .map((row) => ({
      role: row.role as GroupRole,
      group: row.groups as unknown as GroupRow,
    }))
    .filter((row): row is UserGroup => Boolean(row.group))
    .sort((a, b) => a.group.name.localeCompare(b.group.name, "pt-BR"));
}

/**
 * Posição do usuário no ranking de cada grupo de que participa, numa única
 * chamada (em vez de uma RPC por grupo). A posição e o boolean de
 * elegibilidade já vêm prontos do banco — ver my_ranking_positions em
 * supabase/migrations/20260701002000_my_ranking_and_current_streak.sql.
 */
export async function fetchMyRankingPositions(
  supabase: Client,
): Promise<Map<string, MyRankingPositionRow>> {
  const { data, error } = await supabase.rpc("my_ranking_positions");
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.group_id, row]));
}

/**
 * Estatísticas globais do usuário (partidas, vitórias, win rate e saldo),
 * somando todos os jogadores vinculados a ele em todos os grupos — ver
 * get_global_user_stats em supabase/migrations/20260803001000_global_user_stats.sql.
 */
export async function fetchGlobalUserStats(
  supabase: Client,
  userId: string,
): Promise<GlobalUserStatsRow | null> {
  const { data, error } = await supabase
    .rpc("get_global_user_stats", { p_user_id: userId })
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Grupo pelo slug + papel do usuário. Devolve null quando o grupo não existe
 * OU quando o usuário não é membro — de fora, os dois casos são iguais.
 */
export async function getGroupContext(
  supabase: Client,
  slug: string,
): Promise<GroupContext | null> {
  const { data: group, error } = await supabase
    .from("groups")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!group) return null;

  // RLS em group_members deixa qualquer membro ler as linhas de TODOS os
  // membros do grupo (necessário para listGroupMembers) — então filtrar só
  // por group_id aqui devolveria uma linha por membro, não a do usuário
  // atual. current_group_role já resolve isso no servidor via auth.uid().
  const { data: role, error: roleError } = await supabase.rpc("current_group_role", {
    target_group_id: group.id,
  });

  if (roleError) throw roleError;
  if (!role) return null;

  return { group, role };
}

export interface GroupMemberEntry {
  userId: string;
  role: GroupRole;
  joinedAt: string;
  displayName: string;
  avatarUrl: string | null;
  linkedPlayerId: string | null;
}

export async function listGroupMembers(
  supabase: Client,
  groupId: string,
): Promise<GroupMemberEntry[]> {
  const { data: members, error } = await supabase
    .from("group_members")
    .select("user_id, role, joined_at")
    .eq("group_id", groupId);

  if (error) throw error;
  const rows = members ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.user_id);

  // profiles não tem FK para group_members (a FK aponta para auth.users),
  // então o join é feito aqui em vez de embedado no PostgREST.
  const [{ data: profiles }, { data: players }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids),
    supabase
      .from("players")
      .select("id, linked_user_id")
      .eq("group_id", groupId)
      .in("linked_user_id", ids),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const playerByUser = new Map(
    (players ?? []).filter((p) => p.linked_user_id).map((p) => [p.linked_user_id as string, p.id]),
  );

  const roleWeight: Record<GroupRole, number> = { owner: 0, admin: 1, member: 2 };

  return rows
    .map((row) => ({
      userId: row.user_id,
      role: row.role as GroupRole,
      joinedAt: row.joined_at,
      displayName: profileById.get(row.user_id)?.display_name ?? "Membro",
      avatarUrl: profileById.get(row.user_id)?.avatar_url ?? null,
      linkedPlayerId: playerByUser.get(row.user_id) ?? null,
    }))
    .sort(
      (a, b) =>
        roleWeight[a.role] - roleWeight[b.role] ||
        a.displayName.localeCompare(b.displayName, "pt-BR"),
    );
}

export async function listInvitations(supabase: Client, groupId: string) {
  const { data, error } = await supabase
    .from("group_invitations")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listAudit(supabase: Client, groupId: string, limit = 50) {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
