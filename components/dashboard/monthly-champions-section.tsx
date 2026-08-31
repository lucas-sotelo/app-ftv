import { ArrowRight, Award } from "lucide-react";
import Link from "next/link";
import { MonthlyChampionCard } from "@/components/dashboard/monthly-champion-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPlayerMonthlyStats } from "@/lib/data/stats";
import type { GroupRow } from "@/lib/data/types";
import { pickMonthlyChampions } from "@/lib/stats/monthly-champions";
import { createClient } from "@/lib/supabase/server";

const HOME_PREVIEW_MONTHS = 3;

/**
 * Prévia da home: últimos meses com Campeão/Lanterna, mais recente primeiro.
 * O histórico completo mora em /[groupSlug]/campeoes-do-mes — mesmo padrão
 * de "Últimas partidas" -> "Ver todas" para não deixar a home crescendo sem
 * limite conforme o grupo acumula meses.
 */
export async function MonthlyChampionsSection({
  group,
  groupSlug,
}: {
  group: GroupRow;
  groupSlug: string;
}) {
  const supabase = await createClient();
  const rows = await fetchPlayerMonthlyStats(supabase, group.id);
  const months = pickMonthlyChampions(rows);
  if (months.length === 0) return null;

  const preview = months.slice(0, HOME_PREVIEW_MONTHS);

  return (
    <section aria-labelledby="campeoes-mes" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 id="campeoes-mes" className="flex items-center gap-1.5 text-sm font-semibold">
          <Award className="text-court-600 size-4" aria-hidden />
          Campeões do mês
        </h2>
        {months.length > HOME_PREVIEW_MONTHS ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${groupSlug}/campeoes-do-mes`}>
              Ver todos os meses
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
      {preview.map((entry) => (
        <MonthlyChampionCard key={entry.monthStart} entry={entry} groupSlug={groupSlug} />
      ))}
    </section>
  );
}

export function MonthlyChampionsSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
