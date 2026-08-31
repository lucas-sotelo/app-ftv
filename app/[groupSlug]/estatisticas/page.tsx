import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FiltersBar } from "@/components/filters/filters-bar";
import {
  ConfrontosDuplasTabContent,
  ConfrontosJogadoresTabContent,
  DuplasTabContent,
  HeadToHeadTabSkeleton,
  IndividualTabContent,
  RankingTabSkeleton,
} from "@/components/stats/stats-tab-content";
import { StatsTabs } from "@/components/stats/stats-tabs";
import { getGroupContext } from "@/lib/data/groups";
import { listSessions } from "@/lib/data/matches";
import { listPlayers } from "@/lib/data/players";
import {
  effectiveMinGames,
  parseConfrontoTab,
  parseStatsFilters,
  parseStatsTab,
  resolveFilterPeriod,
  type SearchParamsInput,
} from "@/lib/stats/filters";
import { parseSort } from "@/lib/stats/sort";
import { createClient } from "@/lib/supabase/server";
import { formatPlainDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Estatísticas" };
export const dynamic = "force-dynamic";

const TABS = [
  { value: "individual", label: "Individual" },
  { value: "duplas", label: "Duplas" },
  { value: "confrontos", label: "Confrontos" },
];

const SUB_TABS = [
  { value: "jogadores", label: "Jogador x jogador" },
  { value: "duplas", label: "Dupla x dupla" },
];

export default async function StatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupSlug: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { groupSlug } = await params;
  const rawSearchParams = await searchParams;

  const filters = parseStatsFilters(rawSearchParams);
  const tab = parseStatsTab(rawSearchParams);
  const subTab = parseConfrontoTab(rawSearchParams);
  const sort = parseSort(rawSearchParams);

  const supabase = await createClient();
  const context = await getGroupContext(supabase, groupSlug);
  if (!context) notFound();

  const { group } = context;
  const basePath = `/${groupSlug}/estatisticas`;
  const period = resolveFilterPeriod(filters, group.timezone);
  const pairMinGames = effectiveMinGames(filters);

  const query = {
    groupId: group.id,
    period,
    sessionId: filters.sessionId,
  };

  // Leves (lookups simples, sem agregação) — ficam fora do <Suspense> para
  // que o cabeçalho, as abas e os filtros sempre respondam na hora, mesmo
  // enquanto a aba pesada (RPC de estatística) ainda está carregando.
  const [players, sessions] = await Promise.all([
    listPlayers(supabase, group.id),
    listSessions(supabase, group.id),
  ]);

  const filterProps = {
    filters,
    players: players.map((p) => ({ value: p.id, label: p.display_name })),
    sessions: sessions.map((s) => ({ value: s.id, label: formatPlainDate(s.played_on) })),
  };

  const tabBaseProps = {
    supabase,
    groupSlug,
    basePath,
    rawSearchParams,
    sort,
    query,
    filters,
  };

  const header = (
    <>
      <h1 className="text-xl font-bold">Estatísticas</h1>
      <StatsTabs
        tabs={TABS}
        active={tab}
        basePath={basePath}
        searchParams={rawSearchParams}
        paramName="aba"
        defaultValue="individual"
        label="Seções de estatística"
      />
      <FiltersBar {...filterProps} showSearch showMinGames={tab === "duplas"} />
      {tab === "individual" && group.min_attendance_percent > 0 ? (
        <p className="text-muted-foreground text-xs">
          Ranking oficial exige pelo menos {group.min_attendance_percent}% de presença. Quem não
          bate isso aparece como aspirante.
        </p>
      ) : null}
      {tab === "duplas" && pairMinGames > 1 ? (
        <p className="text-muted-foreground text-xs">
          Mostrando apenas duplas com {pairMinGames} jogos ou mais. Use os filtros para ver todas.
        </p>
      ) : null}
    </>
  );

  if (tab === "individual") {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Suspense fallback={<RankingTabSkeleton />}>
          <IndividualTabContent {...tabBaseProps} group={group} players={players} />
        </Suspense>
      </div>
    );
  }

  if (tab === "duplas") {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Suspense fallback={<RankingTabSkeleton />}>
          <DuplasTabContent {...tabBaseProps} pairMinGames={pairMinGames} />
        </Suspense>
      </div>
    );
  }

  // ----- Confrontos -----
  const subTabsNav = (
    <StatsTabs
      tabs={SUB_TABS}
      active={subTab}
      basePath={basePath}
      searchParams={{ ...rawSearchParams, aba: "confrontos" }}
      paramName="sub"
      defaultValue="jogadores"
      label="Tipos de confronto"
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {header}
      {subTabsNav}
      <Suspense fallback={<HeadToHeadTabSkeleton />}>
        {subTab === "jogadores" ? (
          <ConfrontosJogadoresTabContent {...tabBaseProps} />
        ) : (
          <ConfrontosDuplasTabContent {...tabBaseProps} />
        )}
      </Suspense>
    </div>
  );
}
