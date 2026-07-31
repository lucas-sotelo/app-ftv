import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FiltersBar } from "@/components/filters/filters-bar";
import { MatchCard } from "@/components/matches/match-card";
import { HeadToHeadList, type HeadToHeadEntry } from "@/components/stats/head-to-head-list";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { getGroupContext } from "@/lib/data/groups";
import { listMatches, listSessions } from "@/lib/data/matches";
import { getPlayersByIds, listPlayers } from "@/lib/data/players";
import { fetchPairHeadToHead, fetchPairStats } from "@/lib/data/stats";
import { pairKey as canonicalPairKey } from "@/lib/stats/domain";
import {
  parseStatsFilters,
  resolveFilterPeriod,
  type SearchParamsInput,
} from "@/lib/stats/filters";
import { createClient } from "@/lib/supabase/server";
import { formatPercent, formatPlainDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parsePairKey(raw: string): [string, string] | null {
  const parts = decodeURIComponent(raw).split(":");
  if (parts.length !== 2) return null;
  if (!parts.every((id) => UUID.test(id))) return null;
  if (parts[0] === parts[1]) return null;
  return [parts[0], parts[1]];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pairKey: string }>;
}): Promise<Metadata> {
  const { pairKey } = await params;
  const ids = parsePairKey(pairKey);
  if (!ids) return { title: "Dupla" };

  const supabase = await createClient();
  const players = await getPlayersByIds(supabase, ids);
  if (players.length !== 2) return { title: "Dupla" };
  return { title: players.map((p) => p.display_name).join(" + ") };
}

export default async function PairPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupSlug: string; pairKey: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { groupSlug, pairKey } = await params;
  const rawSearchParams = await searchParams;
  const filters = parseStatsFilters(rawSearchParams);

  const ids = parsePairKey(pairKey);
  if (!ids) notFound();

  const supabase = await createClient();
  const [context, pairPlayers] = await Promise.all([
    getGroupContext(supabase, groupSlug),
    getPlayersByIds(supabase, ids),
  ]);
  if (!context) notFound();
  const { group } = context;

  if (pairPlayers.length !== 2 || pairPlayers.some((p) => p.group_id !== group.id)) notFound();

  // A identidade da dupla é canônica; a exibição segue sort_order.
  const canonical = canonicalPairKey(ids[0], ids[1]);
  const ordered = [...pairPlayers].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      a.display_name.localeCompare(b.display_name, "pt-BR") ||
      a.id.localeCompare(b.id),
  );
  const label = ordered.map((p) => p.display_name).join(" + ");

  const period = resolveFilterPeriod(filters, group.timezone);
  const query = { groupId: group.id, period, sessionId: filters.sessionId, minGames: 1 };

  const [pairRows, h2hRows, matches, allPlayers, sessions] = await Promise.all([
    fetchPairStats(supabase, { ...query, playerId: null }),
    fetchPairHeadToHead(supabase, { ...query, perspectivePair: ids }),
    listMatches(supabase, group.id, {
      from: period.from?.toISOString() ?? null,
      to: period.to?.toISOString() ?? null,
      sessionId: filters.sessionId,
      limit: 200,
    }),
    listPlayers(supabase, group.id),
    listSessions(supabase, group.id),
  ]);

  const stat = pairRows.find((row) => row.pair_key === canonical);

  // Partidas em que estes dois jogaram juntos (mesmo lado).
  const pairMatches = matches.filter((match) =>
    (["teamA", "teamB"] as const).some((side) => {
      const sideIds = match[side].map((p) => p.playerId);
      return ids.every((id) => sideIds.includes(id));
    }),
  );

  const h2hEntries: HeadToHeadEntry[] = h2hRows.map((row) => ({
    id: `${row.pair_1_key}|${row.pair_2_key}`,
    leftLabel: row.pair_1_names.join(" + "),
    rightLabel: row.pair_2_names.join(" + "),
    rightHref: `/${groupSlug}/duplas/${encodeURIComponent(row.pair_2_key)}`,
    games: row.games,
    leftWins: row.pair_1_wins,
    rightWins: row.pair_2_wins,
    leftRate: row.pair_1_win_rate,
    rightRate: row.pair_2_win_rate,
  }));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold">{label}</h1>
        <p className="text-muted-foreground text-sm">
          {ordered.map((player, index) => (
            <span key={player.id}>
              {index > 0 ? " · " : ""}
              <Link
                href={`/${groupSlug}/jogadores/${player.id}`}
                className="hover:underline"
                prefetch={false}
              >
                {player.display_name}
              </Link>
            </span>
          ))}
        </p>
      </header>

      <FiltersBar
        filters={filters}
        players={allPlayers.map((p) => ({ value: p.id, label: p.display_name }))}
        sessions={sessions.map((s) => ({ value: s.id, label: formatPlainDate(s.played_on) }))}
      />

      {!stat ? (
        <EmptyState
          title="Esta dupla ainda não jogou junta"
          description="Nenhuma partida com os dois do mesmo lado corresponde aos filtros atuais."
        />
      ) : (
        <>
          <section aria-label="Resumo da dupla" className="grid grid-cols-2 gap-2">
            <StatTile
              label="Aproveitamento"
              value={formatPercent(stat.win_rate)}
              detail={`${stat.games} jogos`}
            />
            <StatTile label="Posição entre as duplas" value={`${stat.position}º`} />
            <StatTile label="Vitórias" value={stat.wins} />
            <StatTile label="Derrotas" value={stat.losses} />
          </section>

          {h2hEntries.length > 0 ? (
            <section aria-labelledby="confrontos-dupla" className="flex flex-col gap-2">
              <h2 id="confrontos-dupla" className="text-sm font-semibold">
                Contra outras duplas
              </h2>
              <HeadToHeadList entries={h2hEntries} />
            </section>
          ) : null}
        </>
      )}

      <section aria-labelledby="historico-dupla" className="flex flex-col gap-2">
        <h2 id="historico-dupla" className="text-sm font-semibold">
          Histórico da dupla
        </h2>
        {pairMatches.length === 0 ? (
          <EmptyState title="Nenhuma partida" description="Sem partidas desta dupla no período." />
        ) : (
          <div className="flex flex-col gap-2">
            {pairMatches.slice(0, 20).map((match) => (
              <MatchCard key={match.id} match={match} slug={groupSlug} timeZone={group.timezone} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
