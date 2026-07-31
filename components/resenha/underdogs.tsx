import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { PairUnderdogRow } from "@/lib/supabase/database.types";
import { formatDate, formatPercent } from "@/lib/utils/format";

export function Underdogs({
  underdogs,
  timezone,
}: {
  underdogs: PairUnderdogRow[];
  timezone: string;
}) {
  if (underdogs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zebras 🦓</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Nenhuma zebra ainda"
            description="Ainda não rolou nenhuma zebra neste grupo."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zebras 🦓</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {underdogs.map((underdog) => (
            <li key={underdog.match_id} className="rounded-[var(--radius-app)] border p-3">
              <p className="text-sm font-semibold">
                <span className="block truncate">{underdog.winner_player_names.join(" + ")}</span>
                <span className="text-muted-foreground block text-xs font-normal">
                  venceu {underdog.loser_player_names.join(" + ")}
                </span>
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {formatDate(underdog.played_at, timezone)} · favoritismo de{" "}
                {formatPercent(underdog.win_rate_gap, 0)} superado
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
