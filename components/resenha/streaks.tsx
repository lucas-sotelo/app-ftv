import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PlayerAvatar } from "@/components/ui/avatar";
import type { PlayerStreakRow } from "@/lib/supabase/database.types";

function topStreak(rows: PlayerStreakRow[], key: "longest_win_streak" | "longest_loss_streak") {
  const max = rows.reduce((best, row) => Math.max(best, row[key]), 0);
  if (max === 0) return [];
  return rows.filter((row) => row[key] === max);
}

function StreakColumn({
  label,
  rows,
  length,
  suffix,
}: {
  label: string;
  rows: PlayerStreakRow[];
  length: (row: PlayerStreakRow) => number;
  suffix: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-xs font-semibold">{label}</p>
      {rows.length === 0 ? <p className="text-muted-foreground mt-2 text-sm">—</p> : null}
      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.player_id} className="flex items-center gap-2">
            <PlayerAvatar name={row.display_name} seed={row.player_id} imageUrl={row.avatar_url} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{row.display_name}</span>
              <span className="text-muted-foreground block text-xs">
                {length(row)} {suffix}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Streaks({ streaks }: { streaks: PlayerStreakRow[] }) {
  const sunny = topStreak(streaks, "longest_win_streak");
  const rainy = topStreak(streaks, "longest_loss_streak");

  if (sunny.length === 0 && rainy.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dias de Sol ☀️ e Dias de Noite 🌙</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Sem sequências ainda"
            description="Depois de mais partidas, as maiores sequências de vitórias e derrotas seguidas aparecem aqui."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dias de Sol ☀️ e Dias de Noite 🌙</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <StreakColumn
          label="Dias de Sol ☀️"
          rows={sunny}
          length={(row) => row.longest_win_streak}
          suffix={sunny[0]?.longest_win_streak === 1 ? "vitória seguida" : "vitórias seguidas"}
        />
        <StreakColumn
          label="Dias de Noite 🌙"
          rows={rainy}
          length={(row) => row.longest_loss_streak}
          suffix={rainy[0]?.longest_loss_streak === 1 ? "derrota seguida" : "derrotas seguidas"}
        />
      </CardContent>
    </Card>
  );
}
