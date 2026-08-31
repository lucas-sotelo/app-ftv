import { ArrowRight, CalendarDays, Plus, Trophy, Users, Volleyball } from "lucide-react";
import Link from "next/link";
import { PersonalHighlightCard } from "@/components/dashboard/personal-highlight-card";
import { RankingRow } from "@/components/stats/ranking-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import type { GroupRow } from "@/lib/data/types";
import { fetchPlayerSunNightTotals } from "@/lib/data/resenha";
import {
  fetchGroupOverview,
  fetchPairStats,
  fetchPlayerStats,
  type StatsQuery,
} from "@/lib/data/stats";
import { getMyPlayer, listPlayers } from "@/lib/data/players";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { formatPlainDate, playerLabel } from "@/lib/utils/format";

/**
 * Nota de corte da dupla nos Destaques: fixo em 10% dos jogos do grupo,
 * independente do group.min_attendance_percent (esse é calibrado para
 * presença INDIVIDUAL — um jogador comum aparece em boa parte das rodadas.
 * Uma dupla específica, não: cada partida se reparte entre várias
 * combinações possíveis de parceiro, então o percentual por dupla é
 * naturalmente muito menor. Reusar o mesmo corte do individual (ex.: 25%)
 * deixava só a dupla com mais jogos elegível, mesmo com win rate pior —
 * exatamente o bug reportado ("Melhor dupla" saindo pelo volume de jogos).
 */
const PAIR_HIGHLIGHT_MIN_ATTENDANCE_PERCENT = 10;

/**
 * Bloco pesado do dashboard (resumo pessoal, tiles e destaques): isolado num
 * Server Component próprio para poder ficar atrás de <Suspense> no page.tsx,
 * sem travar o cabeçalho do grupo (que não depende de nenhuma dessas RPCs).
 */
export async function DashboardHighlights({
  group,
  groupSlug,
  statsQuery,
  isAdmin,
}: {
  group: GroupRow;
  groupSlug: string;
  statsQuery: Omit<StatsQuery, "minGames" | "minAttendancePercent">;
  isAdmin: boolean;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  const [overview, players, pairs, allPlayers, myPlayer, sunNightTotals] = await Promise.all([
    fetchGroupOverview(supabase, group.id),
    fetchPlayerStats(supabase, {
      ...statsQuery,
      minAttendancePercent: group.min_attendance_percent,
    }),
    fetchPairStats(supabase, {
      ...statsQuery,
      minAttendancePercent: PAIR_HIGHLIGHT_MIN_ATTENDANCE_PERCENT,
    }),
    listPlayers(supabase, group.id),
    user ? getMyPlayer(supabase, group.id, user.id) : Promise.resolve(null),
    fetchPlayerSunNightTotals(supabase, group.id),
  ]);

  // stats_pairs já devolve ordenado por win_rate desc, games desc dentro de
  // quem bate o mínimo de presença — o find() só reforça a intenção e não
  // depende cegamente da ordem vinda do banco.
  const leader = players.find((p) => p.meets_min_attendance);
  const leaderNickname = allPlayers.find((p) => p.id === leader?.player_id)?.nickname;
  const bestPair = pairs.find((p) => p.meets_min_attendance);

  const myStat = myPlayer ? players.find((p) => p.player_id === myPlayer.id) : undefined;
  const mySunNight = myPlayer ? sunNightTotals.find((s) => s.player_id === myPlayer.id) : undefined;

  return (
    <>
      {myPlayer && myStat ? (
        <PersonalHighlightCard
          displayName={myPlayer.display_name}
          nickname={myPlayer.nickname}
          winRate={myStat.win_rate}
          games={myStat.games}
          wins={myStat.wins}
          losses={myStat.losses}
          sunnyDays={mySunNight?.sunny_days ?? 0}
          nightDays={mySunNight?.night_days ?? 0}
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
    </>
  );
}

export function DashboardHighlightsSkeleton({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <Skeleton className="h-28 w-full" />
      {isAdmin ? <Skeleton className="h-11 w-full" /> : null}
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="col-span-2 h-20" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
