import { z } from "zod";

const uuid = z.uuid({ message: "Selecione um jogador." });

const optionalScore = z
  .union([z.literal(""), z.coerce.number().int().min(0).max(999)])
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .default(null);

export const sessionSchema = z.object({
  playedOn: z.iso.date({ message: "Informe uma data válida." }),
  title: z.string().trim().max(80).nullable().default(null),
  location: z.string().trim().max(120).nullable().default(null),
  notes: z.string().trim().max(500).nullable().default(null),
});

export const matchFormSchema = z
  .object({
    sessionDate: z.iso.date({ message: "Informe a data da rodada." }),
    sessionId: z.uuid().nullable().default(null),
    teamA: z.tuple([uuid, uuid]),
    teamB: z.tuple([uuid, uuid]),
    teamAScore: optionalScore,
    teamBScore: optionalScore,
    winningSide: z.enum(["A", "B"]).nullable().default(null),
    notes: z.string().trim().max(500).nullable().default(null),
  })
  .superRefine((data, ctx) => {
    const all = [...data.teamA, ...data.teamB];
    if (new Set(all).size !== 4) {
      ctx.addIssue({
        code: "custom",
        message: "Um jogador não pode aparecer duas vezes na mesma partida.",
        path: ["teamB"],
      });
    }

    const hasA = data.teamAScore !== null;
    const hasB = data.teamBScore !== null;

    if (hasA !== hasB) {
      ctx.addIssue({
        code: "custom",
        message: "Informe os dois placares ou deixe os dois em branco.",
        path: [hasA ? "teamBScore" : "teamAScore"],
      });
      return;
    }

    if (hasA && hasB) {
      if (data.teamAScore === data.teamBScore) {
        ctx.addIssue({
          code: "custom",
          message: "A partida não pode terminar empatada.",
          path: ["teamBScore"],
        });
      }
      // Com placar o vencedor é derivado; nada a exigir do campo manual.
      return;
    }

    if (!data.winningSide) {
      ctx.addIssue({
        code: "custom",
        message: "Sem placar, escolha qual time venceu.",
        path: ["winningSide"],
      });
    }
  });

export type MatchFormInput = z.input<typeof matchFormSchema>;
export type MatchFormValues = z.output<typeof matchFormSchema>;
export type SessionInput = z.infer<typeof sessionSchema>;
