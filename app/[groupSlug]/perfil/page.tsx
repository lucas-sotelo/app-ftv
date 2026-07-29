import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfilePanel } from "@/components/profile/profile-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGroupContext, listUserGroups } from "@/lib/data/groups";
import { ROLE_LABELS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Perfil" };
export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ groupSlug: string }> }) {
  const { groupSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const context = await getGroupContext(supabase, groupSlug);
  if (!context || !user) notFound();

  const [{ data: profile }, groups] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    listUserGroups(supabase),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold">Perfil</h1>

      <ProfilePanel displayName={profile?.display_name ?? ""} email={user.email ?? ""} />

      <Card>
        <CardHeader>
          <CardTitle>Seus grupos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {groups.map((entry) => (
              <li key={entry.group.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium">{entry.group.name}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {ROLE_LABELS[entry.role]}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
