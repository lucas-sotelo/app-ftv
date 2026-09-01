"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { deleteGroupAction } from "@/lib/actions/groups";
import { cn } from "@/lib/utils";

/**
 * Só o proprietário chega aqui (checado em app/[groupSlug]/grupo/page.tsx,
 * espelhando can.deleteGroup — a autorização de verdade é a RLS/RPC). Exige
 * digitar o nome do grupo pra confirmar: é uma exclusão definitiva, sem
 * desfazer, de todo o histórico de partidas, jogadores e estatísticas.
 */
export function DeleteGroupSection({ groupId, groupName }: { groupId: string; groupName: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const canConfirm = confirmText.trim() === groupName;

  async function handleDelete() {
    setPending(true);
    try {
      const result = await deleteGroupAction(groupId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Grupo excluído.");
      router.push("/comecar");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Zona de risco</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          Excluir o grupo apaga permanentemente todas as partidas, jogadores, estatísticas e
          convites. Não é possível desfazer.
        </p>
        <Button
          type="button"
          variant="destructive"
          className="self-start"
          onClick={() => setOpen(true)}
        >
          Excluir grupo
        </Button>
      </CardContent>

      <AlertDialog.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmText("");
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <AlertDialog.Content
            className={cn(
              "bg-card fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-app)] border p-4 shadow-lg",
            )}
          >
            <AlertDialog.Title className="text-base font-semibold">
              Excluir “{groupName}”?
            </AlertDialog.Title>
            <AlertDialog.Description className="text-muted-foreground mt-1 text-sm">
              Essa ação é definitiva: todas as partidas, jogadores, estatísticas e convites deste
              grupo somem para sempre, para todo mundo. Pra confirmar, digite o nome do grupo.
            </AlertDialog.Description>

            <div className="mt-3">
              <Field label={`Digite "${groupName}"`} htmlFor="delete-group-confirm">
                <Input
                  id="delete-group-confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                  disabled={pending}
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialog.Cancel asChild>
                <Button variant="outline" disabled={pending}>
                  Cancelar
                </Button>
              </AlertDialog.Cancel>
              <Button
                variant="destructive"
                disabled={pending || !canConfirm}
                onClick={handleDelete}
              >
                {pending ? "Excluindo…" : "Excluir permanentemente"}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </Card>
  );
}
