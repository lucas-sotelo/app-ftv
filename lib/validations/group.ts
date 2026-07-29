import { z } from "zod";

export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "O nome do grupo precisa ter pelo menos 2 caracteres.")
    .max(60, "Nome muito longo."),
  timezone: z.string().trim().min(1),
});

export const groupSettingsSchema = z.object({
  name: z.string().trim().min(2, "O nome do grupo precisa ter pelo menos 2 caracteres.").max(60),
  timezone: z.string().trim().min(1),
  rankingMinGames: z.coerce
    .number()
    .int("Use um número inteiro.")
    .min(1, "O mínimo é 1 jogo.")
    .max(999, "Valor muito alto."),
});

export const joinGroupSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, "Informe o código do convite.")
    .max(64)
    .transform((v) => v.toUpperCase()),
});

export const createInvitationSchema = z.object({
  role: z.enum(["admin", "member"], { message: "Papel inválido." }),
  expiresInDays: z.coerce.number().int().min(1).max(365).nullable(),
  maxUses: z.coerce.number().int().min(1).max(999).nullable(),
});

/**
 * `Values` é o que o formulário manipula (entrada), `Input` é o resultado já
 * validado e coagido. Separar os dois evita o clássico conflito de tipos entre
 * React Hook Form e schemas com coerce/default.
 */
export type CreateGroupValues = z.input<typeof createGroupSchema>;
export type CreateGroupInput = z.output<typeof createGroupSchema>;
export type GroupSettingsValues = z.input<typeof groupSettingsSchema>;
export type GroupSettingsInput = z.output<typeof groupSettingsSchema>;
export type JoinGroupValues = z.input<typeof joinGroupSchema>;
export type JoinGroupInput = z.output<typeof joinGroupSchema>;
export type CreateInvitationValues = z.input<typeof createInvitationSchema>;
export type CreateInvitationInput = z.output<typeof createInvitationSchema>;
