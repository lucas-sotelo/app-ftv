import { describe, expect, it } from "vitest";
import {
  assertValidLineup,
  compareRanking,
  computePairHeadToHead,
  computePairStats,
  computePlayerHeadToHead,
  computePlayerStats,
  filterMatches,
  LineupError,
  pairKey,
  pairMatchupKey,
  pairMembers,
  resolveWinningSide,
  ScoreError,
  type MatchRecord,
  type PlayerRef,
} from "@/lib/stats/domain";

const P = {
  luis: "11111111-1111-4111-8111-111111111111",
  alex: "22222222-2222-4222-8222-222222222222",
  daniel: "33333333-3333-4333-8333-333333333333",
  ronaldo: "44444444-4444-4444-8444-444444444444",
  leo: "55555555-5555-4555-8555-555555555555",
};

const players: PlayerRef[] = [
  { id: P.luis, displayName: "Luis", sortOrder: 0 },
  { id: P.alex, displayName: "Alex", sortOrder: 1 },
  { id: P.daniel, displayName: "Daniel", sortOrder: 2 },
  { id: P.ronaldo, displayName: "Ronaldo", sortOrder: 3 },
  { id: P.leo, displayName: "Léo", sortOrder: 4 },
];

function match(
  overrides: Partial<MatchRecord> & Pick<MatchRecord, "id" | "teamA" | "teamB">,
): MatchRecord {
  return {
    playedAt: new Date("2026-07-05T15:00:00.000Z"),
    winningSide: "A",
    status: "confirmed",
    deletedAt: null,
    sessionId: null,
    ...overrides,
  };
}

describe("identidade canônica de dupla", () => {
  it("independe da ordem dos jogadores", () => {
    expect(pairKey(P.luis, P.alex)).toBe(pairKey(P.alex, P.luis));
  });

  it("recusa dupla com o mesmo jogador duas vezes", () => {
    expect(() => pairKey(P.luis, P.luis)).toThrow();
  });

  it("permite recuperar os dois integrantes", () => {
    const key = pairKey(P.alex, P.luis);
    expect(pairMembers(key).sort()).toEqual([P.luis, P.alex].sort());
  });

  it("gera chave canônica também para confronto entre duplas", () => {
    const a = pairKey(P.luis, P.alex);
    const b = pairKey(P.daniel, P.ronaldo);
    expect(pairMatchupKey(a, b)).toBe(pairMatchupKey(b, a));
  });
});

describe("validação de escalação", () => {
  it("aceita 2x2 com quatro jogadores distintos", () => {
    expect(() => assertValidLineup([P.luis, P.alex], [P.daniel, P.ronaldo])).not.toThrow();
  });

  it("recusa jogador repetido entre os times", () => {
    expect(() => assertValidLineup([P.luis, P.alex], [P.luis, P.ronaldo])).toThrow(LineupError);
  });

  it("recusa jogador repetido no mesmo time", () => {
    expect(() => assertValidLineup([P.luis, P.luis], [P.daniel, P.ronaldo])).toThrow(LineupError);
  });

  it("recusa time com tamanho diferente de 2", () => {
    expect(() => assertValidLineup([P.luis], [P.daniel, P.ronaldo])).toThrow(LineupError);
  });
});

describe("cálculo do vencedor", () => {
  it("deriva do maior placar", () => {
    expect(resolveWinningSide({ teamAScore: 12, teamBScore: 10 })).toBe("A");
    expect(resolveWinningSide({ teamAScore: 8, teamBScore: 15 })).toBe("B");
  });

  it("recusa empate", () => {
    expect(() => resolveWinningSide({ teamAScore: 10, teamBScore: 10 })).toThrow(ScoreError);
  });

  it("recusa apenas um placar preenchido", () => {
    expect(() =>
      resolveWinningSide({ teamAScore: 10, teamBScore: null, winningSide: "A" }),
    ).toThrow(ScoreError);
  });

  it("exige vencedor manual quando não há placar", () => {
    expect(() => resolveWinningSide({ teamAScore: null, teamBScore: null })).toThrow(ScoreError);
    expect(resolveWinningSide({ teamAScore: null, teamBScore: null, winningSide: "B" })).toBe("B");
  });

  it("recusa vencedor manual que contradiz o placar", () => {
    expect(() => resolveWinningSide({ teamAScore: 15, teamBScore: 9, winningSide: "B" })).toThrow(
      ScoreError,
    );
  });
});

