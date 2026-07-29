"use client";

import { Copy, Link2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createInvitationAction, revokeInvitationAction } from "@/lib/actions/groups";
import type { InvitationRow } from "@/lib/supabase/database.types";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDate } from "@/lib/utils/format";

function inviteUrl(appUrl: string, code: string) {
  return `${appUrl.replace(/\/$/, "")}/convite/${code}`;
}

function statusOf(invitation: InvitationRow): {
  label: string;
  variant: "default" | "danger" | "warning";
} {
  if (invitation.revoked_at) return { label: "Revogado", variant: "danger" };
  if (invitation.expires_at && new Date(invitation.expires_at) <= new Date()) {
    return { label: "Expirado", variant: "warning" };
  }
  if (invitation.max_uses !== null && invitation.use_count >= invitation.max_uses) {
    return { label: "Esgotado", variant: "warning" };
  }
  return { label: "Ativo", variant: "default" };
}

export function InvitationsPanel({
  invitations,
  groupId,
  slug,
  appUrl,
}: {
  invitations: InvitationRow[];
  groupId: string;
  slug: string;
  appUrl: string;
}) {
  const router = useRouter();
  const [role, setRole] = React.useState<"admin" | "member">("member");
  const [expires, setExpires] = React.useState<string>("30");
  const [pending, setPending] = React.useState(false);

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card flex flex-col gap-3 rounded-[var(--radius-app)] border p-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-role">Papel</Label>
            <Select value={role} onValueChange={(value) => setRole(value as "admin" | "member")}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">{ROLE_LABELS.member}</SelectItem>
                <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-expires">Validade</Label>
            <Select value={expires} onValueChange={setExpires}>
              <SelectTrigger id="invite-expires">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 dia</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="365">1 ano</SelectItem>
                <SelectItem value="nunca">Sem validade</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          Convites nunca concedem propriedade do grupo — isso só o proprietário pode transferir.
        </p>

        <Button
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              const result = await createInvitationAction(groupId, slug, {
                role,
                expiresInDays: expires === "nunca" ? null : Number(expires),
                maxUses: null,
              });
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              await copy(inviteUrl(appUrl, result.data.code), "Link do convite copiado.");
              router.refresh();
            } finally {
              setPending(false);
            }
          }}
        >
          <Plus aria-hidden />
          {pending ? "Gerando…" : "Gerar convite"}
        </Button>
      </div>

      {invitations.length === 0 ? (
        <EmptyState
          icon={<Link2 className="size-8" aria-hidden />}
          title="Nenhum convite gerado"
          description="Gere um convite e mande o link para o pessoal do grupo."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {invitations.map((invitation) => {
            const status = statusOf(invitation);
            const active = status.label === "Ativo";
            return (
              <li
                key={invitation.id}
                className="bg-card flex items-center gap-2 rounded-[var(--radius-app)] border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm font-semibold tracking-wider">
                    {invitation.code}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {ROLE_LABELS[invitation.role]} · {invitation.use_count}{" "}
                    {invitation.use_count === 1 ? "uso" : "usos"}
                    {invitation.expires_at ? ` · até ${formatDate(invitation.expires_at)}` : ""}
                  </p>
                </div>

                <Badge variant={status.variant}>{status.label}</Badge>

                {active ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Copiar link do convite ${invitation.code}`}
                      onClick={() => copy(inviteUrl(appUrl, invitation.code), "Link copiado.")}
                    >
                      <Copy aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const result = await revokeInvitationAction(invitation.id, slug);
                        if (!result.ok) {
                          toast.error(result.error);
                          return;
                        }
                        toast.success("Convite revogado.");
                        router.refresh();
                      }}
                    >
                      Revogar
                    </Button>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
