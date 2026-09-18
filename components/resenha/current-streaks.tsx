import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PlayerAvatar } from "@/components/ui/avatar";
import type { PlayerCurrentGameStreakRow } from "@/lib/supabase/database.types";

/** Só vira notícia a partir de 5 jogos seguidos sem perder. */
const MIN_STREAK_TO_SHOW = 5;

export function CurrentStreaks({ streaks }: { streaks: PlayerCurrentGameStreakRow[] }) {
  const onFire = streaks
    .filter((row) => row.streak_type === "win" && row.streak_length >= MIN_STREAK_TO_SHOW)
    .sort((a, b) => b.streak_length - a.streak_length);

  if (onFire.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sequência atual 🔥</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Ninguém embalado ainda"
            description={`Assim que alguém emendar ${MIN_STREAK_TO_SHOW} jogos seguidos sem perder, aparece aqui.`}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sequência atual 🔥</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {onFire.map((row) => (
            <li key={row.player_id} className="flex items-center gap-2 rounded-[var(--radius-app)] border p-3">
              <PlayerAvatar name={row.display_name} seed={row.player_id} imageUrl={row.avatar_url} size="sm" />
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-semibold">{row.display_name}</span> está há{" "}
                <span className="font-semibold">{row.streak_length} jogos</span> sem perder!
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
