import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FiltersBar } from "@/components/filters/filters-bar";
import { HeadToHeadList, type HeadToHeadEntry } from "@/components/stats/head-to-head-list";
import { RankingTable, type RankingEntry } from "@/components/stats/ranking-table";
import { StatsTabs } from "@/components/stats/stats-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { getGroupContext } from "@/lib/data/groups";
import { listSessions } from "@/lib/data/matches";
import { listPlayers } from "@/lib/data/players";
import {
  fetchPairHeadToHead,
  fetchPairStats,
  fetchPlayerHeadToHead,
  fetchPlayerStats,
} from "@/lib/data/stats";
import {
  effectiveMinGames,
  parseConfrontoTab,
  parseStatsFilters,
  parseStatsTab,
  resolveFilterPeriod,
  type SearchParamsInput,
} from "@/lib/stats/filters";
import { applySort, parseSort } from "@/lib/stats/sort";
import { createClient } from "@/lib/supabase/server";
import { formatPlainDate, playerLabel } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Estatísticas" };
export const dynamic = "force-dynamic";

const TABS = [
  { value: "individual", label: "Individual" },
  { value: "duplas", label: "Duplas" },
  { value: "confrontos", label: "Confrontos" },
];

const SUB_TABS = [
  { value: "jogadores", label: "Jogador x jogador" },
  { value: "duplas", label: "Dupla x dupla" },
];

function matchesSearch(haystack: string, needle: string) {
  if (!needle) return true;
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("pt-BR");
  return normalize(haystack).includes(normalize(needle));
}

