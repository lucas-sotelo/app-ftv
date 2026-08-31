import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Porta de entrada: nunca escolhe um grupo por conta própria — quem decide
 * qual grupo abrir é o usuário, a partir do hub em /comecar.
 *
 * Sem chamada ao Supabase aqui: o proxy.ts (matcher cobre "/") já barrou
 * quem não está autenticado antes desta página rodar, então chegar até
 * aqui já significa usuário logado — refazer auth.getUser() só duplicaria
 * o round-trip que o proxy acabou de fazer.
 */
export default function HomePage() {
  redirect("/comecar");
}
