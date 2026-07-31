"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Upload } from "lucide-react";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { PlayerAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, Label } from "@/components/ui/label";
import { updateGroupSettingsAction } from "@/lib/actions/groups";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  groupSettingsSchema,
  type GroupSettingsInput,
  type GroupSettingsValues,
} from "@/lib/validations/group";

const FIRST_PLACE_EMOJIS = ["👑", "🥇", "🏆", "🚀"];
const LAST_PLACE_EMOJIS = ["🐢", "⚓", "😴", "🥶", "💩"];

export function GroupSettingsForm({
  groupId,
  slug,
  defaultValues,
}: {
  groupId: string;
  slug: string;
  defaultValues: GroupSettingsInput;
}) {
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<GroupSettingsValues, unknown, GroupSettingsInput>({
    resolver: zodResolver(groupSettingsSchema),
    defaultValues,
  });

  const avatarUrl = useWatch({ control, name: "avatarUrl" });
  const firstPlaceEmoji = useWatch({ control, name: "firstPlaceEmoji" });
  const lastPlaceEmoji = useWatch({ control, name: "lastPlaceEmoji" });

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
        .from("group-avatars")
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (uploadError) {
        toast.error("Não foi possível enviar a foto.");
        return;
      }

      const { data } = supabase.storage.from("group-avatars").getPublicUrl(path);
      setValue("avatarUrl", data.publicUrl, { shouldDirty: true });
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        const result = await updateGroupSettingsAction(groupId, slug, values);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Configurações salvas.");
      })}
    >
      <Field label="Nome do grupo" htmlFor="group-name" error={errors.name?.message}>
        <Input id="group-name" aria-invalid={!!errors.name} {...register("name")} />
      </Field>

      <Field
        label="Percentual mínimo de presença"
        htmlFor="ranking-min-attendance"
        hint="Quem não bater esse percentual de presença aparece como “aspirante ao ranking”, mas continua visível na lista."
        error={errors.minAttendancePercent?.message}
      >
        <div className="flex items-center gap-2">
          <Input
            id="ranking-min-attendance"
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            className="w-24"
            aria-invalid={!!errors.minAttendancePercent}
            {...register("minAttendancePercent")}
          />
          <span className="text-muted-foreground text-sm">%</span>
        </div>
      </Field>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-avatar-input">Foto do grupo</Label>
        <div className="flex items-center gap-3">
          <PlayerAvatar name={defaultValues.name} imageUrl={avatarUrl} size="lg" />
          <div className="flex flex-1 flex-col gap-1.5">
            <input
              ref={fileInputRef}
              id="group-avatar-input"
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
            {!uploading && avatarUrl ? (
              <button
                type="button"
                className="text-destructive w-fit text-xs font-medium hover:underline"
                onClick={() => setValue("avatarUrl", "", { shouldDirty: true })}
              >
                Remover foto
              </button>
            ) : !uploading ? (
              <p className="text-muted-foreground text-xs">
                Sem foto, o grupo usa as iniciais do nome.
              </p>
            ) : null}
          </div>
        </div>
        <FieldError>{errors.avatarUrl?.message}</FieldError>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Emoji do 1º lugar</Label>
          <EmojiGrid
            options={FIRST_PLACE_EMOJIS}
            value={firstPlaceEmoji ?? ""}
            onChange={(emoji) => setValue("firstPlaceEmoji", emoji, { shouldDirty: true })}
          />
          <FieldError>{errors.firstPlaceEmoji?.message}</FieldError>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Emoji do último lugar</Label>
          <EmojiGrid
            options={LAST_PLACE_EMOJIS}
            value={lastPlaceEmoji ?? ""}
            onChange={(emoji) => setValue("lastPlaceEmoji", emoji, { shouldDirty: true })}
          />
          <FieldError>{errors.lastPlaceEmoji?.message}</FieldError>
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting || !isDirty} className="self-start">
        {isSubmitting ? "Salvando…" : "Salvar configurações"}
      </Button>
    </form>
  );
}

function EmojiGrid({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (emoji: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5" role="radiogroup">
      {options.map((emoji) => {
        const selected = value === emoji;
        return (
          <button
            key={emoji}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={emoji}
            onClick={() => onChange(emoji)}
            className={cn(
              "flex h-11 items-center justify-center rounded-[var(--radius-app)] border text-xl transition-colors",
              selected ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted",
            )}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}
