import { formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

/**
 * Barra de aproveitamento.
 *
 * A cor é sempre acompanhada do número em texto — cor sozinha não é
 * informação acessível. A barra em si é `aria-hidden`, e o valor exposto ao
 * leitor de tela vem do texto ao lado.
 */
export function WinRateBar({
  value,
  className,
  showLabel = true,
  compact = false,
}: {
  value: number;
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, value));
  const tone =
    pct >= 0.6 ? "bg-court-500" : pct >= 0.45 ? "bg-skyb-500" : "bg-sand-400 dark:bg-sand-500";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        aria-hidden
        className={cn(
          "bg-muted relative overflow-hidden rounded-full",
          compact ? "h-1.5 w-12" : "h-2 w-full min-w-16",
        )}
      >
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct * 100}%` }} />
      </div>
      {showLabel ? (
        <span className="tabular text-sm font-semibold">{formatPercent(pct)}</span>
      ) : null}
    </div>
  );
}
