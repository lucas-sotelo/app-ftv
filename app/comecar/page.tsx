import { ChevronRight, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GlobalStatsOverview } from "@/components/home/global-stats-overview";
import { HeroBanner } from "@/components/home/hero-banner";
import { OnboardingTour } from "@/components/help/onboarding-tour";
import { PlayerAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkPendingBall } from "@/components/ui/link-pending-ball";
import { fetchGlobalUserStats, fetchMyRankingPositions, listUserGroups } from "@/lib/data/groups";
import { ROLE_LABELS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
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

  const [{ data: profile }, groups, myRankingPositions, globalStats] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle(),
    listUserGroups(supabase),
    fetchMyRankingPositions(supabase),
    fetchGlobalUserStats(supabase, user.id),
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
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-4">
        <HeroBanner
          greetingName={greetingName}
          avatarUrl={profile?.avatar_url ?? null}
          profileHref={profileHref}
        />

        {globalStats ? (
          <GlobalStatsOverview
            totalMatches={globalStats.total_matches}
            globalWinRate={globalStats.global_win_rate}
            globalSaldo={globalStats.global_saldo}
          />
        ) : null}

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Seus grupos</h2>
            {/* Sem grupo ainda, mas não por cima do JoinGroupDialog: quem
            chega por link de convite já tem o próprio dialog abrindo
            sozinho, e os dois juntos travariam a tela. */}
            <OnboardingTour autoShow={uniqueGroups.length === 0 && !convite} />
          </div>

          {uniqueGroups.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Você ainda não faz parte de nenhum grupo. Crie o seu ou entre com um código de
              convite abaixo.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {uniqueGroups.map(({ group, role }) => {
                const ranking = myRankingPositions.get(group.id);
                const rankingLabel =
                  ranking && ranking.meets_min_attendance
                    ? ranking.position === 1
                      ? "Líder do Ranking 🏆"
                      : `${ranking.position}º no Ranking`
                    : null;

                return (
                  <li key={group.id}>
                    <Link
                      href={`/${group.slug}`}
                      className="border-border/50 bg-card flex items-center gap-3 rounded-2xl border p-3.5 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
                    >
                      <PlayerAvatar name={group.name} seed={group.id} imageUrl={group.avatar_url} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <Trophy className="text-court-600 size-3.5 shrink-0" aria-hidden />
                          <span className="block truncate text-sm font-semibold">
                            {group.name}
                          </span>
                        </span>
                        {group.city || rankingLabel ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {group.city}
                            {group.city && rankingLabel ? " • " : ""}
                            {rankingLabel ? (
                              <span
                                className={cn(
                                  ranking?.position === 1 &&
                                    "font-semibold text-amber-600 dark:text-amber-400",
                                )}
                              >
                                {rankingLabel}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </span>
                      <Badge variant={role === "owner" ? "primary" : "default"}>
                        {ROLE_LABELS[role]}
                      </Badge>
                      <span className="relative inline-flex shrink-0">
                        <ChevronRight className="text-muted-foreground size-4" aria-hidden />
                        <LinkPendingBall size={16} className="absolute inset-0 -m-1" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <OnboardingCards initialCode={convite ?? ""} />
      </main>
    </div>
  );
}
