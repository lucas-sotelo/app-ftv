import { ChevronRight, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HomeUserMenu } from "@/components/home/home-user-menu";
import { PlayerAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { listUserGroups } from "@/lib/data/groups";
import { ROLE_LABELS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { OnboardingCards } from "./onboarding-cards";

export const metadata: Metadata = { title: "Início" };
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { convite } = await searchParams;

  const [{ data: profile }, groups] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle(),
    listUserGroups(supabase),
  ]);

  const greetingName = profile?.display_name || user.email?.split("@")[0] || "atleta";

  // Defesa em profundidade: mesma lógica do GroupSwitcher/Perfil — a fonte já
  // deveria vir única por id, mas uma lista duplicada aqui é um bug visual
  // grave demais (e uma "key" React ausente) para confiar só nisso.
  const seen = new Set<string>();
  const uniqueGroups = groups.filter(({ group }) => {
    if (seen.has(group.id)) return false;
    seen.add(group.id);
    return true;
  });

  const profileHref = uniqueGroups.length > 0 ? `/${uniqueGroups[0].group.slug}/perfil` : null;

  return (
    <div className="from-sand-50 via-background to-background dark:bg-background flex flex-1 flex-col bg-gradient-to-b">
      <header className="bg-background/95 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <p className="min-w-0 truncate text-sm font-medium">
            Bora pra areia, <span className="font-semibold">{greetingName}</span>?
          </p>
          <HomeUserMenu
            displayName={greetingName}
            avatarUrl={profile?.avatar_url ?? null}
            profileHref={profileHref}
          />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-app)] shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element -- banner estático, sem otimização necessária */}
          <img
            src="/images/banner-home.jpg"
            alt="Pôr do sol em uma quadra de areia, com rede de futevôlei/beach tênis"
            className="size-full object-cover"
          />
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Seus grupos</h2>

          {uniqueGroups.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Você ainda não faz parte de nenhum grupo. Crie o seu ou entre com um código de
              convite abaixo.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {uniqueGroups.map(({ group, role }) => (
                <li key={group.id}>
                  <Link
                    href={`/${group.slug}`}
                    className="border-border/50 bg-card hover:bg-accent/50 flex items-center gap-3 rounded-xl border p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <PlayerAvatar name={group.name} seed={group.id} imageUrl={group.avatar_url} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <Trophy className="text-court-600 size-3.5 shrink-0" aria-hidden />
                        <span className="block truncate text-sm font-semibold">{group.name}</span>
                      </span>
                    </span>
                    <Badge variant={role === "owner" ? "primary" : "default"}>
                      {ROLE_LABELS[role]}
                    </Badge>
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <OnboardingCards initialCode={convite ?? ""} />
      </main>
    </div>
  );
}
