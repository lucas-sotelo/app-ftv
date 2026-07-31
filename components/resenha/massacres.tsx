import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PlayerAvatar } from "@/components/ui/avatar";
import type { MassacreRow } from "@/lib/supabase/database.types";
import { formatGames, formatPercent } from "@/lib/utils/format";

export function Massacres({ massacres }: { massacres: MassacreRow[] }) {
  if (massacres.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Massacre do Grupo ⚔️</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Ninguém domina ninguém (ainda)"
            description="Com pelo menos 4 confrontos diretos entre dois jogadores, o maior massacre aparece aqui."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Massacre do Grupo ⚔️</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {massacres.map((massacre) => (
            <li
              key={`${massacre.attacker_id}:${massacre.victim_id}`}
              className="flex items-center gap-2 rounded-[var(--radius-app)] border p-3"
            >
              <PlayerAvatar
                name={massacre.attacker_name}
                seed={massacre.attacker_id}
                imageUrl={massacre.attacker_avatar_url}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {massacre.attacker_name}
                  <span className="text-muted-foreground font-normal"> domina </span>
                  {massacre.victim_name}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {formatPercent(massacre.win_rate, 0)} de aproveitamento em{" "}
                  {formatGames(massacre.games)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
