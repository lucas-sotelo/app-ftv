import { Award } from "lucide-react";
import { RankingRow } from "@/components/stats/ranking-row";
import { Skeleton } from "@/components/ui/skeleton";
import { listPlayers } from "@/lib/data/players";
import { fetchPlayerStats } from "@/lib/data/stats";
import type { GroupRow } from "@/lib/data/types";
import { createClient } from "@/lib/supabase/server";
import { playerLabel } from "@/lib/utils/format";
import { resolvePeriod } from "@/lib/utils/period";

/**
 * Campeão e perdedor do mês corrente: mesmo critério de elegibilidade do
 * ranking oficial (group.min_attendance_percent), só que aplicado ao
 * período do mês — stats_players já devolve attendance_percent/meets_min_attendance
 * calculados sobre o total de partidas DO PERÍODO filtrado, então basta
 * reusar a RPC com period="month".
 */
export async function MonthlyChampionsSection({
  group,
  groupSlug,
}: {
  group: GroupRow;
  groupSlug: string;
}) {
  const supabase = await createClient();
  const period = resolvePeriod("month", { timeZone: group.timezone });

  const [rows, players] = await Promise.all([
    fetchPlayerStats(supabase, {
      groupId: group.id,
      period,
      minAttendancePercent: group.min_attendance_percent,
    }),
    listPlayers(supabase, group.id),
  ]);

  // stats_players devolve em ordem de win_rate desc dentro de quem bate o
  // mínimo de presença — o primeiro elegível é o campeão, o último é o
  // perdedor do mês.
  const eligible = rows.filter((r) => r.meets_min_attendance);
  if (eligible.length === 0) return null;

  const nicknameByPlayerId = new Map(players.map((p) => [p.id, p.nickname]));
  const champion = eligible[0];
  const loserCandidate = eligible[eligible.length - 1];
  const loser = loserCandidate.player_id !== champion.player_id ? loserCandidate : null;

  return (
    <section aria-labelledby="campeoes-mes" className="flex flex-col gap-2">
      <h2 id="campeoes-mes" className="flex items-center gap-1.5 text-sm font-semibold">
        <Award className="text-court-600 size-4" aria-hidden />
        Campeões do mês
      </h2>
      <RankingRow
        position={champion.position}
        title={playerLabel(champion.display_name, nicknameByPlayerId.get(champion.player_id))}
        subtitle="Campeão do mês"
        href={`/${groupSlug}/jogadores/${champion.player_id}`}
        avatarSeed={champion.player_id}
        avatarUrl={champion.avatar_url}
        games={champion.games}
        wins={champion.wins}
        losses={champion.losses}
        winRate={champion.win_rate}
        emoji="🏆"
        highlight
      />
      {loser ? (
        <RankingRow
          position={loser.position}
          title={playerLabel(loser.display_name, nicknameByPlayerId.get(loser.player_id))}
          subtitle="Perdedor do mês"
          href={`/${groupSlug}/jogadores/${loser.player_id}`}
          avatarSeed={loser.player_id}
          avatarUrl={loser.avatar_url}
          games={loser.games}
          wins={loser.wins}
          losses={loser.losses}
          winRate={loser.win_rate}
          emoji="🍂"
        />
      ) : null}
    </section>
  );
}

export function MonthlyChampionsSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
