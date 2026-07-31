"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
import { createGroupAction } from "@/lib/actions/groups";
import { createGroupSchema, type CreateGroupInput, type CreateGroupValues } from "@/lib/validations/group";

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Só o nome é obrigatório; fuso horário nunca aparece aqui (o servidor grava
 * 'America/Sao_Paulo' direto). A foto do grupo é definida depois, na tela de
 * configurações do grupo — não faz parte da criação.
 */
export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar novo grupo</DialogTitle>
          <DialogDescription>
            Você fica como proprietário e pode convidar o resto do pessoal.
          </DialogDescription>
        </DialogHeader>
        <CreateGroupForm onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

function CreateGroupForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateGroupValues, unknown, CreateGroupInput>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { name: "" },
  });

  const submit = handleSubmit(async (values) => {
    const result = await createGroupAction(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Grupo criado!");
    onOpenChange(false);
    router.push(`/${result.data.slug}`);
    router.refresh();
  });

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={submit}>
      <Field label="Nome do grupo" htmlFor="new-group-name" error={errors.name?.message}>
        <Input
          id="new-group-name"
          placeholder="Futevôlei da praia"
          autoFocus
          aria-invalid={!!errors.name}
          {...register("name")}
        />
      </Field>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Criando…" : "Criar grupo"}
        </Button>
      </DialogFooter>
    </form>
  );
}
