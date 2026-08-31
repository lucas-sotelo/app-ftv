"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { useOnline } from "@/components/pwa/service-worker-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Field, FieldError, Label } from "@/components/ui/label";
import { createMatchAction, updateMatchAction } from "@/lib/actions/matches";
import type { PlayerRow } from "@/lib/supabase/database.types";
import {
  matchFormSchema,
  type MatchFormInput,
  type MatchFormValues,
} from "@/lib/validations/match";
import { cn } from "@/lib/utils";
import { PlayerSelect } from "./player-select";
import { QuickPlayerDialog } from "./quick-player-dialog";

interface MatchFormProps {
  groupId: string;
  slug: string;
  timeZone: string;
  players: PlayerRow[];
  defaultValues: MatchFormInput;
  mode: "create" | "edit";
  matchId?: string;
}

type SlotPath = "teamA.0" | "teamA.1" | "teamB.0" | "teamB.1";

export function MatchForm({
  groupId,
  slug,
  timeZone,
  players: initialPlayers,
  defaultValues,
  mode,
  matchId,
}: MatchFormProps) {
  const router = useRouter();
  const online = useOnline();

  const [players, setPlayers] = React.useState(initialPlayers);
  const [dialogSlot, setDialogSlot] = React.useState<SlotPath | null>(null);
  const [savedCount, setSavedCount] = React.useState(0);
  // Incrementado a cada "Salvar e registrar outra": vira key dos TeamCard
  // para forçar remontagem dos <Select> de jogador. reset() do
  // react-hook-form já limpa o valor internamente, mas o Radix Select fica
  // com o texto do jogador anterior visualmente preso (perde a sincronia ao
  // voltar de um valor real para vazio) — só uma remontagem completa
  // garante que o combobox mostre "Escolher jogador" de verdade.
  const [formInstance, setFormInstance] = React.useState(0);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MatchFormInput, unknown, MatchFormValues>({
    resolver: zodResolver(matchFormSchema),
    defaultValues,
  });

  // useWatch (em vez de watch()) mantém o componente compatível com o
  // React Compiler e evita re-render do formulário inteiro a cada tecla.
  const teamA = useWatch({ control, name: "teamA" });
  const teamB = useWatch({ control, name: "teamB" });
  const scoreA = useWatch({ control, name: "teamAScore" });
  const scoreB = useWatch({ control, name: "teamBScore" });
  const winningSide = useWatch({ control, name: "winningSide" });

  const chosen = [...(teamA ?? []), ...(teamB ?? [])].filter(Boolean) as string[];

  const hasScores =
    scoreA !== null &&
    scoreA !== undefined &&
    scoreA !== "" &&
    scoreB !== null &&
    scoreB !== undefined &&
    scoreB !== "";

  // Com placar, o vencedor é derivado — o seletor manual some para não haver
  // duas fontes de verdade na mesma tela.
  const derivedWinner = hasScores ? (Number(scoreA) > Number(scoreB) ? "A" : "B") : null;

  const submit = async (values: MatchFormValues, registerAnother: boolean) => {
    const ctx = { groupId, slug, timeZone };

    const result =
      mode === "edit" && matchId
        ? await updateMatchAction(ctx, matchId, values)
        : await createMatchAction(ctx, values);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    if (mode === "edit") {
      toast.success("Partida atualizada.");
      router.push(`/${slug}/partidas`);
      router.refresh();
      return;
    }

    setSavedCount((count) => count + 1);

    if (registerAnother) {
      // Mantém a rodada/data e limpa só o que muda de jogo para jogo.
      reset({
        ...defaultValues,
        sessionDate: values.sessionDate,
        teamA: ["", ""] as unknown as MatchFormInput["teamA"],
        teamB: ["", ""] as unknown as MatchFormInput["teamB"],
        teamAScore: null,
        teamBScore: null,
        winningSide: null,
        notes: null,
      });
      setFormInstance((n) => n + 1);
      router.refresh();
      return;
    }

    router.push(`/${slug}/partidas`);
    router.refresh();
  };

  return (
    <>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={handleSubmit((values) => submit(values, false))}
      >
        <Field label="Data da rodada" htmlFor="sessionDate" error={errors.sessionDate?.message}>
          <Input
            id="sessionDate"
            type="date"
            aria-invalid={!!errors.sessionDate}
            {...register("sessionDate")}
          />
        </Field>

        <TeamCard
          key={`A-${formInstance}`}
          title="Time A"
          side="A"
          winner={derivedWinner ?? winningSide ?? null}
          slots={["teamA.0", "teamA.1"]}
          control={control}
          players={players}
          chosen={chosen}
          onCreateNew={setDialogSlot}
          error={errors.teamA?.message ?? errors.teamA?.[0]?.message ?? errors.teamA?.[1]?.message}
        />

        <TeamCard
          key={`B-${formInstance}`}
          title="Time B"
          side="B"
          winner={derivedWinner ?? winningSide ?? null}
          slots={["teamB.0", "teamB.1"]}
          control={control}
          players={players}
          chosen={chosen}
          onCreateNew={setDialogSlot}
          error={errors.teamB?.message ?? errors.teamB?.[0]?.message ?? errors.teamB?.[1]?.message}
        />

        <Card>
          <CardContent className="flex flex-col gap-4 pt-4">
            <div>
              <Label htmlFor="teamAScore">Placar (opcional)</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  id="teamAScore"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="A"
                  className="text-center"
                  aria-label="Placar do time A"
                  aria-invalid={!!errors.teamAScore}
                  {...register("teamAScore")}
                />
                <span aria-hidden className="text-muted-foreground font-semibold">
                  ×
                </span>
                <Input
                  id="teamBScore"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="B"
                  className="text-center"
                  aria-label="Placar do time B"
                  aria-invalid={!!errors.teamBScore}
                  {...register("teamBScore")}
                />
              </div>
              <FieldError>{errors.teamAScore?.message ?? errors.teamBScore?.message}</FieldError>
            </div>

            {hasScores ? (
              <p className="text-court-700 dark:text-court-400 flex items-center gap-1.5 text-sm font-medium">
                <CheckCircle2 className="size-4" aria-hidden />
                Vencedor pelo placar: Time {derivedWinner}
              </p>
            ) : (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">Quem venceu?</legend>
                <div className="flex gap-2">
                  {(["A", "B"] as const).map((side) => (
                    <Button
                      key={side}
                      variant={winningSide === side ? "court" : "outline"}
                      block
                      aria-pressed={winningSide === side}
                      onClick={() => setValue("winningSide", side, { shouldValidate: true })}
                    >
                      Time {side}
                    </Button>
                  ))}
                </div>
                <FieldError>{errors.winningSide?.message}</FieldError>
              </fieldset>
            )}

            <Field label="Observação (opcional)" htmlFor="notes">
              <Textarea id="notes" rows={2} {...register("notes")} />
            </Field>
          </CardContent>
        </Card>

        {!online ? (
          <p className="bg-sand-100 text-secondary-foreground dark:bg-sand-500/20 dark:text-sand-100 flex items-center gap-2 rounded-[var(--radius-app)] p-3 text-sm">
            <WifiOff className="size-4 shrink-0" aria-hidden />
            Sem conexão. A partida só pode ser salva quando a internet voltar — nada fica pendente
            de sincronização.
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" block disabled={isSubmitting || !online}>
            {isSubmitting ? "Salvando…" : mode === "edit" ? "Salvar alterações" : "Salvar partida"}
          </Button>

          {mode === "create" ? (
            <Button
              variant="outline"
              size="lg"
              block
              disabled={isSubmitting || !online}
              onClick={handleSubmit((values) => submit(values, true))}
            >
              Salvar e registrar outra
            </Button>
          ) : null}
        </div>

        {savedCount > 0 ? (
          <p
            role="status"
            className="text-court-700 dark:text-court-400 flex items-center justify-center gap-1.5 text-sm font-medium"
          >
            <CheckCircle2 className="size-4" aria-hidden />
            {savedCount === 1
              ? "1 partida salva nesta rodada."
              : `${savedCount} partidas salvas nesta rodada.`}
          </p>
        ) : null}
      </form>

      <QuickPlayerDialog
        open={dialogSlot !== null}
        onOpenChange={(open) => !open && setDialogSlot(null)}
        groupId={groupId}
        slug={slug}
        onCreated={(player) => {
          setPlayers((current) => [
            ...current,
            {
              id: player.id,
              display_name: player.displayName,
              active: true,
              is_guest: false,
              sort_order: 0,
            } as PlayerRow,
          ]);
          if (dialogSlot) {
            setValue(dialogSlot, player.id, { shouldValidate: true });
          }
        }}
      />
    </>
  );
}

function TeamCard({
  title,
  side,
  winner,
  slots,
  control,
  players,
  chosen,
  onCreateNew,
  error,
}: {
  title: string;
  side: "A" | "B";
  winner: "A" | "B" | null;
  slots: [SlotPath, SlotPath];
  control: ReturnType<typeof useForm<MatchFormInput, unknown, MatchFormValues>>["control"];
  players: PlayerRow[];
  chosen: string[];
  onCreateNew: (slot: SlotPath) => void;
  error?: string;
}) {
  return (
    <Card className={cn(winner === side && "border-court-500 bg-accent/30")}>
      <CardContent className="flex flex-col gap-2 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          {winner === side ? (
            <span className="text-court-700 dark:text-court-400 text-xs font-semibold">
              Vencedor
            </span>
          ) : null}
        </div>

        {slots.map((slot, index) => (
          <Controller
            key={slot}
            name={slot}
            control={control}
            render={({ field }) => (
              <PlayerSelect
                id={slot}
                label={`${title} — jogador ${index + 1}`}
                value={field.value ?? ""}
                onChange={field.onChange}
                players={players}
                takenIds={chosen}
                onCreateNew={() => onCreateNew(slot)}
                invalid={!!error}
              />
            )}
          />
        ))}

        <FieldError>{error}</FieldError>
      </CardContent>
    </Card>
  );
}