export default async function StatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupSlug: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { groupSlug } = await params;
  const rawSearchParams = await searchParams;

  const filters = parseStatsFilters(rawSearchParams);
  const tab = parseStatsTab(rawSearchParams);
  const subTab = parseConfrontoTab(rawSearchParams);
  const sort = parseSort(rawSearchParams);

  const supabase = await createClient();
  const context = await getGroupContext(supabase, groupSlug);
  if (!context) notFound();

  const { group } = context;
  const basePath = `/${groupSlug}/estatisticas`;
  const period = resolveFilterPeriod(filters, group.timezone);
  const pairMinGames = effectiveMinGames(filters);

  const query = {
    groupId: group.id,
    period,
    sessionId: filters.sessionId,
  };

  const [players, sessions] = await Promise.all([
    listPlayers(supabase, group.id),
    listSessions(supabase, group.id),
  ]);

  const filterProps = {
    filters,
    players: players.map((p) => ({ value: p.id, label: p.display_name })),
    sessions: sessions.map((s) => ({ value: s.id, label: formatPlainDate(s.played_on) })),
  };

  const header = (
    <>
      <h1 className="text-xl font-bold">Estatísticas</h1>
      <StatsTabs
        tabs={TABS}
        active={tab}
        basePath={basePath}
        searchParams={rawSearchParams}
        paramName="aba"
        defaultValue="individual"
        label="Seções de estatística"
      />
      <FiltersBar {...filterProps} showSearch showMinGames={tab === "duplas"} />
      {tab === "duplas" && pairMinGames > 1 ? (
        <p className="text-muted-foreground text-xs">
          Mostrando apenas duplas com {pairMinGames} jogos ou mais. Use os filtros para ver todas.
        </p>
      ) : null}
    </>
  );

  if (tab === "individual") {
    const rows = await fetchPlayerStats(supabase, {
      ...query,
      playerId: filters.playerId,
      minAttendancePercent: group.min_attendance_percent,
    });
    const nicknameByPlayerId = new Map(players.map((p) => [p.id, p.nickname]));

    // Posição, aproveitamento e elegibilidade já vêm prontos do banco — o
    // front só separa em duas listas visuais a partir do boolean pronto,
    // nunca recalcula percentual de presença.
    const filteredRows = rows.filter((row) => matchesSearch(row.display_name, filters.search));
    const mainRows = filteredRows.filter((row) => row.meets_min_attendance);
    const aspiranteRows = filteredRows.filter((row) => !row.meets_min_attendance);
    const lastMainIndex = mainRows.length - 1;

    function toEntry(
      row: (typeof filteredRows)[number],
      options: { emoji?: string | null; showAttendance?: boolean } = {},
    ): RankingEntry {
      const subtitleParts: string[] = [];
      if (!row.active) subtitleParts.push("inativo");
      if (options.showAttendance) {
        subtitleParts.push(`${Math.round(row.attendance_percent)}% de presença`);
      }
      return {
        id: row.player_id,
        position: row.position,
        title: playerLabel(row.display_name, nicknameByPlayerId.get(row.player_id)),
        subtitle: subtitleParts.length > 0 ? subtitleParts.join(" · ") : undefined,
        href: `/${groupSlug}/jogadores/${row.player_id}`,
        avatarSeed: row.player_id,
        avatarUrl: row.avatar_url,
        games: row.games,
        wins: row.wins,
        losses: row.losses,
        winRate: row.win_rate,
        emoji: options.emoji ?? null,
      };
    }

    const mainEntries: RankingEntry[] = mainRows.map((row, index) =>
      toEntry(row, {
        emoji:
          index === 0
            ? group.first_place_emoji
            : index === lastMainIndex && row.games > 0
              ? group.last_place_emoji
              : null,
      }),
    );
    const aspiranteEntries: RankingEntry[] = aspiranteRows.map((row) =>
      toEntry(row, { showAttendance: true }),
    );

    return (
      <div className="flex flex-col gap-4">
        {header}
        {group.min_attendance_percent > 0 ? (
          <p className="text-muted-foreground text-xs">
            Ranking oficial exige pelo menos {group.min_attendance_percent}% de presença. Quem não
            bate isso aparece como aspirante.
          </p>
        ) : null}
        {mainEntries.length === 0 && aspiranteEntries.length === 0 ? (
          <EmptyRanking />
        ) : (
          <>
            {mainEntries.length > 0 ? (
              <RankingTable
                entries={applySort(mainEntries, sort)}
                basePath={basePath}
                searchParams={rawSearchParams}
                sort={sort}
              />
            ) : null}
            {aspiranteEntries.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h2 className="text-base font-bold">Aspirantes ao ranking</h2>
                <RankingTable
                  entries={applySort(aspiranteEntries, sort)}
                  basePath={basePath}
                  searchParams={rawSearchParams}
                  sort={sort}
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  }

  if (tab === "duplas") {
    const rows = await fetchPairStats(supabase, {
      ...query,
      playerId: filters.playerId,
      minGames: pairMinGames,
    });
    const entries: RankingEntry[] = rows
      .filter((row) => matchesSearch(row.player_names.join(" "), filters.search))
      .map((row) => ({
        id: row.pair_key,
        position: row.position,
        title: row.player_names.join(" + "),
        href: `/${groupSlug}/duplas/${encodeURIComponent(row.pair_key)}`,
        games: row.games,
        wins: row.wins,
        losses: row.losses,
        winRate: row.win_rate,
      }));

    return (
      <div className="flex flex-col gap-4">
        {header}
        {entries.length === 0 ? (
          <EmptyRanking />
        ) : (
          <RankingTable
            entries={applySort(entries, sort)}
            basePath={basePath}
            searchParams={rawSearchParams}
            sort={sort}
            nameColumnLabel="Dupla"
            showAvatar={false}
          />
        )}
      </div>
    );
  }

  // ----- Confrontos -----
  const subTabsNav = (
    <StatsTabs
      tabs={SUB_TABS}
      active={subTab}
      basePath={basePath}
      searchParams={{ ...rawSearchParams, aba: "confrontos" }}
      paramName="sub"
      defaultValue="jogadores"
      label="Tipos de confronto"
    />
  );

  if (subTab === "jogadores") {
    const rows = await fetchPlayerHeadToHead(supabase, {
      ...query,
      minGames: 1,
      perspectivePlayerId: filters.playerId,
    });

    const entries: HeadToHeadEntry[] = rows
      .filter((row) => matchesSearch(`${row.player_1_name} ${row.player_2_name}`, filters.search))
      .map((row) => ({
        id: `${row.player_1_id}:${row.player_2_id}`,
        leftLabel: row.player_1_name,
        rightLabel: row.player_2_name,
        leftHref: `/${groupSlug}/jogadores/${row.player_1_id}`,
        rightHref: `/${groupSlug}/jogadores/${row.player_2_id}`,
        games: row.games,
        leftWins: row.player_1_wins,
        rightWins: row.player_2_wins,
        leftRate: row.player_1_win_rate,
        rightRate: row.player_2_win_rate,
      }));

    return (
      <div className="flex flex-col gap-4">
        {header}
        {subTabsNav}
        {entries.length === 0 ? <EmptyRanking /> : <HeadToHeadList entries={entries} />}
      </div>
    );
  }

  const rows = await fetchPairHeadToHead(supabase, { ...query, minGames: 1 });
  const entries: HeadToHeadEntry[] = rows
    .filter((row) =>
      matchesSearch([...row.pair_1_names, ...row.pair_2_names].join(" "), filters.search),
    )
    .map((row) => ({
      id: `${row.pair_1_key}|${row.pair_2_key}`,
      leftLabel: row.pair_1_names.join(" + "),
      rightLabel: row.pair_2_names.join(" + "),
      leftHref: `/${groupSlug}/duplas/${encodeURIComponent(row.pair_1_key)}`,
      rightHref: `/${groupSlug}/duplas/${encodeURIComponent(row.pair_2_key)}`,
      games: row.games,
      leftWins: row.pair_1_wins,
      rightWins: row.pair_2_wins,
      leftRate: row.pair_1_win_rate,
      rightRate: row.pair_2_win_rate,
    }));

  return (
    <div className="flex flex-col gap-4">
      {header}
      {subTabsNav}
      {entries.length === 0 ? <EmptyRanking /> : <HeadToHeadList entries={entries} />}
    </div>
  );
}

function EmptyRanking() {
  return (
    <EmptyState
      icon={<BarChart3 className="size-8" aria-hidden />}
      title="Nada para mostrar ainda"
      description="Nenhuma partida corresponde a esses filtros. Tente ampliar o período ou reduzir o mínimo de jogos."
    />
  );
}
