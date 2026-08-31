import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  DashboardHighlights,
  DashboardHighlightsSkeleton,
} from "@/components/dashboard/dashboard-highlights";
import {
  MonthlyChampionsSection,
  MonthlyChampionsSkeleton,
} from "@/components/dashboard/monthly-champions-section";
import {
  RecentMatchesSection,
  RecentMatchesSkeleton,
} from "@/components/dashboard/recent-matches-section";
import { PlayerAvatar } from "@/components/ui/avatar";
import { getGroupContext } from "@/lib/data/groups";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { resolvePeriod } from "@/lib/utils/period";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ groupSlug: string }>;
}): Promise<Metadata> {
  const { groupSlug } = await params;
  const supabase = await createClient();
  const context = await getGroupContext(supabase, groupSlug);
  return { title: context?.group.name ?? "Grupo" };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ groupSlug: string }>;
}) {
  const { groupSlug } = await params;
  const supabase = await createClient();
  const context = await getGroupContext(supabase, groupSlug);
  if (!context) notFound();

  const { group, role } = context;
  const period = resolvePeriod("all", { timeZone: group.timezone });
  const statsQuery = { groupId: group.id, period };
  const isAdmin = can.manageMatches(role);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <PlayerAvatar name={group.name} seed={group.id} imageUrl={group.avatar_url} size="lg" />
        <h1 className="min-w-0 truncate text-xl font-bold">{group.name}</h1>
      </div>

      {/* Duas seções independentes: cada uma libera assim que a sua própria
          consulta responde, em vez de as duas ficarem presas atrás da mais
          lenta das duas (como acontecia com o Promise.all único de antes). */}
      <Suspense fallback={<DashboardHighlightsSkeleton isAdmin={isAdmin} />}>
        <DashboardHighlights
          group={group}
          groupSlug={groupSlug}
          statsQuery={statsQuery}
          isAdmin={isAdmin}
        />
      </Suspense>

      <Suspense fallback={<MonthlyChampionsSkeleton />}>
        <MonthlyChampionsSection group={group} groupSlug={groupSlug} />
      </Suspense>

      <Suspense fallback={<RecentMatchesSkeleton />}>
        <RecentMatchesSection
          groupId={group.id}
          groupSlug={groupSlug}
          timeZone={group.timezone}
          isAdmin={isAdmin}
        />
      </Suspense>
    </div>
  );
}
