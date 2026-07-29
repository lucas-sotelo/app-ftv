/**
 * Números de referência da planilha legada (seção 9 do briefing).
 *
 * São o contrato do produto: qualquer mudança que faça as estatísticas
 * divergirem disto quebra os testes de propósito.
 */

export interface ExpectedPlayer {
  position: number;
  name: string;
  games: number;
  wins: number;
  losses: number;
}

export const EXPECTED_TOTAL_MATCHES = 39;

export const EXPECTED_SESSIONS: Record<string, number> = {
  "2026-07-05": 6,
  "2026-07-14": 6,
  "2026-07-18": 5,
  "2026-07-20": 8,
  "2026-07-22": 7,
  "2026-07-27": 7,
};

export const EXPECTED_PLAYER_RANKING: ExpectedPlayer[] = [
  { position: 1, name: "Sotelo", games: 4, wins: 3, losses: 1 },
  { position: 2, name: "Luis", games: 27, wins: 17, losses: 10 },
  { position: 3, name: "Arthur", games: 5, wins: 3, losses: 2 },
  { position: 4, name: "Alex", games: 34, wins: 19, losses: 15 },
  { position: 5, name: "Léo", games: 27, wins: 14, losses: 13 },
  { position: 6, name: "Ronaldo", games: 33, wins: 13, losses: 20 },
  { position: 7, name: "Daniel", games: 26, wins: 9, losses: 17 },
];

export interface ExpectedPair {
  players: [string, string];
  games: number;
  wins: number;
  losses: number;
}

export const EXPECTED_PAIR_RANKING: ExpectedPair[] = [
  { players: ["Alex", "Arthur"], games: 1, wins: 1, losses: 0 },
  { players: ["Luis", "Arthur"], games: 1, wins: 1, losses: 0 },
  { players: ["Léo", "Arthur"], games: 1, wins: 1, losses: 0 },
  { players: ["Sotelo", "Léo"], games: 1, wins: 1, losses: 0 },
  { players: ["Sotelo", "Ronaldo"], games: 1, wins: 1, losses: 0 },
  { players: ["Daniel", "Sotelo"], games: 1, wins: 1, losses: 0 },
  { players: ["Luis", "Alex"], games: 7, wins: 6, losses: 1 },
  { players: ["Luis", "Ronaldo"], games: 9, wins: 6, losses: 3 },
  { players: ["Léo", "Alex"], games: 8, wins: 5, losses: 3 },
  { players: ["Daniel", "Léo"], games: 5, wins: 3, losses: 2 },
  { players: ["Luis", "Daniel"], games: 4, wins: 2, losses: 2 },
  { players: ["Daniel", "Alex"], games: 7, wins: 3, losses: 4 },
  { players: ["Ronaldo", "Alex"], games: 10, wins: 4, losses: 6 },
  { players: ["Ronaldo", "Léo"], games: 6, wins: 2, losses: 4 },
  { players: ["Luis", "Léo"], games: 6, wins: 2, losses: 4 },
  { players: ["Daniel", "Ronaldo"], games: 7, wins: 0, losses: 7 },
  { players: ["Daniel", "Arthur"], games: 2, wins: 0, losses: 2 },
  { players: ["Sotelo", "Alex"], games: 1, wins: 0, losses: 1 },
];

export interface ExpectedPlayerDuel {
  players: [string, string];
  games: number;
  wins: [number, number];
}

export const EXPECTED_PLAYER_DUELS: ExpectedPlayerDuel[] = [
  { players: ["Luis", "Daniel"], games: 12, wins: [11, 1] },
  { players: ["Alex", "Luis"], games: 16, wins: [8, 8] },
  { players: ["Arthur", "Ronaldo"], games: 2, wins: [2, 0] },
];

export interface ExpectedPairDuel {
  pair1: [string, string];
  pair2: [string, string];
  games: number;
  wins: [number, number];
}

export const EXPECTED_PAIR_DUELS: ExpectedPairDuel[] = [
  { pair1: ["Luis", "Alex"], pair2: ["Daniel", "Ronaldo"], games: 4, wins: [4, 0] },
  { pair1: ["Ronaldo", "Alex"], pair2: ["Luis", "Léo"], games: 4, wins: [3, 1] },
  { pair1: ["Léo", "Alex"], pair2: ["Luis", "Ronaldo"], games: 4, wins: [2, 2] },
];
