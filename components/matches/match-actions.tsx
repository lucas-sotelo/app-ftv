"use client";

import { Ban, MoreVertical, Pencil, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteMatchAction, restoreMatchAction, voidMatchAction } from "@/lib/actions/matches";
import type { MatchListItem } from "@/lib/data/types";
import { formatDateTime } from "@/lib/utils/format";

type PendingAction = "void" | "delete" | null;

export function MatchActions({
  match,
  slug,
  timeZone,
  authorName,
}: {
  match: MatchListItem;
  slug: string;
  timeZone: string;
  authorName?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<PendingAction>(null);
  const [showDetails, setShowDetails] = React.useState(false);

  const run = async (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    successMessage: string,
  ) => {
    const result = await fn();
    if (!result.ok) {
      toast.error(result.error ?? "Não foi possível concluir.");
      return;
    }
    toast.success(successMessage);
    router.refresh();
  };

  const removed = match.deletedAt !== null;
  const voided = match.status === "voided";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Ações da partida"
          className="hover:bg-muted flex size-9 items-center justify-center rounded-full"
        >
          <MoreVertical className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/${slug}/partidas/${match.id}/editar`}>
              <Pencil aria-hidden />
              Editar
            </Link>
          </DropdownMenuItem>

          {!voided && !removed ? (
            <DropdownMenuItem onSelect={() => setPending("void")}>
              <Ban aria-hidden />
              Anular
            </DropdownMenuItem>
          ) : null}

          {voided || removed ? (
            <DropdownMenuItem
              onSelect={() => run(() => restoreMatchAction(slug, match.id), "Partida restaurada.")}
            >
              <RotateCcw aria-hidden />
              Restaurar
            </DropdownMenuItem>
          ) : null}

          {!removed ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setPending("delete")}>
              <Trash2 aria-hidden />
              Excluir
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setShowDetails((v) => !v)}>Detalhes</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={pending === "void"}
        onOpenChange={(open) => !open && setPending(null)}
        title="Anular esta partida?"
        description="Ela sai de todas as estatísticas, mas continua visível no histórico marcada como anulada. Dá para restaurar depois."
        confirmLabel="Anular"
        onConfirm={() => run(() => voidMatchAction(slug, match.id), "Partida anulada.")}
      />

      <ConfirmDialog
        open={pending === "delete"}
        onOpenChange={(open) => !open && setPending(null)}
        title="Excluir esta partida?"
        description="É uma exclusão lógica: ela some das estatísticas e da lista, mas fica registrada na auditoria do grupo e pode ser restaurada."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => run(() => deleteMatchAction(slug, match.id), "Partida excluída.")}
      />

      {showDetails ? (
        <p className="text-muted-foreground w-full px-2 pt-1 text-xs">
          Registrada {authorName ? `por ${authorName} ` : ""}em{" "}
          {formatDateTime(match.createdAt, timeZone)}
          {match.updatedAt !== match.createdAt
            ? ` · editada em ${formatDateTime(match.updatedAt, timeZone)}`
            : ""}
        </p>
      ) : null}
    </>
  );
}
