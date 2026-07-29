"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
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
}

export function GroupSwitcher({
  groups,
  currentSlug,
}: {
  groups: GroupOption[];
  currentSlug: string;
}) {
  const router = useRouter();
  const current = groups.find((g) => g.slug === currentSlug);

  // Com um grupo só, o seletor vira apenas o título — sem controle inútil.
  if (groups.length <= 1) {
    return <span className="truncate text-base font-bold">{current?.name ?? "Grupo"}</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-h-11 items-center gap-1.5 rounded-[var(--radius-app)] px-1 text-left">
        <span className="truncate text-base font-bold">{current?.name ?? "Grupo"}</span>
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <span className="sr-only">Trocar de grupo</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Seus grupos</DropdownMenuLabel>
        {groups.map((group) => (
          <DropdownMenuItem
            key={group.id}
            onSelect={() => router.push(`/${group.slug}`)}
            className="justify-between"
          >
            <span className="truncate">{group.name}</span>
            {group.slug === currentSlug ? <Check className="size-4" aria-hidden /> : null}
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
