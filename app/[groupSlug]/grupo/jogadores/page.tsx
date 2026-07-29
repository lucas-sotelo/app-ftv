import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PlayersManager } from "@/components/players/players-manager";
import { Button } from "@/components/ui/button";
import { getGroupContext, listGroupMembers } from "@/lib/data/groups";
import { listPlayers } from "@/lib/data/players";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Jogadores" };
export const dynamic = "force-dynamic";

export default async function PlayersAdminPage({
  params,
}: {
  params: Promise<{ groupSlug: string }>;
}) {
  const { groupSlug } = await params;
  const supabase = await createClient();
  const context = await getGroupContext(supabase, groupSlug);
  if (!context) notFound();

  if (!can.managePlayers(context.role)) redirect(`/${groupSlug}/grupo`);

  const [players, members] = await Promise.all([
    listPlayers(supabase, context.group.id),
    listGroupMembers(supabase, context.group.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar para o grupo">
          <Link href={`/${groupSlug}/grupo`}>
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Jogadores</h1>
      </div>

      <PlayersManager
        players={players}
        members={members}
        groupId={context.group.id}
        slug={groupSlug}
      />
    </div>
  );
}
