/**
 * Confere `data/futevolei-legacy-seed.json` contra os números de referência da
 * planilha (seção 9), sem tocar em banco.
 *
 *   npm run verify:legacy
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EXPECTED_PAIR_DUELS,
  EXPECTED_PAIR_RANKING,
  EXPECTED_PLAYER_DUELS,
  EXPECTED_PLAYER_RANKING,
  EXPECTED_SESSIONS,
  EXPECTED_TOTAL_MATCHES,
} from "../lib/legacy/expected";
import { buildLegacyFixture, type LegacyDataset } from "../lib/legacy/dataset";
import {
  computePairHeadToHead,
  computePairStats,
  computePlayerHeadToHead,
  computePlayerStats,
  pairKey,
} from "../lib/stats/domain";
import { formatPercentPrecise } from "../lib/utils/format";

const file = process.argv[2] ?? "data/futevolei-legacy-seed.json";
const dataset = JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8")) as LegacyDataset;
const { players, matches } = buildLegacyFixture(dataset);

const failures: string[] = [];
const check = (label: string, actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(
      `${label}\n    esperado: ${JSON.stringify(expected)}\n    obtido:   ${JSON.stringify(actual)}`,
    );
  }
};

const idByName = new Map(players.map((p) => [p.displayName, p.id]));
const id = (name: string) => {
  const value = idByName.get(name);
  if (!value) throw new Error(`Jogador ausente no seed: ${name}`);
  return value;
};

console.log(`Arquivo: ${file}`);
console.log(`Grupo:   ${dataset.group_name}\n`);

check("Total de partidas", dataset.matches.length, EXPECTED_TOTAL_MATCHES);

const bySession: Record<string, number> = {};
for (const match of dataset.matches) {
  bySession[match.played_at] = (bySession[match.played_at] ?? 0) + 1;
}
check("Partidas por data", bySession, EXPECTED_SESSIONS);

// ---------------------------------------------------------------- individual
const playerStats = computePlayerStats(matches, players);
console.log("Ranking individual");
console.log("  #  Jogador    J   V   D   Aproveitamento");
playerStats.forEach((row, index) => {
  console.log(
    `  ${String(index + 1).padStart(2)} ${row.displayName.padEnd(9)} ${String(row.games).padStart(3)} ${String(row.wins).padStart(3)} ${String(row.losses).padStart(3)}   ${formatPercentPrecise(row.winRate)}`,
  );
});

check(
  "Ranking individual",
  playerStats.map((row, index) => ({
    position: index + 1,
    name: row.displayName,
    games: row.games,
    wins: row.wins,
    losses: row.losses,
  })),
  EXPECTED_PLAYER_RANKING,
);

// --------------------------------------------------------------------- duplas
const pairStats = computePairStats(matches, players);
console.log(`\nRanking de duplas (${pairStats.length})`);
for (const row of pairStats) {
  console.log(
    `  ${row.playerNames.join(" - ").padEnd(20)} ${String(row.games).padStart(3)} ${String(row.wins).padStart(3)} ${String(row.losses).padStart(3)}   ${formatPercentPrecise(row.winRate)}`,
  );
}

check("Quantidade de duplas", pairStats.length, EXPECTED_PAIR_RANKING.length);

for (const expected of EXPECTED_PAIR_RANKING) {
  const key = pairKey(id(expected.players[0]), id(expected.players[1]));
  const actual = pairStats.find((row) => row.pairKey === key);
  check(
    `Dupla ${expected.players.join(" - ")}`,
    actual ? { games: actual.games, wins: actual.wins, losses: actual.losses } : null,
    { games: expected.games, wins: expected.wins, losses: expected.losses },
  );
}

// ---------------------------------------------------------- confrontos 1 x 1
const duels = computePlayerHeadToHead(matches, players);
console.log("\nConfrontos individuais de referência");
for (const expected of EXPECTED_PLAYER_DUELS) {
  const key = pairKey(id(expected.players[0]), id(expected.players[1]));
  const row = duels.find((entry) => pairKey(entry.player1Id, entry.player2Id) === key);
  const oriented = row
    ? row.player1Id === id(expected.players[0])
      ? { games: row.games, wins: [row.player1Wins, row.player2Wins] }
      : { games: row.games, wins: [row.player2Wins, row.player1Wins] }
    : null;

  console.log(
    `  ${expected.players.join(" x ").padEnd(22)} ${oriented ? `${oriented.games} jogos — ${oriented.wins[0]} x ${oriented.wins[1]}` : "ausente"}`,
  );
  check(`Confronto ${expected.players.join(" x ")}`, oriented, {
    games: expected.games,
    wins: expected.wins,
  });
}

// ------------------------------------------------------- confrontos de duplas
const pairDuels = computePairHeadToHead(matches, players);
console.log("\nConfrontos de duplas de referência");
for (const expected of EXPECTED_PAIR_DUELS) {
  const k1 = pairKey(id(expected.pair1[0]), id(expected.pair1[1]));
  const k2 = pairKey(id(expected.pair2[0]), id(expected.pair2[1]));
  const row = pairDuels.find(
    (entry) =>
      (entry.pair1Key === k1 && entry.pair2Key === k2) ||
      (entry.pair1Key === k2 && entry.pair2Key === k1),
  );
  const oriented = row
    ? row.pair1Key === k1
      ? { games: row.games, wins: [row.pair1Wins, row.pair2Wins] }
      : { games: row.games, wins: [row.pair2Wins, row.pair1Wins] }
    : null;

  const label = `${expected.pair1.join("-")} x ${expected.pair2.join("-")}`;
  console.log(
    `  ${label.padEnd(34)} ${oriented ? `${oriented.games} jogos — ${oriented.wins[0]} x ${oriented.wins[1]}` : "ausente"}`,
  );
  check(`Confronto ${label}`, oriented, { games: expected.games, wins: expected.wins });
}

// ---------------------------------------------------------------------- saída
if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} divergência(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("\n✓ O seed legado reproduz exatamente os números da planilha.");
