import { UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MatchForm } from "@/components/matches/match-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getGroupContext } from "@/lib/data/groups";
import { listPlayers } from "@/lib/data/players";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { todayInZone } from "@/lib/utils/played-at";
import type { MatchFormInput } from "@/lib/validations/match";

export const metadata: Metadata = { title: "Registrar partida" };
export const dynamic = "force-dynamic";

export default async function NewMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupSlug: string }>;
  searchParams: Promise<{ data?: string }>;
}) {
  const { groupSlug } = await params;
  const { data: dateParam } = await searchParams;

  const supabase = await createClient();
  const context = await getGroupContext(supabase, groupSlug);
  if (!context) notFound();

  // A RLS já barraria o INSERT; isso evita mostrar um formulário inútil.
  if (!can.manageMatches(context.role)) redirect(`/${groupSlug}/partidas`);

  const players = await listPlayers(supabase, context.group.id, { onlyActive: true });

  if (players.length < 4) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">Registrar partida</h1>
        <EmptyState
          icon={<UserPlus className="size-8" aria-hidden />}
          title="Faltam jogadores"
          description={`Uma partida é 2 contra 2. Cadastre pelo menos 4 jogadores ativos — hoje o grupo tem ${players.length}.`}
          action={
            <Button asChild>
              <Link href={`/${groupSlug}/grupo/jogadores`}>Cadastrar jogadores</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const defaultValues: MatchFormInput = {
    sessionDate: dateParam ?? todayInZone(context.group.timezone),
    sessionId: null,
    teamA: ["", ""] as unknown as MatchFormInput["teamA"],
    teamB: ["", ""] as unknown as MatchFormInput["teamB"],
    teamAScore: null,
    teamBScore: null,
    winningSide: null,
    notes: null,
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Registrar partida</h1>
      <MatchForm
        mode="create"
        groupId={context.group.id}
        slug={groupSlug}
        timeZone={context.group.timezone}
        players={players}
        defaultValues={defaultValues}
      />
    </div>
  );
}
