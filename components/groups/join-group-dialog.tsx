"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
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
import { joinGroupAction } from "@/lib/actions/groups";
import { joinGroupSchema, type JoinGroupInput, type JoinGroupValues } from "@/lib/validations/group";

interface JoinGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCode?: string;
}

export function JoinGroupDialog({ open, onOpenChange, initialCode = "" }: JoinGroupDialogProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JoinGroupValues, unknown, JoinGroupInput>({
    resolver: zodResolver(joinGroupSchema),
    defaultValues: { code: initialCode },
  });

  const submit = handleSubmit(async (values) => {
    const result = await joinGroupAction(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Você entrou no grupo!");
    onOpenChange(false);
    router.push(`/${result.data.slug}`);
    router.refresh();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrar com código</DialogTitle>
          <DialogDescription>Cole o código que o administrador do grupo enviou.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" noValidate onSubmit={submit}>
          <Field label="Código do convite" htmlFor="invite-code" error={errors.code?.message}>
            <Input
              id="invite-code"
              placeholder="ABC123XYZ"
              autoFocus
              autoCapitalize="characters"
              className="font-mono tracking-widest uppercase"
              aria-invalid={!!errors.code}
              {...register("code")}
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
              {isSubmitting ? "Entrando…" : "Entrar no grupo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
