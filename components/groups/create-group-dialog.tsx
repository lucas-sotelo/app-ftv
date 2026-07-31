"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PlayerAvatar } from "@/components/ui/avatar";
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
import { Field, Label } from "@/components/ui/label";
import { createGroupAction, setGroupAvatarAction } from "@/lib/actions/groups";
import { createClient } from "@/lib/supabase/client";
import { createGroupSchema, type CreateGroupInput, type CreateGroupValues } from "@/lib/validations/group";

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Fluxo completo de criação: só o nome é obrigatório, fuso horário nunca
 * aparece aqui (o servidor grava 'America/Sao_Paulo' direto). A foto, se
 * escolhida, só é enviada ao Storage depois que o grupo existe — a policy
 * do bucket exige is_group_admin(group_id), que só passa a valer quando o
 * membro owner já foi criado.
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
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateGroupValues, unknown, CreateGroupInput>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { name: "" },
  });

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setAvatarFile(file);
    setAvatarPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
  }

  React.useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const submit = handleSubmit(async (values) => {
    const result = await createGroupAction(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    if (avatarFile) {
      const supabase = createClient();
      const extension = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${result.data.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("group-avatars")
        .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type || undefined });

      if (uploadError) {
        toast.error("Grupo criado, mas a foto não pôde ser enviada.");
      } else {
        const { data: publicUrl } = supabase.storage.from("group-avatars").getPublicUrl(path);
        const avatarResult = await setGroupAvatarAction(
          result.data.id,
          result.data.slug,
          publicUrl.publicUrl,
        );
        if (!avatarResult.ok) toast.error("Grupo criado, mas a foto não pôde ser salva.");
      }
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-group-avatar-input">Foto do grupo (opcional)</Label>
        <div className="flex items-center gap-3">
          <PlayerAvatar name="?" seed="new-group" imageUrl={avatarPreview} size="lg" />
          <Input
            id="new-group-avatar-input"
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
          />
        </div>
      </div>

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
