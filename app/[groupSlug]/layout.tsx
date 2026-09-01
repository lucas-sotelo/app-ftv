import { Home } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { GroupSwitcher } from "@/components/groups/group-switcher";
import { OnboardingTour } from "@/components/help/onboarding-tour";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { GroupRealtime } from "@/components/realtime/group-realtime";
import { getGroupContext, listUserGroups } from "@/lib/data/groups";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import GroupNotFound from "./not-found";

export const dynamic = "force-dynamic";

export default async function GroupLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ groupSlug: string }>;
}) {
  const { groupSlug } = await params;
  const supabase = await createClient();

  const user = await getCurrentUser(supabase);
  if (!user) redirect(`/entrar?proximo=${encodeURIComponent(`/${groupSlug}`)}`);

  // getGroupContext devolve null tanto para grupo inexistente quanto para
  // grupo do qual o usuário não participa: de fora, os dois casos são iguais.
  //
  // notFound() não funciona aqui: not-found.tsx só captura chamadas vindas
  // de page.tsx (ou de segmentos aninhados), nunca do layout.tsx do próprio
  // segmento — o layout é quem renderizaria o boundary, então se ele mesmo
  // lança o erro, o Next sobe para o not-found do segmento pai (e cai no 404
  // genérico, já que não há um em app/). Por isso renderiza o componente
  // direto em vez de chamar notFound().
  //
  // As duas consultas são independentes (uma pelo slug, outra pelo usuário
  // autenticado) — rodam em paralelo para não empilhar round-trips.
  const [context, groups] = await Promise.all([
    getGroupContext(supabase, groupSlug),
    listUserGroups(supabase),
  ]);
  if (!context) return <GroupNotFound />;

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <GroupRealtime groupId={context.group.id} />

      <header className="bg-background/95 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
          <GroupSwitcher
            currentSlug={groupSlug}
            groups={groups.map((g) => ({
              id: g.group.id,
              name: g.group.name,
              slug: g.group.slug,
              avatarUrl: g.group.avatar_url,
            }))}
          />
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" aria-label="Ir para a Home">
              <Link href="/comecar">
                <Home aria-hidden />
              </Link>
            </Button>
            <OnboardingTour />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-6">{children}</main>

      <InstallPrompt />
      <BottomNav slug={groupSlug} />
    </div>
  );
}
