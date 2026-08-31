import { ArrowRight, Volleyball } from "lucide-react";
import Link from "next/link";
import { MatchCard } from "@/components/matches/match-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listMatches } from "@/lib/data/matches";
import { createClient } from "@/lib/supabase/server";

/**
 * Isolada num Server Component próprio (irmão de <DashboardHighlights/>) para
 * poder ficar atrás do seu próprio <Suspense> no page.tsx — as últimas
 * partidas aparecem assim que essa consulta (leve) responde, sem esperar as
 * agregações pesadas de estatísticas do outro bloco.
 */
export async function RecentMatchesSection({
  groupId,
  groupSlug,
  timeZone,
  isAdmin,
}: {
  groupId: string;
  groupSlug: string;
  timeZone: string;
  isAdmin: boolean;
}) {
  const supabase = await createClient();
  const recent = await listMatches(supabase, groupId, { limit: 5 });

  return (
    <section aria-labelledby="ultimas" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 id="ultimas" className="text-sm font-semibold">
          Últimas partidas
        </h2>
        {recent.length > 0 ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${groupSlug}/partidas`}>
              Ver todas
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>

      {recent.length === 0 ? (
        <EmptyState
          icon={<Volleyball className="size-8" aria-hidden />}
          title="Nenhuma partida ainda"
          description={
            isAdmin
              ? "Cadastre os jogadores e registre a primeira partida do grupo."
              : "Assim que o pessoal registrar as partidas, elas aparecem aqui."
          }
          action={
            isAdmin ? (
              <Button asChild>
                <Link href={`/${groupSlug}/partidas/nova`}>Registrar partida</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {recent.map((match) => (
            <MatchCard key={match.id} match={match} slug={groupSlug} timeZone={timeZone} />
          ))}
        </div>
      )}
    </section>
  );
}

export function RecentMatchesSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