describe("estatística individual", () => {
  const matches: MatchRecord[] = [
    match({ id: "m1", teamA: [P.luis, P.alex], teamB: [P.daniel, P.ronaldo], winningSide: "A" }),
    match({ id: "m2", teamA: [P.luis, P.daniel], teamB: [P.alex, P.ronaldo], winningSide: "B" }),
  ];

  it("dá uma vitória a cada jogador do lado vencedor", () => {
    const stats = computePlayerStats(matches, players);
    const luis = stats.find((s) => s.playerId === P.luis)!;
    const alex = stats.find((s) => s.playerId === P.alex)!;

    expect(luis).toMatchObject({ games: 2, wins: 1, losses: 1 });
    expect(alex).toMatchObject({ games: 2, wins: 2, losses: 0 });
    expect(alex.winRate).toBe(1);
  });

  it("respeita o mínimo de jogos", () => {
    const withExtra = [
      ...matches,
      match({ id: "m3", teamA: [P.luis, P.leo], teamB: [P.daniel, P.ronaldo] }),
    ];
    const stats = computePlayerStats(withExtra, players, { minGames: 2 });
    expect(stats.some((s) => s.playerId === P.leo)).toBe(false);
    expect(stats.some((s) => s.playerId === P.luis)).toBe(true);
  });
});

describe("estatística de duplas", () => {
  it("agrupa a mesma dupla independentemente da ordem digitada", () => {
    const matches: MatchRecord[] = [
      match({ id: "m1", teamA: [P.luis, P.alex], teamB: [P.daniel, P.ronaldo], winningSide: "A" }),
      // Mesma dupla, ordem invertida na digitação.
      match({ id: "m2", teamA: [P.alex, P.luis], teamB: [P.daniel, P.leo], winningSide: "B" }),
    ];

    const pairs = computePairStats(matches, players);
    const luisAlex = pairs.find((p) => p.pairKey === pairKey(P.luis, P.alex))!;

    expect(luisAlex).toMatchObject({ games: 2, wins: 1, losses: 1 });
  });

  it("exibe os nomes na ordem de sort_order", () => {
    const matches = [match({ id: "m1", teamA: [P.leo, P.luis], teamB: [P.daniel, P.ronaldo] })];
    const pairs = computePairStats(matches, players);
    const pair = pairs.find((p) => p.pairKey === pairKey(P.luis, P.leo))!;
    // Luis tem sort_order 0, Léo tem 4.
    expect(pair.playerNames).toEqual(["Luis", "Léo"]);
  });
});

describe("confronto individual", () => {
  it("conta apenas adversários, nunca parceiros", () => {
    const matches = [
      match({ id: "m1", teamA: [P.luis, P.alex], teamB: [P.daniel, P.ronaldo], winningSide: "A" }),
    ];

    const duels = computePlayerHeadToHead(matches, players);
    const keys = duels.map((d) => pairKey(d.player1Id, d.player2Id));

    // Luis e Alex jogaram juntos: não existe confronto entre eles.
    expect(keys).not.toContain(pairKey(P.luis, P.alex));
    expect(keys).not.toContain(pairKey(P.daniel, P.ronaldo));
    expect(keys).toContain(pairKey(P.luis, P.daniel));
    expect(duels).toHaveLength(4);
  });

  it("mantém o jogador escolhido como lado principal", () => {
    const matches = [
      match({ id: "m1", teamA: [P.luis, P.alex], teamB: [P.daniel, P.ronaldo], winningSide: "A" }),
    ];

    const duels = computePlayerHeadToHead(matches, players, { perspectivePlayerId: P.daniel });
    expect(duels.every((d) => d.player1Id === P.daniel)).toBe(true);
  });

  it("na visão geral mostra primeiro quem venceu mais", () => {
    const matches = [
      match({ id: "m1", teamA: [P.luis, P.alex], teamB: [P.daniel, P.ronaldo], winningSide: "A" }),
      match({ id: "m2", teamA: [P.luis, P.leo], teamB: [P.daniel, P.ronaldo], winningSide: "A" }),
    ];

    const duel = computePlayerHeadToHead(matches, players).find(
      (d) => pairKey(d.player1Id, d.player2Id) === pairKey(P.luis, P.daniel),
    )!;

    expect(duel.player1Id).toBe(P.luis);
    expect(duel.player1Wins).toBe(2);
    expect(duel.player2Wins).toBe(0);
  });
});

