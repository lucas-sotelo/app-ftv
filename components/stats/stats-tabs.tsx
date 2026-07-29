import Link from "next/link";
import type { SearchParamsInput } from "@/lib/stats/filters";
import { cn } from "@/lib/utils";

export interface TabDefinition {
  value: string;
  label: string;
}

function hrefWith(
  basePath: string,
  searchParams: SearchParamsInput,
  paramName: string,
  value: string,
  defaultValue: string,
): string {
  const params = new URLSearchParams();
  for (const [name, raw] of Object.entries(searchParams)) {
    // Trocar de aba não deve carregar a ordenação da aba anterior.
    if (name === paramName || name === "ordem" || name === "dir") continue;
    const single = Array.isArray(raw) ? raw[0] : raw;
    if (single) params.set(name, single);
  }
  if (value !== defaultValue) params.set(paramName, value);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * Abas navegáveis por link: o estado vive na URL, então voltar/avançar
 * funciona e a visão pode ser compartilhada.
 */
export function StatsTabs({
  tabs,
  active,
  basePath,
  searchParams,
  paramName,
  defaultValue,
  label,
}: {
  tabs: TabDefinition[];
  active: string;
  basePath: string;
  searchParams: SearchParamsInput;
  paramName: string;
  defaultValue: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="bg-muted flex w-full gap-1 rounded-[var(--radius-app)] p-1">
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Link
            key={tab.value}
            href={hrefWith(basePath, searchParams, paramName, tab.value, defaultValue)}
            aria-current={isActive ? "page" : undefined}
            scroll={false}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-[calc(var(--radius-app)-0.25rem)] px-2 text-sm font-medium transition-colors",
              isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
