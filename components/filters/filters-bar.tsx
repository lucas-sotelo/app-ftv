"use client";

import { Filter, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hasActiveFilters, type StatsFilters } from "@/lib/stats/filters";
import { PERIOD_LABELS, PERIOD_PRESETS } from "@/lib/utils/period";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Barra de filtros ligada à URL.
 *
 * Todo filtro vira query param, então um ranking filtrado pode ser mandado no
 * grupo por link e voltar/avançar do navegador funciona de verdade.
 */
export function FiltersBar({
  filters,
  players,
  sessions,
  showMinGames = false,
  showSearch = false,
}: {
  filters: StatsFilters;
  players: FilterOption[];
  sessions: FilterOption[];
  showMinGames?: boolean;
  showSearch?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);

  const update = React.useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const active = hasActiveFilters(filters);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {showSearch ? (
          <Input
            type="search"
            placeholder="Buscar por nome"
            aria-label="Buscar por nome"
            defaultValue={filters.search}
            className="flex-1"
            onChange={(event) => {
              const value = event.target.value;
              // Digitação não deve empilhar entrada no histórico a cada tecla.
              window.clearTimeout((window as unknown as { __ftvSearch?: number }).__ftvSearch);
              (window as unknown as { __ftvSearch?: number }).__ftvSearch = window.setTimeout(
                () => update({ busca: value || null }),
                300,
              );
            }}
          />
        ) : null}

        <Button
          variant={active ? "default" : "outline"}
          size={showSearch ? "icon" : "default"}
          aria-expanded={open}
          aria-controls="filtros-avancados"
          onClick={() => setOpen((v) => !v)}
        >
          <Filter aria-hidden />
          {showSearch ? <span className="sr-only">Filtros</span> : <span>Filtros</span>}
        </Button>

        {active ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Limpar filtros"
            onClick={() => router.push(pathname, { scroll: false })}
          >
            <X aria-hidden />
          </Button>
        ) : null}
      </div>

      {open ? (
        <div
          id="filtros-avancados"
          className="bg-card flex flex-col gap-3 rounded-[var(--radius-app)] border p-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filtro-periodo">Período</Label>
            <Select
              value={filters.period}
              onValueChange={(value) => update({ periodo: value === "all" ? null : value })}
            >
              <SelectTrigger id="filtro-periodo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset}>
                    {PERIOD_LABELS[preset]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filters.period === "day" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtro-dia">Dia</Label>
              <Input
                id="filtro-dia"
                type="date"
                defaultValue={filters.from ?? ""}
                onChange={(event) => update({ de: event.target.value || null, ate: null })}
              />
            </div>
          ) : null}

          {filters.period === "custom" ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filtro-de">De</Label>
                <Input
                  id="filtro-de"
                  type="date"
                  defaultValue={filters.from ?? ""}
                  onChange={(event) => update({ de: event.target.value || null })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filtro-ate">Até</Label>
                <Input
                  id="filtro-ate"
                  type="date"
                  defaultValue={filters.to ?? ""}
                  onChange={(event) => update({ ate: event.target.value || null })}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filtro-jogador">Jogador</Label>
            <Select
              value={filters.playerId ?? "todos"}
              onValueChange={(value) => update({ jogador: value === "todos" ? null : value })}
            >
              <SelectTrigger id="filtro-jogador">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os jogadores</SelectItem>
                {players.map((player) => (
                  <SelectItem key={player.value} value={player.value}>
                    {player.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filtro-rodada">Rodada</Label>
            <Select
              value={filters.sessionId ?? "todas"}
              onValueChange={(value) => update({ rodada: value === "todas" ? null : value })}
            >
              <SelectTrigger id="filtro-rodada">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as rodadas</SelectItem>
                {sessions.map((session) => (
                  <SelectItem key={session.value} value={session.value}>
                    {session.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showMinGames ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtro-min">Mínimo de jogos</Label>
              <Select
                value={String(filters.minGames ?? 1)}
                onValueChange={(value) => update({ min: value === "1" ? null : value })}
              >
                <SelectTrigger id="filtro-min">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Todas as duplas</SelectItem>
                  <SelectItem value="3">A partir de 3 jogos</SelectItem>
                  <SelectItem value="5">A partir de 5 jogos</SelectItem>
                  <SelectItem value="10">A partir de 10 jogos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
