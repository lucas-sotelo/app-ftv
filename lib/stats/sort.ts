import type { SearchParamsInput } from "./filters";

export const SORT_KEYS = [
  "posicao",
  "nome",
  "jogos",
  "vitorias",
  "derrotas",
  "aproveitamento",
] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDirection = "asc" | "desc";

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export interface SortableRow {
  position: number;
  title: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
}

export function parseSort(params: SearchParamsInput): SortState {
  const raw = Array.isArray(params.ordem) ? params.ordem[0] : params.ordem;
  const dir = Array.isArray(params.dir) ? params.dir[0] : params.dir;
  const key = (SORT_KEYS as readonly string[]).includes(raw ?? "") ? (raw as SortKey) : "posicao";
  return {
    key,
    direction: dir === "asc" ? "asc" : key === "posicao" || key === "nome" ? "asc" : "desc",
  };
}

/**
 * Ordenação clicável do desktop. `posicao` devolve exatamente a ordem que o
 * Postgres já calculou (win_rate, jogos, vitórias, nome) — é o ranking oficial.
 */
export function applySort<T extends SortableRow>(rows: T[], sort: SortState): T[] {
  const sign = sort.direction === "asc" ? 1 : -1;
  const sorted = [...rows];

  sorted.sort((a, b) => {
    switch (sort.key) {
      case "nome":
        return sign * a.title.localeCompare(b.title, "pt-BR");
      case "jogos":
        return sign * (a.games - b.games);
      case "vitorias":
        return sign * (a.wins - b.wins);
      case "derrotas":
        return sign * (a.losses - b.losses);
      case "aproveitamento":
        return sign * (a.winRate - b.winRate);
      case "posicao":
      default:
        return sign * (a.position - b.position);
    }
  });

  return sorted;
}

/** Alterna a direção ao clicar de novo na mesma coluna. */
export function nextSortHref(
  basePath: string,
  searchParams: SearchParamsInput,
  current: SortState,
  key: SortKey,
): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(searchParams)) {
    if (name === "ordem" || name === "dir") continue;
    const single = Array.isArray(value) ? value[0] : value;
    if (single) params.set(name, single);
  }

  const direction: SortDirection =
    current.key === key && current.direction === "desc" ? "asc" : key === "nome" ? "asc" : "desc";

  if (key !== "posicao") {
    params.set("ordem", key);
    params.set("dir", direction);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
