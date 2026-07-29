import { ArrowLeft, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getGroupContext, listAudit, listGroupMembers } from "@/lib/data/groups";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Auditoria" };
export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  create: "criou",
  update: "editou",
  void: "anulou",
  soft_delete: "excluiu",
  restore: "restaurou",
  role_change: "alterou papel em",
  join: "entrou em",
  revoke: "revogou",
};

const ENTITY_LABELS: Record<string, string> = {
  match: "partida",
  group: "grupo",
  member: "membro",
  invitation: "convite",
};

export default async function AuditPage({ params }: { params: Promise<{ groupSlug: string }> }) {
  const { groupSlug } = await params;
  const supabase = await createClient();
  const context = await getGroupContext(supabase, groupSlug);
  if (!context) notFound();
  if (!can.viewAudit(context.role)) redirect(`/${groupSlug}/grupo`);

  const [entries, members] = await Promise.all([
    listAudit(supabase, context.group.id, 100),
    listGroupMembers(supabase, context.group.id),
  ]);

  const nameByUser = new Map(members.map((m) => [m.userId, m.displayName]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar para o grupo">
          <Link href={`/${groupSlug}/grupo`}>
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Auditoria</h1>
      </div>

      <p className="text-muted-foreground text-sm">
        Registro de quem criou, editou, anulou ou excluiu partidas, além das mudanças de papel
        administrativo. Partidas excluídas somem das estatísticas, mas continuam aqui.
      </p>

      {entries.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-8" aria-hidden />}
          title="Nada registrado ainda"
          description="As ações administrativas do grupo aparecem aqui."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="bg-card rounded-[var(--radius-app)] border px-3 py-2">
              <p className="text-sm">
                <span className="font-medium">
                  {entry.actor_user_id
                    ? (nameByUser.get(entry.actor_user_id) ?? "Alguém")
                    : "Sistema"}
                </span>{" "}
                {ACTION_LABELS[entry.action] ?? entry.action}{" "}
                {ENTITY_LABELS[entry.entity_type] ?? entry.entity_type}
              </p>
              <p className="text-muted-foreground text-xs">
                {formatDateTime(entry.created_at, context.group.timezone)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
