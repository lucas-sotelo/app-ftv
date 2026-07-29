import type { GroupRole } from "@/lib/supabase/database.types";

export type { GroupRole };

export const ROLE_LABELS: Record<GroupRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
};

/**
 * Espelho em TypeScript do modelo de permissões que vive na RLS.
 *
 * Serve para esconder o que o usuário não pode fazer — nunca para autorizar.
 * Se alguém contornar a interface, o banco recusa a operação do mesmo jeito.
 */
export function isAdmin(role: GroupRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function isOwner(role: GroupRole | null | undefined): boolean {
  return role === "owner";
}

export const can = {
  manageMatches: isAdmin,
  managePlayers: isAdmin,
  manageSessions: isAdmin,
  manageInvitations: isAdmin,
  editGroupSettings: isAdmin,
  viewAudit: isAdmin,
  manageAdmins: isAdmin,
  manageOwners: isOwner,
  deleteGroup: isOwner,
} as const;

/** Papéis que um admin (não-owner) pode atribuir. */
export const ASSIGNABLE_ROLES_BY_ADMIN: GroupRole[] = ["admin", "member"];
export const ASSIGNABLE_ROLES_BY_OWNER: GroupRole[] = ["owner", "admin", "member"];

export function assignableRoles(actorRole: GroupRole | null | undefined): GroupRole[] {
  if (isOwner(actorRole)) return ASSIGNABLE_ROLES_BY_OWNER;
  if (isAdmin(actorRole)) return ASSIGNABLE_ROLES_BY_ADMIN;
  return [];
}
