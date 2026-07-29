import Link from "next/link";
import { formatGames, formatPercent } from "@/lib/utils/format";

export interface HeadToHeadEntry {
  id: string;
  leftLabel: string;
  rightLabel: string;
  leftHref?: string;
  rightHref?: string;
  games: number;
  leftWins: number;
  rightWins: number;
  leftRate: number;
  rightRate: number;
}

/**
 * Confronto direto. As duas barras somam 100%, e cada lado mostra vitórias e
 * percentual em texto — nada depende só da cor.
 */
export function HeadToHeadList({ entries }: { entries: HeadToHeadEntry[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={entry.id} className="bg-card rounded-[var(--radius-app)] border p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">
              {entry.leftHref ? (
                <Link href={entry.leftHref} className="hover:underline" prefetch={false}>
                  {entry.leftLabel}
                </Link>
              ) : (
                entry.leftLabel
              )}
            </p>
            <span className="text-muted-foreground shrink-0 text-xs">
              {formatGames(entry.games)}
            </span>
            <p className="min-w-0 flex-1 truncate text-right text-sm font-semibold">
              {entry.rightHref ? (
                <Link href={entry.rightHref} className="hover:underline" prefetch={false}>
                  {entry.rightLabel}
                </Link>
              ) : (
                entry.rightLabel
              )}
            </p>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="tabular w-14 shrink-0 text-sm font-bold">
              {entry.leftWins}
              <span className="text-muted-foreground ml-1 text-xs font-normal">
                {formatPercent(entry.leftRate, 0)}
              </span>
            </span>

            <div aria-hidden className="bg-muted flex h-2 flex-1 overflow-hidden rounded-full">
              <div className="bg-court-500 h-full" style={{ width: `${entry.leftRate * 100}%` }} />
              <div className="bg-sand-400 dark:bg-sand-500 h-full flex-1" />
            </div>

            <span className="tabular w-14 shrink-0 text-right text-sm font-bold">
              <span className="text-muted-foreground mr-1 text-xs font-normal">
                {formatPercent(entry.rightRate, 0)}
              </span>
              {entry.rightWins}
            </span>
          </div>

          <p className="sr-only">
            {entry.leftLabel} venceu {entry.leftWins} de {entry.games}; {entry.rightLabel} venceu{" "}
            {entry.rightWins}.
          </p>
        </li>
      ))}
    </ul>
  );
}
