import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { PlayerAvatar } from "@/components/ui/avatar";
import { WinRateBar } from "@/components/ui/win-rate";
import type { SearchParamsInput } from "@/lib/stats/filters";
import { nextSortHref, type SortKey, type SortState } from "@/lib/stats/sort";
import { formatGames } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { RankingRow } from "./ranking-row";

export interface RankingEntry {
  id: string;
  position: number;
  title: string;
  subtitle?: string;
  href?: string;
  avatarSeed?: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
}

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "posicao", label: "#", className: "w-10 text-center" },
  { key: "nome", label: "Jogador" },
  { key: "jogos", label: "J", className: "w-12 text-right" },
  { key: "vitorias", label: "V", className: "w-12 text-right" },
  { key: "derrotas", label: "D", className: "w-12 text-right" },
  { key: "aproveitamento", label: "Aproveitamento", className: "w-48" },
];

/**
 * Cards compactos no celular, tabela densa no desktop.
 * O cabeçalho da tabela ordena por link — funciona sem JavaScript e o estado
 * fica na URL, então dá para compartilhar a visão ordenada.
 */
export function RankingTable({
  entries,
  basePath,
  searchParams,
  sort,
  nameColumnLabel = "Jogador",
  showAvatar = true,
}: {
  entries: RankingEntry[];
  basePath: string;
  searchParams: SearchParamsInput;
  sort: SortState;
  nameColumnLabel?: string;
  showAvatar?: boolean;
}) {
  return (
    <>
      <div className="flex flex-col gap-2 sm:hidden">
        {entries.map((entry) => (
          <RankingRow
            key={entry.id}
            position={entry.position}
            title={entry.title}
            subtitle={entry.subtitle}
            href={entry.href}
            avatarSeed={showAvatar ? entry.avatarSeed : undefined}
            games={entry.games}
            wins={entry.wins}
            losses={entry.losses}
            winRate={entry.winRate}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Ranking com posição, jogos, vitórias, derrotas e aproveitamento.
          </caption>
          <thead>
            <tr className="text-muted-foreground border-b text-xs">
              {COLUMNS.map((column) => {
                const isActive = sort.key === column.key;
                const label = column.key === "nome" ? nameColumnLabel : column.label;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn("px-2 py-2 text-left font-semibold", column.className)}
                    aria-sort={
                      isActive ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
                    }
                  >
                    <Link
                      href={nextSortHref(basePath, searchParams, sort, column.key)}
                      scroll={false}
                      className="hover:text-foreground inline-flex items-center gap-1"
                    >
                      {label}
                      {isActive ? (
                        sort.direction === "asc" ? (
                          <ArrowUp className="size-3" aria-hidden />
                        ) : (
                          <ArrowDown className="size-3" aria-hidden />
                        )
                      ) : null}
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-muted/50 border-b last:border-0">
                <td className="tabular px-2 py-2 text-center font-bold">{entry.position}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    {showAvatar ? (
                      <PlayerAvatar
                        name={entry.title}
                        seed={entry.avatarSeed ?? entry.id}
                        size="sm"
                      />
                    ) : null}
                    <div className="min-w-0">
                      {entry.href ? (
                        <Link
                          href={entry.href}
                          className="font-medium hover:underline"
                          prefetch={false}
                        >
                          {entry.title}
                        </Link>
                      ) : (
                        <span className="font-medium">{entry.title}</span>
                      )}
                      {entry.subtitle ? (
                        <p className="text-muted-foreground text-xs">{entry.subtitle}</p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="tabular px-2 py-2 text-right">{entry.games}</td>
                <td className="tabular px-2 py-2 text-right">{entry.wins}</td>
                <td className="tabular px-2 py-2 text-right">{entry.losses}</td>
                <td className="px-2 py-2">
                  <WinRateBar value={entry.winRate} />
                  <span className="sr-only">{formatGames(entry.games)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
