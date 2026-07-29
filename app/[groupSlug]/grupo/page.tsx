import { ClipboardList, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GroupSettingsForm } from "@/components/groups/group-settings-form";
import { InvitationsPanel } from "@/components/groups/invitations-panel";
import { MembersList } from "@/components/groups/members-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGroupContext, listGroupMembers, listInvitations } from "@/lib/data/groups";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { getAppUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Grupo" };
export const dynamic = "force-dynamic";

export default async function GroupPage({ params }: { params: Promise<{ groupSlug: string }> }) {
  const { groupSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const context = await getGroupContext(supabase, groupSlug);
  if (!context || !user) notFound();

  const { group, role } = context;
  const isAdmin = can.editGroupSettings(role);

  const [members, invitations] = await Promise.all([
    listGroupMembers(supabase, group.id),
    isAdmin ? listInvitations(supabase, group.id) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{group.name}</h1>
        <Badge variant={role === "owner" ? "primary" : "default"}>{ROLE_LABELS[role]}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline">
          <Link href={`/${groupSlug}/grupo/jogadores`}>
            <UsersRound aria-hidden />
            Jogadores
          </Link>
        </Button>
        {can.viewAudit(role) ? (
          <Button asChild variant="outline">
            <Link href={`/${groupSlug}/grupo/auditoria`}>
              <ClipboardList aria-hidden />
              Auditoria
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Membros</CardTitle>
        </CardHeader>
        <CardContent>
          <MembersList
            members={members}
            groupId={group.id}
            slug={groupSlug}
            currentUserId={user.id}
            currentRole={role}
          />
        </CardContent>
      </Card>

      {isAdmin ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Convites</CardTitle>
            </CardHeader>
            <CardContent>
              <InvitationsPanel
                invitations={invitations}
                groupId={group.id}
                slug={groupSlug}
                appUrl={getAppUrl()}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configurações</CardTitle>
            </CardHeader>
            <CardContent>
              <GroupSettingsForm
                groupId={group.id}
                slug={groupSlug}
                defaultValues={{
                  name: group.name,
                  timezone: group.timezone,
                  rankingMinGames: group.ranking_min_games,
                }}
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          Como membro, você acompanha partidas e estatísticas. Convites, jogadores e configurações
          são gerenciados por quem administra o grupo.
        </p>
      )}
    </div>
  );
}
