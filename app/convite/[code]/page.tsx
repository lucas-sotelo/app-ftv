import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Link curto de convite: /convite/ABC123 leva para o onboarding já com o
 * código preenchido (e passa pelo login antes, se necessário).
 */
export default async function InviteLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const target = `/comecar?convite=${encodeURIComponent(code)}`;
  if (!user) redirect(`/entrar?proximo=${encodeURIComponent(target)}`);
  redirect(target);
}
