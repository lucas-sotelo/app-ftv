import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Porta de entrada: nunca escolhe um grupo por conta própria — quem decide
 * qual grupo abrir é o usuário, a partir do hub em /comecar.
 */
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  redirect("/comecar");
}
