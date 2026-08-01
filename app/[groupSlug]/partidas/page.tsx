import { Plus, Volleyball } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FiltersBar } from "@/components/filters/filters-bar";
import { MatchActions } from "@/components/matches/match-actions";
import { MatchCard } from "@/components/matches/match-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getGroupContext } from "@/lib/data/groups";
import { groupMatchesBySession, listMatches, listSessions } from "@/lib/data/matches";
import { listPlayers } from "@/lib/data/players";
import { can } from "@/lib/permissions";
import {
  parseStatsFilters,
  resolveFilterPeriod,
  type SearchParamsInput,
} from "@/lib/stats/filters";
import { createClient } from "@/lib/supabase/server";
import { formatGames, formatLongDate, formatPlainDate, plainDateToDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Partidas" };
export const dynamic = "force-dynamic";

// Cumulativo: "Carregar mais" pede PAGE_SIZE * página, então o efeito visual
// é de acréscimo, sem cortar uma rodada ao meio de forma permanente.
const PAGE_SIZE = 30;

function currentPage(params: SearchParamsInput): number {
  const raw = Array.isArray(params.pagina) ? params.pagina[0] : params.pagina;
  const page = Number(raw);
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

function loadMoreHref(basePath: string, params: SearchParamsInput, nextPage: number): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (name === "pagina") continue;
    const single = Array.isArray(value) ? value[0] : value;
    if (single) search.set(name, single);
  }
  search.set("pagina", String(nextPage));
  return `${basePath}?${search.toString()}`;
}

export default async function MatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupSlug: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { groupSlug } = await params;
  const rawSearchParams = await searchParams;
  const filters = parseStatsFilters(rawSearchParams);
  const page = currentPage(rawSearchParams);
  const matchLimit = page * PAGE_SIZE;

  const supabase = await createClient();
  const context = await getGroupContext(supabase, groupSlug);
  if (!context) notFound();

  const { group, role } = context;
  const isAdmin = can.manageMatches(role);
  const period = resolveFilterPeriod(filters, group.timezone);

  const [matchesFetched, sessions, players] = await Promise.all([
    listMatches(supabase, group.id, {
      from: period.from?.toISOString() ?? null,
      to: period.to?.toISOString() ?? null,
      playerId: filters.playerId,
      sessionId: filters.sessionId,
      // Admin enxerga anuladas/excluídas para poder restaurar.
      includeRemoved: isAdmin,
      // +1 só para saber se há mais itens, sem exibi-lo.
      limit: matchLimit + 1,
    }),
    listSessions(supabase, group.id),
    listPlayers(supabase, group.id),
  ]);

  const hasMore = matchesFetched.length > matchLimit;
  const matches = hasMore ? matchesFetched.slice(0, matchLimit) : matchesFetched;

  const grouped = groupMatchesBySession(matches, sessions, group.timezone);
  const countable = matches.filter((m) => m.status === "confirmed" && !m.deletedAt).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Partidas</h1>
        {isAdmin ? (
          <Button asChild size="sm">
            <Link href={`/${groupSlug}/partidas/nova`}>
              <Plus aria-hidden />
              Registrar
            </Link>
          </Button>
        ) : null}
      </div>

      <FiltersBar
        filters={filters}
        players={players.map((p) => ({ value: p.id, label: p.display_name }))}
        sessions={sessions.map((s) => ({ value: s.id, label: formatPlainDate(s.played_on) }))}
      />

      <p className="text-muted-foreground text-sm">{formatGames(countable)} no filtro atual.</p>

      {grouped.length === 0 ? (
        <EmptyState
          icon={<Volleyball className="size-8" aria-hidden />}
          title="Nenhuma partida encontrada"
          description="Ajuste os filtros ou registre a primeira partida desta rodada."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map((session) => (
            <section key={session.sessionId ?? session.playedOn} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">
                  <time dateTime={session.playedOn}>
                    {formatLongDate(
                      plainDateToDate(session.playedOn, group.timezone),
                      group.timezone,
                    )}
                  </time>
                </h2>
                <span className="text-muted-foreground text-xs">
                  {formatGames(
                    session.matches.filter((m) => m.status === "confirmed" && !m.deletedAt).length,
                  )}
                </span>
              </div>
              {session.title || session.location ? (
                <p className="text-muted-foreground -mt-1 text-xs">
                  {[session.title, session.location].filter(Boolean).join(" · ")}
                </p>
              ) : null}

              <div className="flex flex-col gap-2">
                {session.matches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    slug={groupSlug}
                    timeZone={group.timezone}
                    actions={
                      isAdmin ? (
                        <MatchActions match={match} slug={groupSlug} timeZone={group.timezone} />
                      ) : undefined
                    }
                  />
                ))}
              </div>
            </section>
          ))}
          {hasMore ? (
            <Button asChild variant="outline" className="self-center">
              <Link href={loadMoreHref(`/${groupSlug}/partidas`, rawSearchParams, page + 1)}>
                Carregar mais
              </Link>
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
