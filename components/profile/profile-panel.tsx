"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PlayerAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { signOutAction, updateProfileAction, updateProfileAvatarAction } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { profileSchema, type ProfileInput } from "@/lib/validations/auth";

export function ProfilePanel({
  displayName,
  email,
  avatarUrl,
  groupId,
}: {
  displayName: string;
  email: string;
  avatarUrl: string | null;
  groupId: string;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName },
  });

  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      // crypto.randomUUID() exige contexto seguro (HTTPS/localhost) — em
      // testes na rede local via HTTP (allowedDevOrigins) ele não existe.
      const path = `${groupId}/${Date.now().toString(36)}-${Math.random().toString(36).substring(2)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (uploadError) {
        toast.error("Não foi possível enviar a foto.");
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const result = await updateProfileAvatarAction(data.publicUrl);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sua conta</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-avatar-input">Sua foto</Label>
          <div className="flex items-center gap-3">
            <PlayerAvatar name={displayName} imageUrl={avatarUrl} size="lg" />
            <div className="flex flex-1 flex-col gap-1.5">
              <input
                ref={fileInputRef}
                id="profile-avatar-input"
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={handleAvatarChange}
                className="sr-only"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload aria-hidden />
                {uploading ? "Enviando…" : "Escolher imagem"}
              </Button>
              {!uploading && !avatarUrl ? (
                <p className="text-muted-foreground text-xs">Sem foto, usamos suas iniciais.</p>
              ) : null}
            </div>
          </div>
        </div>

        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={handleSubmit(async (values) => {
            const result = await updateProfileAction(values);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Perfil atualizado.");
            router.refresh();
          })}
        >
          <Field label="Nome" htmlFor="profile-name" error={errors.displayName?.message}>
            <Input
              id="profile-name"
              aria-invalid={!!errors.displayName}
              {...register("displayName")}
            />
          </Field>

          <Field
            label="E-mail"
            htmlFor="profile-email"
            hint="O e-mail de acesso não é alterado por aqui."
          >
            <Input id="profile-email" value={email} readOnly disabled />
          </Field>

          <Button type="submit" disabled={isSubmitting || !isDirty} className="self-start">
            {isSubmitting ? "Salvando…" : "Salvar"}
          </Button>
        </form>

        <form action={signOutAction}>
          <Button type="submit" variant="outline" block>
            <LogOut aria-hidden />
            Sair da conta
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
