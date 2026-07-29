"use client";

import { UserPlus } from "lucide-react";
import * as React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PlayerRow } from "@/lib/supabase/database.types";

export const NEW_PLAYER_VALUE = "__novo__";

/**
 * Seleção de jogador para um slot da partida.
 *
 * Quem já foi escalado em outro slot aparece desabilitado — é assim que a
 * regra "4 jogadores distintos" é sentida em tempo real, antes de qualquer
 * validação de formulário.
 */
export function PlayerSelect({
  id,
  value,
  onChange,
  players,
  takenIds,
  onCreateNew,
  label,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  players: PlayerRow[];
  takenIds: string[];
  onCreateNew: () => void;
  label: string;
  invalid?: boolean;
}) {
  const selected = players.find((p) => p.id === value);

  // Um jogador desativado que já estava na partida continua listado, senão a
  // edição de uma partida antiga perderia a escalação.
  const options = React.useMemo(
    () => players.filter((p) => p.active || p.id === value),
    [players, value],
  );

  return (
    <Select
      value={value || undefined}
      onValueChange={(next) => {
        if (next === NEW_PLAYER_VALUE) {
          onCreateNew();
          return;
        }
        onChange(next);
      }}
    >
      <SelectTrigger id={id} aria-label={label} aria-invalid={invalid}>
        <SelectValue placeholder="Escolher jogador">
          {selected ? selected.display_name : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Jogadores</SelectLabel>
          {options.map((player) => (
            <SelectItem
              key={player.id}
              value={player.id}
              disabled={takenIds.includes(player.id) && player.id !== value}
            >
              {player.display_name}
              {player.is_guest ? " (convidado)" : ""}
              {!player.active ? " (inativo)" : ""}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectItem value={NEW_PLAYER_VALUE} className="text-primary font-medium">
          <span className="flex items-center gap-2">
            <UserPlus className="size-4" aria-hidden />
            Novo jogador
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
