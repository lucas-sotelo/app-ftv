import { describe, expect, it } from "vitest";
import {
  effectiveMinGames,
  hasActiveFilters,
  parseConfrontoTab,
  parseStatsFilters,
  parseStatsTab,
  statsFiltersToParams,
} from "@/lib/stats/filters";
import { applySort, nextSortHref, parseSort } from "@/lib/stats/sort";
import { formatDate, formatPercent, formatPlainDate, formatGames } from "@/lib/utils/format";
import { composePlayedAt, todayInZone } from "@/lib/utils/played-at";
import { resolvePeriod } from "@/lib/utils/period";

const TZ = "America/Sao_Paulo";

describe("períodos com fuso do grupo", () => {
  it("todo o período não tem limites", () => {
    expect(resolvePeriod("all", { timeZone: TZ })).toMatchObject({ from: null, to: null });
  });

  it("ano atual começa em 1º de janeiro no fuso do grupo", () => {
    const period = resolvePeriod("year", { timeZone: TZ, now: new Date("2026-07-20T12:00:00Z") });
    // 1º/01/2026 00:00 em São Paulo (UTC-3) = 03:00 UTC.
    expect(period.from?.toISOString()).toBe("2026-01-01T03:00:00.000Z");
    expect(period.to?.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("mês atual cobre exatamente o mês corrente", () => {
    const period = resolvePeriod("month", { timeZone: TZ, now: new Date("2026-07-20T12:00:00Z") });
    expect(period.from?.toISOString()).toBe("2026-07-01T03:00:00.000Z");
    expect(period.to?.toISOString()).toBe("2026-08-01T03:00:00.000Z");
  });

  it("período personalizado inclui o dia final inteiro", () => {
    const period = resolvePeriod("custom", { timeZone: TZ, from: "2026-07-05", to: "2026-07-05" });
    expect(period.from?.toISOString()).toBe("2026-07-05T03:00:00.000Z");
    // `to` é exclusivo: início do dia seguinte, para não perder as partidas
    // da noite do último dia.
    expect(period.to?.toISOString()).toBe("2026-07-06T03:00:00.000Z");
  });

  it("um jogo às 22h do último dia entra no período personalizado", () => {
    const period = resolvePeriod("custom", { timeZone: TZ, from: "2026-07-05", to: "2026-07-05" });
    const lateGame = new Date("2026-07-06T01:00:00.000Z"); // 22h de 05/07 em SP
    expect(lateGame.getTime()).toBeGreaterThanOrEqual(period.from!.getTime());
    expect(lateGame.getTime()).toBeLessThan(period.to!.getTime());
  });
});

describe("instante da partida", () => {
  it("usa meio-dia local para datas passadas", () => {
    const iso = composePlayedAt("2026-07-05", TZ, new Date("2026-07-20T18:00:00Z"));
    expect(iso).toBe("2026-07-05T15:00:00.000Z");
  });

  it("usa o horário real quando a rodada é hoje", () => {
    const now = new Date("2026-07-20T18:30:00Z");
    const today = todayInZone(TZ, now);
    expect(composePlayedAt(today, TZ, now)).toBe(now.toISOString());
  });
});

describe("formatação pt-BR", () => {
  it("mostra datas em dd/MM/yyyy", () => {
    expect(formatDate("2026-07-05T15:00:00.000Z", TZ)).toBe("05/07/2026");
    expect(formatPlainDate("2026-07-05")).toBe("05/07/2026");
  });

  it("uma data pura não muda de dia por causa de fuso", () => {
    expect(formatPlainDate("2026-01-01")).toBe("01/01/2026");
  });

  it("mostra o percentual com vírgula", () => {
    expect(formatPercent(0.629629629)).toBe("63,0%");
    expect(formatPercent(0.75, 2)).toBe("75,00%");
  });

  it("nunca esconde o tamanho da amostra", () => {
    expect(formatGames(1)).toBe("1 jogo");
    expect(formatGames(27)).toBe("27 jogos");
  });
});

describe("filtros na URL", () => {
  it("cai no padrão quando os parâmetros são inválidos", () => {
    const filters = parseStatsFilters({ periodo: "sei-la", jogador: "abc", min: "-5" });
    expect(filters).toMatchObject({ period: "all", playerId: null, minGames: null });
  });

  it("lê período, datas e mínimo", () => {
    const filters = parseStatsFilters({
      periodo: "custom",
      de: "2026-07-01",
      ate: "2026-07-31",
      min: "5",
    });
    expect(filters).toMatchObject({
      period: "custom",
      from: "2026-07-01",
      to: "2026-07-31",
      minGames: 5,
    });
  });

  it("faz round-trip pela query string", () => {
    const filters = parseStatsFilters({ periodo: "year", min: "3", busca: "luis" });
    const params = statsFiltersToParams(filters);
    expect(parseStatsFilters(Object.fromEntries(params))).toMatchObject(filters);
  });

  it("usa 1 (todas as duplas) quando não há escolha explícita", () => {
    const filters = parseStatsFilters({});
    expect(effectiveMinGames(filters)).toBe(1);
    expect(effectiveMinGames(parseStatsFilters({ min: "5" }))).toBe(5);
  });

  it("reconhece as abas", () => {
    expect(parseStatsTab({ aba: "duplas" })).toBe("duplas");
    expect(parseStatsTab({ aba: "inexistente" })).toBe("individual");
    expect(parseConfrontoTab({ sub: "duplas" })).toBe("duplas");
    expect(parseConfrontoTab({})).toBe("jogadores");
  });

  it("detecta filtros ativos", () => {
    expect(hasActiveFilters(parseStatsFilters({}))).toBe(false);
    expect(hasActiveFilters(parseStatsFilters({ periodo: "month" }))).toBe(true);
  });
});

describe("ordenação da tabela", () => {
  const rows = [
    { position: 1, title: "Sotelo", games: 4, wins: 3, losses: 1, winRate: 0.75 },
    { position: 2, title: "Luis", games: 27, wins: 17, losses: 10, winRate: 17 / 27 },
    { position: 3, title: "Arthur", games: 5, wins: 3, losses: 2, winRate: 0.6 },
  ];

  it("por padrão respeita a posição calculada pelo banco", () => {
    expect(applySort(rows, parseSort({})).map((r) => r.title)).toEqual([
      "Sotelo",
      "Luis",
      "Arthur",
    ]);
  });

  it("ordena por jogos", () => {
    const sorted = applySort(rows, parseSort({ ordem: "jogos", dir: "desc" }));
    expect(sorted.map((r) => r.title)).toEqual(["Luis", "Arthur", "Sotelo"]);
  });

  it("alterna a direção ao clicar na mesma coluna", () => {
    const current = parseSort({ ordem: "jogos", dir: "desc" });
    expect(
      nextSortHref("/g/estatisticas", { ordem: "jogos", dir: "desc" }, current, "jogos"),
    ).toContain("dir=asc");
  });

  it("volta ao ranking oficial ao ordenar por posição", () => {
    const current = parseSort({ ordem: "jogos", dir: "desc" });
    expect(nextSortHref("/g/estatisticas", { ordem: "jogos" }, current, "posicao")).toBe(
      "/g/estatisticas",
    );
  });
});
