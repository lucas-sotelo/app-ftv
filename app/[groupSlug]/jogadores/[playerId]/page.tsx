import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FiltersBar } from "@/components/filters/filters-bar";
import { MatchCard } from "@/components/matches/match-card";
import { HeadToHeadList, type HeadToHeadEntry } from "@/components/stats/head-to-head-list";
import { RankingRow } from "@/components/stats/ranking-row";
import { PlayerAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { getGroupContext } from "@/lib/data/groups";
import { listMatches, listSessions } from "@/lib/data/matches";
import { getPlayer, listPlayers } from "@/lib/data/players";
import { fetchPairStats, fetchPlayerHeadToHead, fetchPlayerStats } from "@/lib/data/stats";
import {
  parseStatsFilters,
  resolveFilterPeriod,
  type SearchParamsInput,
} from "@/lib/stats/filters";
import { createClient } from "@/lib/supabase/server";
import { formatPercent, formatPlainDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ groupSlug: string; playerId: string }>;
}): Promise<Metadata> {
  const { playerId } = await params;
  const supabase = await createClient();
  const player = await getPlayer(supabase, playerId);
  return { title: player?.display_name ?? "Jogador" };
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupSlug: string; playerId: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { groupSlug, playerId } = await params;
  const rawSearchParams = await searchParams;
  const filters = parseStatsFilters(rawSearchParams);

  const supabase = await createClient();
  const [context, player] = await Promise.all([
    getGroupContext(supabase, groupSlug),
    getPlayer(supabase, playerId),
  ]);
  if (!context) notFound();

  const { group } = context;
  if (!player || player.group_id !== group.id) notFound();

  const period = resolveFilterPeriod(filters, group.timezone);
  const query = { groupId: group.id, period, sessionId: filters.sessionId, minGames: 1 };

  const [statsRows, pairRows, h2hRows, recent, allPlayers, sessions] = await Promise.all([
    fetchPlayerStats(supabase, { ...query, playerId: null }),
    fetchPairStats(supabase, { ...query, playerId }),
    fetchPlayerHeadToHead(supabase, { ...query, perspectivePlayerId: playerId }),
    listMatches(supabase, group.id, {
      from: period.from?.toISOString() ?? null,
      to: period.to?.toISOString() ?? null,
      playerId,
      sessionId: filters.sessionId,
      limit: 10,
    }),
    listPlayers(supabase, group.id),
    listSessions(supabase, group.id),
  ]);

  const stat = statsRows.find((row) => row.player_id === playerId);
  // Só as duplas de que este jogador participou.
  const pairs = pairRows.filter((row) => row.player_ids.includes(playerId));

  const h2hEntries: HeadToHeadEntry[] = h2hRows.map((row) => ({
    id: `${row.player_1_id}:${row.player_2_id}`,
    leftLabel: row.player_1_name,
    rightLabel: row.player_2_name,
    rightHref: `/${groupSlug}/jogadores/${row.player_2_id}`,
    games: row.games,
    leftWins: row.player_1_wins,
    rightWins: row.player_2_wins,
    leftRate: row.player_1_win_rate,
    rightRate: row.player_2_win_rate,
  }));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <PlayerAvatar
          name={player.display_name}
          seed={player.id}
          imageUrl={player.avatar_url}
          size="lg"
        />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{player.display_name}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {player.is_guest ? <Badge variant="outline">Convidado</Badge> : null}
            {!player.active ? <Badge variant="warning">Inativo</Badge> : null}
            {player.linked_user_id ? <Badge variant="primary">Tem conta no app</Badge> : null}
          </div>
        </div>
      </header>

      <FiltersBar
        filters={filters}
        players={allPlayers.map((p) => ({ value: p.id, label: p.display_name }))}
        sessions={sessions.map((s) => ({ value: s.id, label: formatPlainDate(s.played_on) }))}
      />

      {!stat ? (
        <EmptyState
          title="Sem partidas no período"
          description="Este jogador não tem partidas que correspondam aos filtros atuais."
        />
      ) : (
        <>
          <section aria-label="Resumo do jogador" className="grid grid-cols-2 gap-2">
            <StatTile
              label="Aproveitamento"
              value={formatPercent(stat.win_rate)}
              detail={`${stat.games} jogos`}
            />
            <StatTile
              label="Posição no ranking"
              value={`${stat.position}º`}
              detail="entre quem jogou no período"
            />
            <StatTile label="Vitórias" value={stat.wins} />
            <StatTile label="Derrotas" value={stat.losses} />
          </section>

          {pairs.length > 0 ? (
            <section aria-labelledby="melhores-duplas" className="flex flex-col gap-2">
              <h2 id="melhores-duplas" className="text-sm font-semibold">
                Melhores duplas
              </h2>
              <div className="flex flex-col gap-2">
                {pairs.slice(0, 6).map((pair, index) => (
                  <RankingRow
                    key={pair.pair_key}
                    position={index + 1}
                    title={pair.player_names.join(" + ")}
                    href={`/${groupSlug}/duplas/${encodeURIComponent(pair.pair_key)}`}
                    games={pair.games}
                    wins={pair.wins}
                    losses={pair.losses}
                    winRate={pair.win_rate}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {h2hEntries.length > 0 ? (
            <section aria-labelledby="confrontos-jogador" className="flex flex-col gap-2">
              <h2 id="confrontos-jogador" className="text-sm font-semibold">
                Contra cada adversário
              </h2>
              <HeadToHeadList entries={h2hEntries} />
            </section>
          ) : null}
        </>
      )}

      <section aria-labelledby="historico-jogador" className="flex flex-col gap-2">
        <h2 id="historico-jogador" className="text-sm font-semibold">
          Histórico recente
        </h2>
        {recent.length === 0 ? (
          <EmptyState
            title="Nenhuma partida"
            description="Ainda não há partidas deste jogador no período."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map((match) => (
              <MatchCard key={match.id} match={match} slug={groupSlug} timeZone={group.timezone} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
