import type { PlayerMonthlyStatRow } from "@/lib/supabase/database.types";

export interface MonthlyChampionEntry {
  monthStart: string;
  champion: PlayerMonthlyStatRow;
  /** null quando só um jogador elegível bateu presença naquele mês. */
  lanterna: PlayerMonthlyStatRow | null;
  /** Quantos jogadores bateram o mínimo de presença naquele mês. */
  eligibleCount: number;
}

/**
 * Agrupa as linhas de v_player_monthly_stats (já ordenadas por month_start
 * desc, win_rate desc dentro do mês) por mês e escolhe o campeão (primeiro
 * elegível) e o lanterna (último elegível, se for outro jogador) — mesma
 * lógica de particionar uma lista pronta do banco já usada nos Destaques da
 * home (leader/bestPair via find()), sem recalcular nenhuma estatística.
 */
export function pickMonthlyChampions(rows: PlayerMonthlyStatRow[]): MonthlyChampionEntry[] {
  const byMonth = new Map<string, PlayerMonthlyStatRow[]>();
  for (const row of rows) {
    const bucket = byMonth.get(row.month_start);
    if (bucket) bucket.push(row);
    else byMonth.set(row.month_start, [row]);
  }

  const entries: MonthlyChampionEntry[] = [];
  for (const [monthStart, monthRows] of byMonth) {
    const eligible = monthRows.filter((r) => r.meets_min_attendance);
    if (eligible.length === 0) continue;

    const champion = eligible[0];
    const last = eligible[eligible.length - 1];
    const lanterna = last.player_id !== champion.player_id ? last : null;
    entries.push({ monthStart, champion, lanterna, eligibleCount: eligible.length });
  }

  return entries;
}
