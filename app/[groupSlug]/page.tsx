import { ArrowRight, CalendarDays, Plus, Trophy, Users, Volleyball } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PersonalHighlightCard } from "@/components/dashboard/personal-highlight-card";
import { MatchCard } from "@/components/matches/match-card";
import { RankingRow } from "@/components/stats/ranking-row";
import { PlayerAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { getGroupContext } from "@/lib/data/groups";
import { listMatches } from "@/lib/data/matches";
import { getMyPlayer, listPlayers } from "@/lib/data/players";
import { fetchCurrentStreaks } from "@/lib/data/resenha";
import { fetchGroupOverview, fetchPairStats, fetchPlayerStats } from "@/lib/data/stats";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatPlainDate, playerLabel } from "@/lib/utils/format";
import { resolvePeriod } from "@/lib/utils/period";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ groupSlug: string }>;
}): Promise<Metadata> {
  const { groupSlug } = await params;
  const supabase = await createClient();
  const context = await getGroupContext(supabase, groupSlug);
  return { title: context?.group.name ?? "Grupo" };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ groupSlug: string }>;
}) {
  const { groupSlug } = await params;
  const supabase = await createClient();
  const context = await getGroupContext(supabase, groupSlug);
  if (!context) notFound();

  const { group, role } = context;
  const period = resolvePeriod("all", { timeZone: group.timezone });
  const statsQuery = { groupId: group.id, period, minGames: 1 };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [overview, players, pairs, recent, allPlayers, myPlayer, currentStreaks] =
    await Promise.all([
      fetchGroupOverview(supabase, group.id),
      fetchPlayerStats(supabase, statsQuery),
      fetchPairStats(supabase, statsQuery),
      listMatches(supabase, group.id, { limit: 5 }),
      listPlayers(supabase, group.id),
      user ? getMyPlayer(supabase, group.id, user.id) : Promise.resolve(null),
      fetchCurrentStreaks(supabase, group.id),
    ]);

  const leader = players[0];
  const leaderNickname = allPlayers.find((p) => p.id === leader?.player_id)?.nickname;
  const bestPair = pairs[0];
  const isAdmin = can.manageMatches(role);

  const myStat = myPlayer ? players.find((p) => p.player_id === myPlayer.id) : undefined;
  const myStreak = myPlayer
    ? currentStreaks.find((s) => s.player_id === myPlayer.id)
    : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <PlayerAvatar name={group.name} seed={group.id} imageUrl={group.avatar_url} size="lg" />
        <h1 className="min-w-0 truncate text-xl font-bold">{group.name}</h1>
      </div>

      {myPlayer && myStat ? (
        <PersonalHighlightCard
          displayName={myPlayer.display_name}
          nickname={myPlayer.nickname}
          winRate={myStat.win_rate}
          games={myStat.games}
          wins={myStat.wins}
          losses={myStat.losses}
          streak={
            myStreak ? { type: myStreak.streak_type, length: myStreak.streak_length } : null
          }
        />
      ) : null}

      {isAdmin ? (
        <Button asChild size="lg" block className="shadow-sm">
          <Link href={`/${groupSlug}/partidas/nova`}>
            <Plus aria-hidden />
            Registrar partida
          </Link>
        </Button>
      ) : null}

      <section aria-label="Resumo do grupo" className="grid grid-cols-2 gap-2">
        <StatTile
          label="Partidas"
          value={overview?.total_matches ?? 0}
          icon={<Volleyball className="size-3.5" aria-hidden />}
          detail={`${overview?.total_sessions ?? 0} rodadas`}
        />
        <StatTile
          label="Jogadores ativos"
          value={overview?.active_players ?? 0}
          icon={<Users className="size-3.5" aria-hidden />}
          detail={`${overview?.total_players ?? 0} no total`}
        />
        <StatTile
          label="Última rodada"
          value={
            overview?.last_session_played_on
              ? formatPlainDate(overview.last_session_played_on)
              : "—"
          }
          icon={<CalendarDays className="size-3.5" aria-hidden />}
          className="col-span-2"
          detail={overview?.last_played_at ? undefined : "Nenhuma partida registrada ainda"}
        />
      </section>

      {leader || bestPair ? (
        <section aria-labelledby="destaques" className="flex flex-col gap-2">
          <h2 id="destaques" className="flex items-center gap-1.5 text-sm font-semibold">
            <Trophy className="text-court-600 size-4" aria-hidden />
            Destaques
          </h2>
          {leader ? (
            <RankingRow
              position={1}
              title={playerLabel(leader.display_name, leaderNickname)}
              subtitle="Líder individual"
              href={`/${groupSlug}/jogadores/${leader.player_id}`}
              avatarSeed={leader.player_id}
              avatarUrl={leader.avatar_url}
              games={leader.games}
              wins={leader.wins}
              losses={leader.losses}
              winRate={leader.win_rate}
              emoji={group.first_place_emoji}
              highlight
            />
          ) : null}
          {bestPair ? (
            <RankingRow
              position={1}
              title={bestPair.player_names.join(" + ")}
              subtitle="Melhor dupla"
              href={`/${groupSlug}/duplas/${encodeURIComponent(bestPair.pair_key)}`}
              games={bestPair.games}
              wins={bestPair.wins}
              losses={bestPair.losses}
              winRate={bestPair.win_rate}
              highlight
            />
          ) : null}
          <Button asChild variant="ghost" size="sm" className="self-start">
            <Link href={`/${groupSlug}/estatisticas`}>
              Ver todas as estatísticas
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </section>
      ) : null}

      <section aria-labelledby="ultimas" className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 id="ultimas" className="text-sm font-semibold">
            Últimas partidas
          </h2>
          {recent.length > 0 ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/${groupSlug}/partidas`}>
                Ver todas
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>

        {recent.length === 0 ? (
          <EmptyState
            icon={<Volleyball className="size-8" aria-hidden />}
            title="Nenhuma partida ainda"
            description={
              isAdmin
                ? "Cadastre os jogadores e registre a primeira partida do grupo."
                : "Assim que o pessoal registrar as partidas, elas aparecem aqui."
            }
            action={
              isAdmin ? (
                <Button asChild>
                  <Link href={`/${groupSlug}/partidas/nova`}>Registrar partida</Link>
                </Button>
              ) : undefined
            }
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
