import { z } from "zod";

/**
 * Mesma normalização do banco (`public.normalize_player_name`): trim, colapso
 * de espaços e comparação sem caixa. Acentos são preservados na exibição.
 */
export function normalizePlayerName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function cleanDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export const playerSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Informe o nome do jogador.")
    .max(40, "Nome muito longo.")
    .transform(cleanDisplayName),
  isGuest: z.boolean(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  linkedUserId: z.uuid().nullable(),
});

export const quickPlayerSchema = playerSchema.pick({ displayName: true, isGuest: true });

export type PlayerValues = z.input<typeof playerSchema>;
export type PlayerInput = z.output<typeof playerSchema>;
export type QuickPlayerInput = z.output<typeof quickPlayerSchema>;
