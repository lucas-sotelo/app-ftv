import { Award } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MonthlyChampionCard } from "@/components/dashboard/monthly-champion-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getGroupContext } from "@/lib/data/groups";
import { fetchPlayerMonthlyStats } from "@/lib/data/stats";
import { pickMonthlyChampions } from "@/lib/stats/monthly-champions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Campeões do mês" };
export const dynamic = "force-dynamic";

export default async function MonthlyChampionsPage({
  params,
}: {
  params: Promise<{ groupSlug: string }>;
}) {
  const { groupSlug } = await params;
  const supabase = await createClient();
  const context = await getGroupContext(supabase, groupSlug);
  if (!context) notFound();

  const rows = await fetchPlayerMonthlyStats(supabase, context.group.id);
  const months = pickMonthlyChampions(rows);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="flex items-center gap-1.5 text-xl font-bold">
        <Award className="text-court-600 size-5" aria-hidden />
        Campeões do mês
      </h1>

      {months.length === 0 ? (
        <EmptyState
          icon={<Award className="size-8" aria-hidden />}
          title="Nenhum mês fechado ainda"
          description="Assim que um mês tiver partidas suficientes para bater o mínimo de presença do grupo, o campeão e o lanterna aparecem aqui."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {months.map((entry) => (
            <MonthlyChampionCard key={entry.monthStart} entry={entry} groupSlug={groupSlug} />
          ))}
        </div>
      )}
    </div>
  );
}
