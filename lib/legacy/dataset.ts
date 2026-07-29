import { createHash } from "node:crypto";
import type { MatchRecord, PlayerRef } from "@/lib/stats/domain";
import { normalizePlayerName } from "@/lib/validations/player";

export interface LegacyMatch {
  played_at: string;
  winner: [string, string] | string[];
  loser: [string, string] | string[];
}

export interface LegacyDataset {
  group_name: string;
  matches: LegacyMatch[];
}

export const LEGACY_KEY_PREFIX = "legacy:v1";

/**
 * Chave estável de importação.
 *
 * Deriva de data + nomes normalizados dos dois lados + a ocorrência daquele
 * confronto na data. Rodar o import duas vezes não duplica nada, e a chave
 * continua a mesma independentemente dos UUIDs gerados no banco.
 */
export function legacyExternalKey(match: LegacyMatch, occurrence: number): string {
  const side = (names: string[]) => names.map(normalizePlayerName).sort().join("+");
  const raw = `${match.played_at}|${side(match.winner)}|${side(match.loser)}|${occurrence}`;
  const digest = createHash("sha256").update(raw).digest("hex").slice(0, 24);
  return `${LEGACY_KEY_PREFIX}:${digest}`;
}

/** Numera as repetições do mesmo confronto na mesma data. */
export function withOccurrences(
  matches: LegacyMatch[],
): { match: LegacyMatch; occurrence: number }[] {
  const seen = new Map<string, number>();
  return matches.map((match) => {
    const side = (names: string[]) => names.map(normalizePlayerName).sort().join("+");
    const signature = `${match.played_at}|${side(match.winner)}|${side(match.loser)}`;
    const occurrence = seen.get(signature) ?? 0;
    seen.set(signature, occurrence + 1);
    return { match, occurrence };
  });
}

export function legacyPlayerNames(dataset: LegacyDataset): string[] {
  const byNormalized = new Map<string, string>();
  for (const match of dataset.matches) {
    for (const name of [...match.winner, ...match.loser]) {
      const key = normalizePlayerName(name);
      if (!byNormalized.has(key)) byNormalized.set(key, name.trim());
    }
  }
  return [...byNormalized.values()];
}

export function legacyDates(dataset: LegacyDataset): string[] {
  return [...new Set(dataset.matches.map((m) => m.played_at))].sort();
}

/**
 * Converte o JSON legado em registros de domínio, atribuindo UUIDs
 * determinísticos por nome. Usado pelos testes unitários para verificar a
 * paridade com a planilha sem precisar de banco.
 */
export function buildLegacyFixture(
  dataset: LegacyDataset,
  timeZoneOffsetHours = -3,
): { players: PlayerRef[]; matches: MatchRecord[] } {
  const names = legacyPlayerNames(dataset);
  const idByNormalized = new Map<string, string>();
  const players: PlayerRef[] = names.map((name, index) => {
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    idByNormalized.set(normalizePlayerName(name), id);
    return { id, displayName: name, sortOrder: index };
  });

  const idOf = (name: string): string => {
    const id = idByNormalized.get(normalizePlayerName(name));
    if (!id) throw new Error(`Jogador desconhecido no seed legado: ${name}`);
    return id;
  };

  const sessionIdByDate = new Map<string, string>();
  const dates = legacyDates(dataset);
  dates.forEach((date, index) => {
    sessionIdByDate.set(date, `00000000-0000-4000-9000-${String(index + 1).padStart(12, "0")}`);
  });

  const matches: MatchRecord[] = withOccurrences(dataset.matches).map(({ match, occurrence }) => {
    // Meio-dia no fuso do grupo: imune a virada de dia por conversão.
    const playedAt = new Date(`${match.played_at}T12:00:00.000Z`);
    playedAt.setUTCHours(playedAt.getUTCHours() - timeZoneOffsetHours);

    return {
      id: legacyExternalKey(match, occurrence),
      playedAt,
      sessionId: sessionIdByDate.get(match.played_at) ?? null,
      // O lado A é sempre o vencedor no dado legado — a planilha só guardava
      // "quem ganhou x quem perdeu", sem placar.
      teamA: [idOf(match.winner[0]), idOf(match.winner[1])] as [string, string],
      teamB: [idOf(match.loser[0]), idOf(match.loser[1])] as [string, string],
      winningSide: "A" as const,
      status: "confirmed" as const,
      deletedAt: null,
    };
  });

  return { players, matches };
}
