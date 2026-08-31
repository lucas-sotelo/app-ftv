import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PlayerAvatar } from "@/components/ui/avatar";
import type { DailyKingRow, DailyLanternRow } from "@/lib/supabase/database.types";

function PlayerColumn({
  label,
  players,
}: {
  label: string;
  players: Array<{
    playerId: string;
    displayName: string;
    avatarUrl: string | null;
    countLabel: string;
  }>;
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-xs font-semibold">{label}</p>
      {players.length === 0 ? <p className="text-muted-foreground mt-2 text-sm">—</p> : null}
      <ul className="mt-2 flex flex-col gap-2">
        {players.map((player) => (
          <li key={player.playerId} className="flex items-center gap-2">
            <PlayerAvatar
              name={player.displayName}
              seed={player.playerId}
              imageUrl={player.avatarUrl}
              size="sm"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{player.displayName}</span>
              <span className="text-muted-foreground block text-xs">{player.countLabel}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DailyKings({
  kings,
  lanterns,
}: {
  kings: DailyKingRow[];
  lanterns: DailyLanternRow[];
}) {
  if (kings.length === 0 && lanterns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campeão do dia 👑 / Lanterna 💩</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Ainda não teve dia de jogo"
            description="Assim que rolar uma partida, o Campeão do dia e a Lanterna do dia aparecem aqui."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campeão do dia 👑 / Lanterna 💩</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <PlayerColumn
          label="Campeão do dia 👑"
          players={kings.map((row) => ({
            playerId: row.player_id,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
            countLabel: `${row.times_as_king}x Campeão do dia`,
          }))}
        />
        <PlayerColumn
          label="Lanterna 💩"
          players={lanterns.map((row) => ({
            playerId: row.player_id,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
            countLabel: `${row.times_as_lantern}x Lanterna`,
          }))}
        />
      </CardContent>
    </Card>
  );
}