describe("confronto entre duplas", () => {
  it("agrega os dois sentidos no mesmo confronto", () => {
    const matches = [
      match({ id: "m1", teamA: [P.luis, P.alex], teamB: [P.daniel, P.ronaldo], winningSide: "A" }),
      // Mesmo confronto, lados invertidos.
      match({ id: "m2", teamA: [P.daniel, P.ronaldo], teamB: [P.alex, P.luis], winningSide: "A" }),
    ];

    const duels = computePairHeadToHead(matches, players);
    expect(duels).toHaveLength(1);
    expect(duels[0].games).toBe(2);
    expect(duels[0].pair1Wins).toBe(1);
    expect(duels[0].pair2Wins).toBe(1);
  });
});

describe("filtros", () => {
  const matches: MatchRecord[] = [
    match({
      id: "m1",
      teamA: [P.luis, P.alex],
      teamB: [P.daniel, P.ronaldo],
      playedAt: new Date("2026-07-05T15:00:00.000Z"),
    }),
    match({
      id: "m2",
      teamA: [P.luis, P.leo],
      teamB: [P.daniel, P.ronaldo],
      playedAt: new Date("2026-08-05T15:00:00.000Z"),
    }),
  ];

  it("usa intervalo semiaberto [from, to)", () => {
    const filtered = filterMatches(matches, {
      from: new Date("2026-07-01T03:00:00.000Z"),
      to: new Date("2026-08-01T03:00:00.000Z"),
    });
    expect(filtered.map((m) => m.id)).toEqual(["m1"]);
  });

  it("ignora partidas anuladas", () => {
    const voided = [match({ ...matches[0], id: "m3", status: "voided" as const })];
    expect(filterMatches(voided)).toHaveLength(0);
  });

  it("ignora partidas excluídas logicamente", () => {
    const deleted = [match({ ...matches[0], id: "m4", deletedAt: new Date() })];
    expect(filterMatches(deleted)).toHaveLength(0);
  });

  it("filtra por jogador", () => {
    expect(filterMatches(matches, { playerId: P.leo }).map((m) => m.id)).toEqual(["m2"]);
  });
});

describe("critérios de desempate do ranking", () => {
  const base = { winRate: 0.5, games: 10, wins: 5, displayName: "A" };

  it("prioriza aproveitamento", () => {
    expect(compareRanking({ ...base, winRate: 0.6 }, base)).toBeLessThan(0);
  });

  it("em empate de aproveitamento, mais jogos vem antes", () => {
    expect(compareRanking({ ...base, games: 20 }, base)).toBeLessThan(0);
  });

  it("em empate de jogos, mais vitórias vem antes", () => {
    expect(compareRanking({ ...base, wins: 8 }, { ...base, wins: 5 })).toBeLessThan(0);
  });

  it("último critério é o nome, em pt-BR", () => {
    expect(
      compareRanking({ ...base, displayName: "Alex" }, { ...base, displayName: "Zeca" }),
    ).toBeLessThan(0);
    expect(
      compareRanking({ ...base, displayName: "Ávila" }, { ...base, displayName: "Bruno" }),
    ).toBeLessThan(0);
  });
});
