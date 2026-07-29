"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { updateGroupSettingsAction } from "@/lib/actions/groups";
import {
  groupSettingsSchema,
  type GroupSettingsInput,
  type GroupSettingsValues,
} from "@/lib/validations/group";

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Bahia",
  "America/Fortaleza",
  "America/Recife",
  "America/Manaus",
  "America/Cuiaba",
  "America/Belem",
  "America/Porto_Velho",
  "America/Rio_Branco",
  "America/Noronha",
];

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

  const timezone = useWatch({ control, name: "timezone" });

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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-timezone">Fuso horário</Label>
        <Select
          value={typeof timezone === "string" ? timezone : "America/Sao_Paulo"}
          onValueChange={(value) => setValue("timezone", value, { shouldDirty: true })}
        >
          <SelectTrigger id="group-timezone">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((zone) => (
              <SelectItem key={zone} value={zone}>
                {zone.replace("America/", "").replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Define o dia de cada rodada e os recortes de período nas estatísticas.
        </p>
      </div>

      <Field
        label="Mínimo de jogos do ranking oficial"
        htmlFor="ranking-min"
        hint="Quem tiver menos jogos fica de fora do ranking oficial, mas continua visível na opção “todos os jogadores”."
        error={errors.rankingMinGames?.message}
      >
        <Input
          id="ranking-min"
          type="number"
          min={1}
          inputMode="numeric"
          aria-invalid={!!errors.rankingMinGames}
          {...register("rankingMinGames")}
        />
      </Field>

      <Button type="submit" disabled={isSubmitting || !isDirty} className="self-start">
        {isSubmitting ? "Salvando…" : "Salvar configurações"}
      </Button>
    </form>
  );
}
