import { ClipboardList, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteGroupSection } from "@/components/groups/delete-group-section";
import { GroupSettingsForm } from "@/components/groups/group-settings-form";
import { InvitationsPanel } from "@/components/groups/invitations-panel";
import { MembersList } from "@/components/groups/members-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGroupContext, listGroupMembers, listInvitations } from "@/lib/data/groups";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Grupo" };
export const dynamic = "force-dynamic";

export default async function GroupPage({ params }: { params: Promise<{ groupSlug: string }> }) {
  const { groupSlug } = await params;
  const supabase = await createClient();

  const [user, context] = await Promise.all([
    getCurrentUser(supabase),
    getGroupContext(supabase, groupSlug),
  ]);
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
              <InvitationsPanel invitations={invitations} groupId={group.id} slug={groupSlug} />
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
                  minAttendancePercent: group.min_attendance_percent,
                  avatarUrl: group.avatar_url ?? "",
                  firstPlaceEmoji: group.first_place_emoji ?? "",
                  lastPlaceEmoji: group.last_place_emoji ?? "",
                }}
              />
            </CardContent>
          </Card>

          {can.deleteGroup(role) ? (
            <DeleteGroupSection groupId={group.id} groupName={group.name} />
          ) : null}
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
