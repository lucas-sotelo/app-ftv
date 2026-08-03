import { Activity, Flame, Trophy } from "lucide-react";
import { formatInteger, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

/**
 * Resumo global do usuário na Home (/comecar) — soma de todos os grupos,
 * diferente do PersonalHighlightCard (que é por grupo). Números já vêm
 * prontos de get_global_user_stats (supabase/migrations/20260803001000_global_user_stats.sql).
 */
export function GlobalStatsOverview({
  totalMatches,
  globalWinRate,
  globalSaldo,
}: {
  totalMatches: number;
  globalWinRate: number;
  globalSaldo: number;
}) {
  if (totalMatches === 0) return null;

  const saldoLabel = globalSaldo > 0 ? `+${formatInteger(globalSaldo)}` : `${formatInteger(globalSaldo)}`;

  return (
    <div>
      <p className="mb-3 px-1 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        Tá voando ou tá na lama? Se liga nos seus números gerais:
      </p>
      <div className="animate-in fade-in slide-in-from-top-4 grid grid-cols-3 gap-3 duration-500 delay-100 fill-mode-both">
        <StatTile icon={Activity} label="Partidas" value={formatInteger(totalMatches)} />
        <StatTile icon={Trophy} label="Aproveitamento" value={formatPercent(globalWinRate)} />
        <StatTile
          icon={Flame}
          label="Saldo"
          value={saldoLabel}
          valueClassName={cn(
            globalSaldo > 0 && "text-court-600 dark:text-court-400",
            globalSaldo < 0 && "text-destructive",
          )}
        />
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-slate-200/50 bg-white/60 p-3 shadow-sm backdrop-blur-md dark:border-slate-100/10 dark:bg-slate-900/60">
      <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      <p className={cn("tabular truncate text-2xl font-black tracking-tighter", valueClassName)}>
        {value}
      </p>
      <p className="text-muted-foreground truncate text-xs font-medium">{label}</p>
    </div>
  );
}
