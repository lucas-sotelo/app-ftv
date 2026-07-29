import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildLegacyFixture, type LegacyDataset } from "@/lib/legacy/dataset";

const raw = readFileSync(resolve(process.cwd(), "data/futevolei-legacy-seed.json"), "utf8");

export const legacyDataset = JSON.parse(raw) as LegacyDataset;
export const legacyFixture = buildLegacyFixture(legacyDataset);

const idByName = new Map(legacyFixture.players.map((p) => [p.displayName, p.id]));

export function playerId(name: string): string {
  const id = idByName.get(name);
  if (!id) throw new Error(`Jogador ausente na fixture legada: ${name}`);
  return id;
}
