"use client";

import { MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { PlayerAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { removeMemberAction, setMemberRoleAction } from "@/lib/actions/groups";
import type { GroupMemberEntry } from "@/lib/data/groups";
import { assignableRoles, isOwner, ROLE_LABELS } from "@/lib/permissions";
import type { GroupRole } from "@/lib/supabase/database.types";

export function MembersList({
  members,
  groupId,
  slug,
  currentUserId,
  currentRole,
}: {
  members: GroupMemberEntry[];
  groupId: string;
  slug: string;
  currentUserId: string;
  currentRole: GroupRole;
}) {
  const router = useRouter();
  const [removing, setRemoving] = React.useState<GroupMemberEntry | null>(null);
  const roles = assignableRoles(currentRole);

  const changeRole = async (member: GroupMemberEntry, role: GroupRole) => {
    const result = await setMemberRoleAction(groupId, slug, member.userId, role);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${member.displayName} agora é ${ROLE_LABELS[role].toLowerCase()}.`);
    router.refresh();
  };

  return (
    <>
      <ul className="flex flex-col gap-2">
        {members.map((member) => {
          // Owner só é mexido por outro owner — a mesma regra vale na RLS.
          const canManage =
            roles.length > 0 &&
            member.userId !== currentUserId &&
            (member.role !== "owner" || isOwner(currentRole));

          return (
            <li
              key={member.userId}
              className="bg-card flex min-h-14 items-center gap-3 rounded-[var(--radius-app)] border px-3 py-2"
            >
              <PlayerAvatar name={member.displayName} seed={member.userId} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.displayName}
                  {member.userId === currentUserId ? (
                    <span className="text-muted-foreground font-normal"> (você)</span>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-xs">
                  {member.linkedPlayerId ? "Vinculado a um jogador" : "Sem jogador vinculado"}
                </p>
              </div>

              <Badge variant={member.role === "owner" ? "primary" : "default"}>
                {ROLE_LABELS[member.role]}
              </Badge>

              {canManage ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Ações para ${member.displayName}`}
                    className="hover:bg-muted flex size-9 items-center justify-center rounded-full"
                  >
                    <MoreVertical className="size-4" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Papel no grupo</DropdownMenuLabel>
                    {roles.map((role) => (
                      <DropdownMenuItem
                        key={role}
                        disabled={role === member.role}
                        onSelect={() => changeRole(member, role)}
                      >
                        {ROLE_LABELS[role]}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(member)}>
                      Remover do grupo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remover ${removing?.displayName ?? ""}?`}
        description="A pessoa perde o acesso ao grupo. O jogador e o histórico de partidas continuam intactos."
        confirmLabel="Remover"
        destructive
        onConfirm={async () => {
          if (!removing) return;
          const result = await removeMemberAction(groupId, slug, removing.userId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Membro removido.");
          setRemoving(null);
          router.refresh();
        }}
      />
    </>
  );
}
