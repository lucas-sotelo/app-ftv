import { HeadToHeadList, type HeadToHeadEntry } from "@/components/stats/head-to-head-list";
import { RankingTable, type RankingEntry } from "@/components/stats/ranking-table";
import { BallSpinner } from "@/components/ui/ball-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { fetchLatestBadgesByPlayer } from "@/lib/data/badges";
import {
  fetchPairHeadToHead,
  fetchPairStats,
  fetchPlayerHeadToHead,
  fetchPlayerStats,
} from "@/lib/data/stats";
import type { SearchParamsInput, StatsFilters } from "@/lib/stats/filters";
import { applySort, type SortState } from "@/lib/stats/sort";
import type { Client, GroupRow, PlayerRow } from "@/lib/data/types";
import type { ResolvedPeriod } from "@/lib/utils/period";
import { playerLabel } from "@/lib/utils/format";

export interface StatsTabQuery {
  groupId: string;
  period: ResolvedPeriod;
  sessionId?: string | null;
}

export interface StatsTabBaseProps {
  supabase: Client;
  groupSlug: string;
  basePath: string;
  rawSearchParams: SearchParamsInput;
  sort: SortState;
  query: StatsTabQuery;
  filters: StatsFilters;
}

/** Mesmo critério usado antes de dividir a página em seções assíncronas. */
export function matchesSearch(haystack: string, needle: string) {
  if (!needle) return true;
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("pt-BR");
  return normalize(haystack).includes(normalize(needle));
}

export function EmptyRanking() {
  return (
    <EmptyState
      icon={<BarChart3 className="size-8" aria-hidden />}
      title="Nada para mostrar ainda"
      description="Nenhuma partida corresponde a esses filtros. Tente ampliar o período ou reduzir o mínimo de jogos."
    />
  );
}

export function RankingTabSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center py-2">
        <BallSpinner size={40} />
      </div>
      <ListSkeleton rows={8} />
    </div>
  );
}

export function HeadToHeadTabSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center py-2">
        <BallSpinner size={40} />
      </div>
      <ListSkeleton rows={6} />
    </div>
  );
}

export async function IndividualTabContent({
  supabase,
  groupSlug,
  basePath,
  rawSearchParams,
  sort,
  query,
  filters,
  group,
  players,
}: StatsTabBaseProps & { group: GroupRow; players: PlayerRow[] }) {
  const rows = await fetchPlayerStats(supabase, {
    ...query,
    playerId: filters.playerId,
    minAttendancePercent: group.min_attendance_percent,
  });
  const nicknameByPlayerId = new Map(players.map((p) => [p.id, p.nickname]));
  const badgesByPlayerId = await fetchLatestBadgesByPlayer(
    supabase,
    group.id,
    rows.map((row) => row.player_id),
  );

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
      badges: badgesByPlayerId.get(row.player_id),
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

  if (mainEntries.length === 0 && aspiranteEntries.length === 0) return <EmptyRanking />;

  return (
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
  );
}

export async function DuplasTabContent({
  supabase,
  groupSlug,
  basePath,
  rawSearchParams,
  sort,
  query,
  filters,
  pairMinGames,
}: StatsTabBaseProps & { pairMinGames: number }) {
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

  if (entries.length === 0) return <EmptyRanking />;

  return (
    <RankingTable
      entries={applySort(entries, sort)}
      basePath={basePath}
      searchParams={rawSearchParams}
      sort={sort}
      nameColumnLabel="Dupla"
      showAvatar={false}
    />
  );
}

export async function ConfrontosJogadoresTabContent({
  supabase,
  groupSlug,
  query,
  filters,
}: StatsTabBaseProps) {
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

  return entries.length === 0 ? <EmptyRanking /> : <HeadToHeadList entries={entries} />;
}

export async function ConfrontosDuplasTabContent({
  supabase,
  groupSlug,
  query,
  filters,
}: StatsTabBaseProps) {
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

  return entries.length === 0 ? <EmptyRanking /> : <HeadToHeadList entries={entries} />;
}
