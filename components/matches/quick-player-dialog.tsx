"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createQuickPlayerAction } from "@/lib/actions/players";

interface QuickPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  slug: string;
  onCreated: (player: { id: string; displayName: string }) => void;
}

/**
 * Cadastro rápido de jogador sem sair do fluxo de registro da partida.
 * Inclui a opção "convidado" — é o substituto do antigo marcador genérico
 * "Outro" da planilha, mas com nome de verdade.
 */
export function QuickPlayerDialog({ open, onOpenChange, ...props }: QuickPlayerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo jogador</DialogTitle>
          <DialogDescription>
            O jogador entra no grupo e já fica disponível para escalar.
          </DialogDescription>
        </DialogHeader>
        {/* O conteúdo é desmontado ao fechar, então o formulário nasce limpo
            a cada abertura — sem efeito para "resetar" estado. */}
        <QuickPlayerForm onOpenChange={onOpenChange} {...props} />
      </DialogContent>
    </Dialog>
  );
}

function QuickPlayerForm({
  groupId,
  slug,
  onCreated,
  onOpenChange,
}: Omit<QuickPlayerDialogProps, "open">) {
  const [name, setName] = React.useState("");
  const [isGuest, setIsGuest] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const submit = async () => {
    if (name.trim().length === 0) return;
    setPending(true);
    try {
      const result = await createQuickPlayerAction(groupId, slug, { displayName: name, isGuest });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.displayName} cadastrado.`);
      onCreated({ id: result.data.id, displayName: result.data.displayName });
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Field label="Nome" htmlFor="quick-player-name">
        <Input
          id="quick-player-name"
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
        />
      </Field>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Convidado</p>
          <p className="text-muted-foreground text-xs">
            Alguém que jogou de passagem. Convidados não bloqueiam nomes repetidos.
          </p>
        </div>
        <Switch checked={isGuest} onCheckedChange={setIsGuest} aria-label="Marcar como convidado" />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={pending || name.trim().length === 0}>
          {pending ? "Salvando…" : "Cadastrar"}
        </Button>
      </DialogFooter>
    </>
  );
}
