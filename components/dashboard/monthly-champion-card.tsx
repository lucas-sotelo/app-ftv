import { RankingRow } from "@/components/stats/ranking-row";
import type { MonthlyChampionEntry } from "@/lib/stats/monthly-champions";
import { formatMonthYear, playerLabel } from "@/lib/utils/format";

/** Um mês do histórico de Campeão/Lanterna — usado na prévia da home e na lista completa. */
export function MonthlyChampionCard({
  entry,
  groupSlug,
}: {
  entry: MonthlyChampionEntry;
  groupSlug: string;
}) {
  const { champion, lanterna, eligibleCount } = entry;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-xs font-semibold">
        {formatMonthYear(entry.monthStart)}
      </h3>
      <RankingRow
        position={1}
        title={playerLabel(champion.display_name, champion.nickname)}
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
      {lanterna ? (
        <RankingRow
          position={eligibleCount}
          title={playerLabel(lanterna.display_name, lanterna.nickname)}
          subtitle="Lanterna do mês"
          href={`/${groupSlug}/jogadores/${lanterna.player_id}`}
          avatarSeed={lanterna.player_id}
          avatarUrl={lanterna.avatar_url}
          games={lanterna.games}
          wins={lanterna.wins}
          losses={lanterna.losses}
          winRate={lanterna.win_rate}
          emoji="🍂"
        />
      ) : null}
    </div>
  );
}
