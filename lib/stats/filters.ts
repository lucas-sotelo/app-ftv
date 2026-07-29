import {
  isPeriodPreset,
  resolvePeriod,
  type PeriodPreset,
  type ResolvedPeriod,
} from "@/lib/utils/period";

/**
 * Estado dos filtros de estatística.
 *
 * Ele vive na URL (query params) para que um ranking filtrado possa ser
 * compartilhado por link e para que voltar/avançar do navegador funcione.
 */
export interface StatsFilters {
  period: PeriodPreset;
  from: string | null;
  to: string | null;
  playerId: string | null;
  sessionId: string | null;
  /** null = usar o mínimo oficial do grupo. */
  minGames: number | null;
  search: string;
}

export const STATS_TABS = ["individual", "duplas", "confrontos"] as const;
export type StatsTab = (typeof STATS_TABS)[number];

export const CONFRONTO_TABS = ["jogadores", "duplas"] as const;
export type ConfrontoTab = (typeof CONFRONTO_TABS)[number];

export type SearchParamsInput = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseStatsFilters(params: SearchParamsInput): StatsFilters {
  const rawPeriod = single(params.periodo);
  const period: PeriodPreset = isPeriodPreset(rawPeriod) ? rawPeriod : "all";

  const from = single(params.de);
  const to = single(params.ate);
  const playerId = single(params.jogador);
  const sessionId = single(params.rodada);
  const rawMin = single(params.min);

  let minGames: number | null = null;
  if (rawMin === "todos") minGames = 1;
  else if (rawMin && /^\d+$/.test(rawMin)) minGames = Math.max(1, Number(rawMin));

  return {
    period,
    from: from && ISO_DATE.test(from) ? from : null,
    to: to && ISO_DATE.test(to) ? to : null,
    playerId: playerId && UUID.test(playerId) ? playerId : null,
    sessionId: sessionId && UUID.test(sessionId) ? sessionId : null,
    minGames,
    search: (single(params.busca) ?? "").trim(),
  };
}

export function parseStatsTab(params: SearchParamsInput): StatsTab {
  const value = single(params.aba);
  return (STATS_TABS as readonly string[]).includes(value ?? "")
    ? (value as StatsTab)
    : "individual";
}

export function parseConfrontoTab(params: SearchParamsInput): ConfrontoTab {
  const value = single(params.sub);
  return (CONFRONTO_TABS as readonly string[]).includes(value ?? "")
    ? (value as ConfrontoTab)
    : "jogadores";
}

/** Serializa apenas o que difere do padrão — URLs curtas e legíveis. */
export function statsFiltersToParams(
  filters: Partial<StatsFilters> & { tab?: StatsTab; sub?: ConfrontoTab },
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.tab && filters.tab !== "individual") params.set("aba", filters.tab);
  if (filters.sub && filters.sub !== "jogadores") params.set("sub", filters.sub);
  if (filters.period && filters.period !== "all") params.set("periodo", filters.period);
  if (filters.from) params.set("de", filters.from);
  if (filters.to) params.set("ate", filters.to);
  if (filters.playerId) params.set("jogador", filters.playerId);
  if (filters.sessionId) params.set("rodada", filters.sessionId);
  if (filters.minGames != null) params.set("min", String(filters.minGames));
  if (filters.search) params.set("busca", filters.search);
  return params;
}

export function resolveFilterPeriod(filters: StatsFilters, timeZone: string): ResolvedPeriod {
  return resolvePeriod(filters.period, { timeZone, from: filters.from, to: filters.to });
}

/**
 * Mínimo de jogos efetivo: quando o usuário não escolheu nada, vale o mínimo
 * oficial configurado no grupo.
 */
export function effectiveMinGames(filters: StatsFilters, groupMinGames: number): number {
  return Math.max(1, filters.minGames ?? groupMinGames);
}

export function hasActiveFilters(filters: StatsFilters): boolean {
  return (
    filters.period !== "all" ||
    filters.playerId !== null ||
    filters.sessionId !== null ||
    filters.minGames !== null ||
    filters.search !== ""
  );
}
