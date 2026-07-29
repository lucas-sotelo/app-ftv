import { describe, expect, it } from "vitest";
import {
  EXPECTED_PAIR_DUELS,
  EXPECTED_PAIR_RANKING,
  EXPECTED_PLAYER_DUELS,
  EXPECTED_PLAYER_RANKING,
  EXPECTED_SESSIONS,
  EXPECTED_TOTAL_MATCHES,
} from "@/lib/legacy/expected";
import {
  computePairHeadToHead,
  computePairStats,
  computePlayerHeadToHead,
  computePlayerStats,
  pairKey,
} from "@/lib/stats/domain";
import { legacyDataset, legacyFixture, playerId } from "../fixtures/legacy";

/**
 * Paridade com a planilha legada.
 *
 * Estes números são o contrato do produto (seção 9 do briefing). Qualquer
 * mudança nas regras de cálculo que os altere deve quebrar aqui.
 */
const { players, matches } = legacyFixture;

describe("seed legado", () => {
  it("tem 39 partidas em seis datas", () => {
    expect(legacyDataset.matches).toHaveLength(EXPECTED_TOTAL_MATCHES);

    const perDate: Record<string, number> = {};
    for (const match of legacyDataset.matches) {
      perDate[match.played_at] = (perDate[match.played_at] ?? 0) + 1;
    }
    expect(perDate).toEqual(EXPECTED_SESSIONS);
  });

  it("tem apenas os sete jogadores da planilha", () => {
    expect(players.map((p) => p.displayName).sort()).toEqual(
      ["Alex", "Arthur", "Daniel", "Luis", "Léo", "Ronaldo", "Sotelo"].sort(),
    );
  });

  it("toda partida é 2x2 com quatro jogadores distintos", () => {
    for (const match of matches) {
      expect(new Set([...match.teamA, ...match.teamB]).size).toBe(4);
    }
  });
});

describe("ranking individual", () => {
  const stats = computePlayerStats(matches, players);

  it("reproduz exatamente a tabela da planilha", () => {
    expect(
      stats.map((row, index) => ({
        position: index + 1,
        name: row.displayName,
        games: row.games,
        wins: row.wins,
        losses: row.losses,
      })),
    ).toEqual(EXPECTED_PLAYER_RANKING);
  });

  it.each(EXPECTED_PLAYER_RANKING)(
    "$name tem aproveitamento de $wins/$games",
    ({ name, games, wins }) => {
      const row = stats.find((entry) => entry.displayName === name)!;
      expect(row.winRate).toBeCloseTo(wins / games, 12);
    },
  );

  it("soma 156 participações (39 partidas × 4 jogadores)", () => {
    expect(stats.reduce((total, row) => total + row.games, 0)).toBe(EXPECTED_TOTAL_MATCHES * 4);
    expect(stats.reduce((total, row) => total + row.wins, 0)).toBe(EXPECTED_TOTAL_MATCHES * 2);
  });
});

describe("ranking de duplas", () => {
  const pairs = computePairStats(matches, players);

  it("encontra exatamente 18 duplas", () => {
    expect(pairs).toHaveLength(EXPECTED_PAIR_RANKING.length);
  });

  it.each(EXPECTED_PAIR_RANKING)(
    "$players tem $games jogos, $wins vitórias e $losses derrotas",
    ({ players: names, games, wins, losses }) => {
      const key = pairKey(playerId(names[0]), playerId(names[1]));
      const row = pairs.find((entry) => entry.pairKey === key);

      expect(row, `dupla ${names.join(" - ")} não encontrada`).toBeDefined();
      expect(row).toMatchObject({ games, wins, losses });
      expect(row!.winRate).toBeCloseTo(wins / games, 12);
    },
  );

  it("é ordenado por aproveitamento, jogos e vitórias", () => {
    for (let i = 1; i < pairs.length; i += 1) {
      const previous = pairs[i - 1];
      const current = pairs[i];
      if (previous.winRate !== current.winRate) {
        expect(previous.winRate).toBeGreaterThan(current.winRate);
      } else if (previous.games !== current.games) {
        expect(previous.games).toBeGreaterThan(current.games);
      }
    }
  });
});

describe("confrontos individuais", () => {
  const duels = computePlayerHeadToHead(matches, players);

  it.each(EXPECTED_PLAYER_DUELS)("$players: $games jogos", ({ players: names, games, wins }) => {
    const [a, b] = names.map(playerId);
    const row = duels.find((entry) => pairKey(entry.player1Id, entry.player2Id) === pairKey(a, b));

    expect(row, `confronto ${names.join(" x ")} não encontrado`).toBeDefined();
    expect(row!.games).toBe(games);

    const oriented =
      row!.player1Id === a
        ? [row!.player1Wins, row!.player2Wins]
        : [row!.player2Wins, row!.player1Wins];

    expect(oriented).toEqual(wins);
  });

  it("nunca conta parceiros de dupla como confronto", () => {
    for (const match of matches) {
      const partners = [
        pairKey(match.teamA[0], match.teamA[1]),
        pairKey(match.teamB[0], match.teamB[1]),
      ];
      for (const duel of duels) {
        const key = pairKey(duel.player1Id, duel.player2Id);
        if (partners.includes(key)) {
          // Só é problema se esses dois NUNCA se enfrentaram.
          const faced = matches.some(
            (m) =>
              (m.teamA.includes(duel.player1Id) && m.teamB.includes(duel.player2Id)) ||
              (m.teamB.includes(duel.player1Id) && m.teamA.includes(duel.player2Id)),
          );
          expect(faced).toBe(true);
        }
      }
    }
  });
});

describe("confrontos entre duplas", () => {
  const duels = computePairHeadToHead(matches, players);

  it.each(EXPECTED_PAIR_DUELS)("$pair1 x $pair2: $games jogos", ({ pair1, pair2, games, wins }) => {
    const k1 = pairKey(playerId(pair1[0]), playerId(pair1[1]));
    const k2 = pairKey(playerId(pair2[0]), playerId(pair2[1]));

    const row = duels.find(
      (entry) =>
        (entry.pair1Key === k1 && entry.pair2Key === k2) ||
        (entry.pair1Key === k2 && entry.pair2Key === k1),
    );

    expect(row, `confronto de duplas não encontrado`).toBeDefined();
    expect(row!.games).toBe(games);

    const oriented =
      row!.pair1Key === k1 ? [row!.pair1Wins, row!.pair2Wins] : [row!.pair2Wins, row!.pair1Wins];

    expect(oriented).toEqual(wins);
  });
});

describe("partidas anuladas e excluídas", () => {
  it("uma partida anulada sai de todas as estatísticas", () => {
    const withVoid = matches.map((match, index) =>
      index === 0 ? { ...match, status: "voided" as const } : match,
    );

    const before = computePlayerStats(matches, players);
    const after = computePlayerStats(withVoid, players);

    expect(before.reduce((total, row) => total + row.games, 0)).toBe(EXPECTED_TOTAL_MATCHES * 4);
    expect(after.reduce((total, row) => total + row.games, 0)).toBe(
      (EXPECTED_TOTAL_MATCHES - 1) * 4,
    );
  });

  it("uma partida excluída logicamente sai de todas as estatísticas", () => {
    const withDeleted = matches.map((match, index) =>
      index === 0 ? { ...match, deletedAt: new Date() } : match,
    );

    expect(
      computePlayerStats(withDeleted, players).reduce((total, row) => total + row.games, 0),
    ).toBe((EXPECTED_TOTAL_MATCHES - 1) * 4);
  });
});
