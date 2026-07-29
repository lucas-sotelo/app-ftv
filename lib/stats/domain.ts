/**
 * Regras de estatística em TypeScript puro.
 *
 * Espelham exatamente as funções SQL de `supabase/migrations/*_stats.sql`.
 * Existem por dois motivos:
 *  - permitir testes unitários rápidos (sem banco) da fixture das 39 partidas;
 *  - dar um oráculo independente contra o qual os testes de integração
 *    comparam o resultado do Postgres.
 *
 * Nada aqui usa nome de jogador como chave — só UUID. Nome é exibição.
 */

export type MatchSide = "A" | "B";
export type MatchStatus = "confirmed" | "voided";

export interface PlayerRef {
  id: string;
  displayName: string;
  sortOrder: number;
}

export interface MatchRecord {
  id: string;
  playedAt: Date;
  sessionId?: string | null;
  /** Exatamente dois ids. A ordem interna é irrelevante para a identidade. */
  teamA: readonly [string, string];
  teamB: readonly [string, string];
  winningSide: MatchSide;
  status?: MatchStatus;
  deletedAt?: Date | null;
}

export interface PlayerStat {
  playerId: string;
  displayName: string;
  sortOrder: number;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface PairStat {
  pairKey: string;
  /** Ids em ordem de exibição (sort_order, nome, id). */
  playerIds: [string, string];
  playerNames: [string, string];
  games: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface PlayerHeadToHead {
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
  games: number;
  player1Wins: number;
  player2Wins: number;
  player1WinRate: number;
  player2WinRate: number;
}

export interface PairHeadToHead {
  pair1Key: string;
  pair1Names: [string, string];
  pair2Key: string;
  pair2Names: [string, string];
  games: number;
  pair1Wins: number;
  pair2Wins: number;
  pair1WinRate: number;
  pair2WinRate: number;
}

export interface StatsFilter {
  from?: Date | null;
  to?: Date | null;
  sessionId?: string | null;
  /** Restringe às partidas em que este jogador participou. */
  playerId?: string | null;
  minGames?: number;
}

// ---------------------------------------------------------------------------
// Identidade canônica
// ---------------------------------------------------------------------------

/**
 * Chave canônica de dupla: independe da ordem em que os jogadores foram
 * digitados. `pairKey(a, b) === pairKey(b, a)` sempre.
 */
export function pairKey(a: string, b: string): string {
  if (a === b) {
    throw new Error("Uma dupla não pode ter o mesmo jogador duas vezes.");
  }
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Chave canônica de um confronto entre duas duplas. */
export function pairMatchupKey(pair1: string, pair2: string): string {
  return pair1 < pair2 ? `${pair1}|${pair2}` : `${pair2}|${pair1}`;
}

export function pairMembers(key: string): [string, string] {
  const [a, b] = key.split(":");
  if (!a || !b) throw new Error(`Chave de dupla inválida: ${key}`);
  return [a, b];
}

// ---------------------------------------------------------------------------
// Validação de escalação e resultado
// ---------------------------------------------------------------------------

export class LineupError extends Error {}

/** Quatro jogadores distintos, dois por lado. */
export function assertValidLineup(teamA: readonly string[], teamB: readonly string[]): void {
  if (teamA.length !== 2 || teamB.length !== 2) {
    throw new LineupError("Cada time precisa de exatamente 2 jogadores.");
  }
  const all = [...teamA, ...teamB];
  if (new Set(all).size !== 4) {
    throw new LineupError("A partida precisa de 4 jogadores distintos.");
  }
}

export class ScoreError extends Error {}

/**
 * Deriva o lado vencedor. Com placar, vence o maior. Sem placar, o vencedor
 * escolhido manualmente é obrigatório. Nunca aceita só um placar preenchido.
 */
export function resolveWinningSide(input: {
  teamAScore?: number | null;
  teamBScore?: number | null;
  winningSide?: MatchSide | null;
}): MatchSide {
  const a = input.teamAScore ?? null;
  const b = input.teamBScore ?? null;

  if ((a === null) !== (b === null)) {
    throw new ScoreError("Informe os dois placares ou nenhum.");
  }

  if (a === null || b === null) {
    if (!input.winningSide) {
      throw new ScoreError("Sem placar, é obrigatório escolher o time vencedor.");
    }
    return input.winningSide;
  }

  if (a === b) {
    throw new ScoreError("A partida não pode terminar empatada.");
  }

  const derived: MatchSide = a > b ? "A" : "B";
  if (input.winningSide && input.winningSide !== derived) {
    throw new ScoreError("O time vencedor não confere com o placar informado.");
  }
  return derived;
}

// ---------------------------------------------------------------------------
// Filtro
// ---------------------------------------------------------------------------

/** Só partidas confirmadas e não excluídas logicamente entram em estatística. */
export function isCountable(match: MatchRecord): boolean {
  return (match.status ?? "confirmed") === "confirmed" && !match.deletedAt;
}

export function filterMatches(matches: readonly MatchRecord[], filter: StatsFilter = {}) {
  return matches.filter((m) => {
    if (!isCountable(m)) return false;
    if (filter.from && m.playedAt.getTime() < filter.from.getTime()) return false;
    // `to` é exclusivo: períodos são intervalos semiabertos [from, to).
    if (filter.to && m.playedAt.getTime() >= filter.to.getTime()) return false;
    if (filter.sessionId && m.sessionId !== filter.sessionId) return false;
    if (filter.playerId && ![...m.teamA, ...m.teamB].includes(filter.playerId)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Ordenação
// ---------------------------------------------------------------------------

/** win_rate desc, games desc, wins desc, display_name asc. */
export function compareRanking(
  a: { winRate: number; games: number; wins: number; displayName: string },
  b: { winRate: number; games: number; wins: number; displayName: string },
): number {
  if (b.winRate !== a.winRate) return b.winRate - a.winRate;
  if (b.games !== a.games) return b.games - a.games;
  if (b.wins !== a.wins) return b.wins - a.wins;
  return a.displayName.localeCompare(b.displayName, "pt-BR");
}

function displayOrder(players: Map<string, PlayerRef>, ids: readonly string[]): [string, string] {
  const sorted = [...ids].sort((x, y) => {
    const px = players.get(x);
    const py = players.get(y);
    const sx = px?.sortOrder ?? 0;
    const sy = py?.sortOrder ?? 0;
    if (sx !== sy) return sx - sy;
    const nx = px?.displayName ?? x;
    const ny = py?.displayName ?? y;
    const byName = nx.localeCompare(ny, "pt-BR");
    if (byName !== 0) return byName;
    return x < y ? -1 : 1;
  });
  return [sorted[0], sorted[1]];
}

function nameOf(players: Map<string, PlayerRef>, id: string): string {
  return players.get(id)?.displayName ?? id;
}

function indexPlayers(players: readonly PlayerRef[]): Map<string, PlayerRef> {
  return new Map(players.map((p) => [p.id, p]));
}

// ---------------------------------------------------------------------------
// 8.1 — Estatística individual
// ---------------------------------------------------------------------------
export function computePlayerStats(
  matches: readonly MatchRecord[],
  players: readonly PlayerRef[],
  filter: StatsFilter = {},
): PlayerStat[] {
  const index = indexPlayers(players);
  const acc = new Map<string, { games: number; wins: number }>();

  for (const match of filterMatches(matches, filter)) {
    const winners = match.winningSide === "A" ? match.teamA : match.teamB;
    const losers = match.winningSide === "A" ? match.teamB : match.teamA;
    for (const id of winners) {
      const cur = acc.get(id) ?? { games: 0, wins: 0 };
      acc.set(id, { games: cur.games + 1, wins: cur.wins + 1 });
    }
    for (const id of losers) {
      const cur = acc.get(id) ?? { games: 0, wins: 0 };
      acc.set(id, { games: cur.games + 1, wins: cur.wins });
    }
  }

  const min = Math.max(filter.minGames ?? 1, 1);
  return [...acc.entries()]
    .filter(([, v]) => v.games >= min)
    .map(([playerId, v]) => ({
      playerId,
      displayName: nameOf(index, playerId),
      sortOrder: index.get(playerId)?.sortOrder ?? 0,
      games: v.games,
      wins: v.wins,
      losses: v.games - v.wins,
      winRate: v.wins / v.games,
    }))
    .sort(compareRanking);
}

// ---------------------------------------------------------------------------
// 8.2 — Estatística de duplas
// ---------------------------------------------------------------------------
export function computePairStats(
  matches: readonly MatchRecord[],
  players: readonly PlayerRef[],
  filter: StatsFilter = {},
): PairStat[] {
  const index = indexPlayers(players);
  const acc = new Map<string, { games: number; wins: number }>();

  for (const match of filterMatches(matches, filter)) {
    for (const side of ["A", "B"] as const) {
      const team = side === "A" ? match.teamA : match.teamB;
      const key = pairKey(team[0], team[1]);
      const cur = acc.get(key) ?? { games: 0, wins: 0 };
      acc.set(key, {
        games: cur.games + 1,
        wins: cur.wins + (match.winningSide === side ? 1 : 0),
      });
    }
  }

  const min = Math.max(filter.minGames ?? 1, 1);
  return [...acc.entries()]
    .filter(([, v]) => v.games >= min)
    .map(([key, v]) => {
      const ids = displayOrder(index, pairMembers(key));
      return {
        pairKey: key,
        playerIds: ids,
        playerNames: [nameOf(index, ids[0]), nameOf(index, ids[1])] as [string, string],
        games: v.games,
        wins: v.wins,
        losses: v.games - v.wins,
        winRate: v.wins / v.games,
      };
    })
    .sort((a, b) => {
      const cmp = compareRanking(
        { ...a, displayName: a.playerNames[0] },
        { ...b, displayName: b.playerNames[0] },
      );
      return cmp !== 0 ? cmp : a.pairKey.localeCompare(b.pairKey);
    });
}

// ---------------------------------------------------------------------------
// 8.3 — Confronto individual
// Parceiros de dupla não contam como confronto entre si.
// ---------------------------------------------------------------------------
export function computePlayerHeadToHead(
  matches: readonly MatchRecord[],
  players: readonly PlayerRef[],
  filter: StatsFilter & { perspectivePlayerId?: string | null } = {},
): PlayerHeadToHead[] {
  const index = indexPlayers(players);
  const acc = new Map<string, { games: number; lowWins: number }>();

  for (const match of filterMatches(matches, filter)) {
    for (const a of match.teamA) {
      for (const b of match.teamB) {
        const key = pairKey(a, b);
        const [low] = pairMembers(key);
        const winnerIsA = match.winningSide === "A";
        const lowWon = (low === a && winnerIsA) || (low === b && !winnerIsA);
        const cur = acc.get(key) ?? { games: 0, lowWins: 0 };
        acc.set(key, { games: cur.games + 1, lowWins: cur.lowWins + (lowWon ? 1 : 0) });
      }
    }
  }

  const min = Math.max(filter.minGames ?? 1, 1);
  const perspective = filter.perspectivePlayerId ?? null;

  return [...acc.entries()]
    .filter(([key, v]) => {
      if (v.games < min) return false;
      if (!perspective) return true;
      return pairMembers(key).includes(perspective);
    })
    .map(([key, v]) => {
      const [low, high] = pairMembers(key);
      const lowWins = v.lowWins;
      const highWins = v.games - v.lowWins;

      // Na página de um jogador, ele é sempre o lado principal.
      // Na visão geral, quem venceu mais aparece primeiro; empate resolve
      // por sort_order e depois por nome.
      let flip: boolean;
      if (perspective) {
        flip = high === perspective;
      } else if (highWins !== lowWins) {
        flip = highWins > lowWins;
      } else {
        const sl = index.get(low)?.sortOrder ?? 0;
        const sh = index.get(high)?.sortOrder ?? 0;
        flip = sh !== sl ? sh < sl : nameOf(index, high) < nameOf(index, low);
      }

      const p1 = flip ? high : low;
      const p2 = flip ? low : high;
      const p1Wins = flip ? highWins : lowWins;
      const p2Wins = flip ? lowWins : highWins;

      return {
        player1Id: p1,
        player1Name: nameOf(index, p1),
        player2Id: p2,
        player2Name: nameOf(index, p2),
        games: v.games,
        player1Wins: p1Wins,
        player2Wins: p2Wins,
        player1WinRate: p1Wins / v.games,
        player2WinRate: p2Wins / v.games,
      };
    })
    .sort(
      (a, b) =>
        b.games - a.games ||
        b.player1WinRate - a.player1WinRate ||
        a.player1Name.localeCompare(b.player1Name, "pt-BR") ||
        a.player2Name.localeCompare(b.player2Name, "pt-BR"),
    );
}

// ---------------------------------------------------------------------------
// 8.4 — Confronto entre duplas
// ---------------------------------------------------------------------------
export function computePairHeadToHead(
  matches: readonly MatchRecord[],
  players: readonly PlayerRef[],
  filter: StatsFilter & { perspectivePair?: readonly string[] | null } = {},
): PairHeadToHead[] {
  const index = indexPlayers(players);
  const acc = new Map<string, { games: number; firstWins: number }>();

  for (const match of filterMatches(matches, filter)) {
    const keyA = pairKey(match.teamA[0], match.teamA[1]);
    const keyB = pairKey(match.teamB[0], match.teamB[1]);
    const matchup = pairMatchupKey(keyA, keyB);
    const first = keyA < keyB ? keyA : keyB;
    const firstWon =
      (first === keyA && match.winningSide === "A") ||
      (first === keyB && match.winningSide === "B");
    const cur = acc.get(matchup) ?? { games: 0, firstWins: 0 };
    acc.set(matchup, { games: cur.games + 1, firstWins: cur.firstWins + (firstWon ? 1 : 0) });
  }

  const min = Math.max(filter.minGames ?? 1, 1);
  const perspective = filter.perspectivePair
    ? pairKey(filter.perspectivePair[0], filter.perspectivePair[1])
    : null;

  return [...acc.entries()]
    .filter(([matchup, v]) => {
      if (v.games < min) return false;
      if (!perspective) return true;
      return matchup.split("|").includes(perspective);
    })
    .map(([matchup, v]) => {
      const [first, second] = matchup.split("|") as [string, string];
      const firstWins = v.firstWins;
      const secondWins = v.games - v.firstWins;

      let flip: boolean;
      if (perspective) {
        flip = second === perspective;
      } else if (secondWins !== firstWins) {
        flip = secondWins > firstWins;
      } else {
        flip = second < first;
      }

      const k1 = flip ? second : first;
      const k2 = flip ? first : second;
      const namesOf = (key: string): [string, string] => {
        const ids = displayOrder(index, pairMembers(key));
        return [nameOf(index, ids[0]), nameOf(index, ids[1])];
      };

      return {
        pair1Key: k1,
        pair1Names: namesOf(k1),
        pair2Key: k2,
        pair2Names: namesOf(k2),
        games: v.games,
        pair1Wins: flip ? secondWins : firstWins,
        pair2Wins: flip ? firstWins : secondWins,
        pair1WinRate: (flip ? secondWins : firstWins) / v.games,
        pair2WinRate: (flip ? firstWins : secondWins) / v.games,
      };
    })
    .sort(
      (a, b) =>
        b.games - a.games ||
        b.pair1WinRate - a.pair1WinRate ||
        a.pair1Names[0].localeCompare(b.pair1Names[0], "pt-BR"),
    );
}
