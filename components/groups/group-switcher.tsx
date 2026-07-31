"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { PlayerAvatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface GroupOption {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string | null;
}

export function GroupSwitcher({
  groups,
  currentSlug,
}: {
  groups: GroupOption[];
  currentSlug: string;
}) {
  const router = useRouter();

  // Defesa em profundidade: a fonte já deveria vir única por id, mas um
  // dropdown duplicado é um bug visual grave demais para confiar só nisso.
  const uniqueGroups = React.useMemo(() => {
    const seen = new Set<string>();
    return groups.filter((group) => {
      if (seen.has(group.id)) return false;
      seen.add(group.id);
      return true;
    });
  }, [groups]);

  const current = uniqueGroups.find((g) => g.slug === currentSlug);

  // Com um grupo só, o seletor vira apenas o título — sem controle inútil.
  if (uniqueGroups.length <= 1) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <PlayerAvatar
          name={current?.name ?? "Grupo"}
          seed={current?.id}
          imageUrl={current?.avatarUrl}
          size="sm"
        />
        <span className="truncate text-base font-bold">{current?.name ?? "Grupo"}</span>
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-[var(--radius-app)] px-1 text-left">
        <PlayerAvatar
          name={current?.name ?? "Grupo"}
          seed={current?.id}
          imageUrl={current?.avatarUrl}
          size="sm"
        />
        <span className="truncate text-base font-bold">{current?.name ?? "Grupo"}</span>
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <span className="sr-only">Trocar de grupo</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
        <DropdownMenuLabel>Seus grupos</DropdownMenuLabel>
        {uniqueGroups.map((group) => (
          <DropdownMenuItem
            key={group.id}
            onSelect={() => router.push(`/${group.slug}`)}
            className="justify-between"
          >
            <span className="flex min-w-0 items-center gap-2">
              <PlayerAvatar
                name={group.name}
                seed={group.id}
                imageUrl={group.avatarUrl}
                size="sm"
              />
              <span className="truncate">{group.name}</span>
            </span>
            {group.slug === currentSlug ? <Check className="size-4 shrink-0" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/comecar")}>
          <Plus aria-hidden />
          Criar ou entrar em grupo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
