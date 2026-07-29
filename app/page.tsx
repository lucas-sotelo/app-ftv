import { redirect } from "next/navigation";
import { listUserGroups } from "@/lib/data/groups";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Porta de entrada: manda para o grupo do usuário ou para o onboarding.
 */
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  const groups = await listUserGroups(supabase);
  if (groups.length === 0) redirect("/comecar");

  redirect(`/${groups[0].group.slug}`);
}
