import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MatchForm } from "@/components/matches/match-form";
import { getGroupContext } from "@/lib/data/groups";
import { getMatch } from "@/lib/data/matches";
import { listPlayers } from "@/lib/data/players";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { MatchFormInput } from "@/lib/validations/match";

export const metadata: Metadata = { title: "Editar partida" };
export const dynamic = "force-dynamic";

export default async function EditMatchPage({
  params,
}: {
  params: Promise<{ groupSlug: string; matchId: string }>;
}) {
  const { groupSlug, matchId } = await params;

  const supabase = await createClient();
  const context = await getGroupContext(supabase, groupSlug);
  if (!context) notFound();
  if (!can.manageMatches(context.role)) redirect(`/${groupSlug}/partidas`);

  const match = await getMatch(supabase, matchId);
  if (!match || match.groupId !== context.group.id) notFound();

  const [players, session] = await Promise.all([
    listPlayers(supabase, context.group.id),
    match.sessionId
      ? supabase.from("sessions").select("played_on").eq("id", match.sessionId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const playedOn =
    session.data?.played_on ??
    new Intl.DateTimeFormat("en-CA", {
      timeZone: context.group.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(match.playedAt));

  const defaultValues: MatchFormInput = {
    sessionDate: playedOn,
    sessionId: match.sessionId,
    teamA: match.teamA.map((p) => p.playerId) as unknown as MatchFormInput["teamA"],
    teamB: match.teamB.map((p) => p.playerId) as unknown as MatchFormInput["teamB"],
    teamAScore: match.teamAScore,
    teamBScore: match.teamBScore,
    winningSide: match.winningSide,
    notes: match.notes,
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Editar partida</h1>
      <MatchForm
        mode="edit"
        matchId={match.id}
        groupId={context.group.id}
        slug={groupSlug}
        timeZone={context.group.timezone}
        players={players}
        defaultValues={defaultValues}
      />
    </div>
  );
}
