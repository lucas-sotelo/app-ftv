import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatGames, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

/**
 * Resumo pessoal do jogador no topo da home do grupo. Server Component puro
 * — os números já vêm prontos do Postgres (stats_players /
 * v_player_sun_night_totals), aqui só se formata e exibe.
 */
export function PersonalHighlightCard({
  displayName,
  nickname,
  winRate,
  games,
  wins,
  losses,
  sunnyDays,
  nightDays,
}: {
  displayName: string;
  nickname?: string | null;
  winRate: number;
  games: number;
  wins: number;
  losses: number;
  sunnyDays: number;
  nightDays: number;
}) {
  const firstName = (nickname ?? displayName).split(" ")[0];
  const saldo = wins - losses;
  const saldoLabel = saldo > 0 ? `+${saldo}` : `${saldo}`;

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both delay-150 duration-500">
      <CardHeader>
        <CardTitle>Fala, {firstName}! 👋</CardTitle>
        <p className="text-muted-foreground text-sm">
          {formatGames(games)} no grupo — aqui está o seu resumo.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <Metric label="Taxa de vitória" value={formatPercent(winRate)} />
        <Metric
          label="Saldo"
          value={saldoLabel}
          valueClassName={cn(
            saldo > 0 && "text-court-600 dark:text-court-400",
            saldo < 0 && "text-destructive",
          )}
        />
        <Metric label="Dias de Sol ☀️" value={sunnyDays} />
        <Metric label="Dias de Noite 🌙" value={nightDays} />
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground truncate text-xs font-medium">{label}</p>
      <p className={cn("tabular truncate text-lg font-bold", valueClassName)}>{value}</p>
    </div>
  );
}
