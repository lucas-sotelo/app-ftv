import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Porta de entrada: nunca escolhe um grupo por conta própria — quem decide
 * qual grupo abrir é o usuário, a partir do hub em /comecar.
 *
 * O PWA não abre mais por aqui (manifest.webmanifest start_url já aponta
 * direto pra /comecar — id continua "/" pra não perder a identidade do
 * instalado): cada hop de rota passa pelo proxy.ts, que faz um round-trip
 * de rede pra revalidar a sessão, então "/" -> redirect -> "/comecar" era
 * pagar esse custo duas vezes na abertura do app, o pior momento possível
 * pra isso. Esta página fica só como fallback pra quem navega pra "/" na
 * mão (ex.: not-found.tsx).
 *
 * Sem chamada ao Supabase aqui: o proxy.ts (matcher cobre "/") já barrou
 * quem não está autenticado antes desta página rodar, então chegar até
 * aqui já significa usuário logado — refazer auth.getUser() só duplicaria
 * o round-trip que o proxy acabou de fazer.
 */
export default function HomePage() {
  redirect("/comecar");
}
