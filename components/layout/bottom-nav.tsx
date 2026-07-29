"use client";

import { BarChart3, Home, ListOrdered, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "inicio", label: "Início", icon: Home, segment: "" },
  { key: "partidas", label: "Partidas", icon: ListOrdered, segment: "partidas" },
  { key: "estatisticas", label: "Estatísticas", icon: BarChart3, segment: "estatisticas" },
  { key: "grupo", label: "Grupo", icon: Users, segment: "grupo" },
  { key: "perfil", label: "Perfil", icon: User, segment: "perfil" },
] as const;

export function BottomNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/${slug}`;

  return (
    <nav
      aria-label="Navegação principal"
      className="bg-card/95 safe-bottom sticky bottom-0 z-30 border-t backdrop-blur"
    >
      <ul className="mx-auto flex max-w-3xl">
        {ITEMS.map((item) => {
          const href = item.segment ? `${base}/${item.segment}` : base;
          const active = item.segment
            ? pathname === href || pathname.startsWith(`${href}/`)
            : pathname === base;
          const Icon = item.icon;

          return (
            <li key={item.key} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "touch-target flex flex-col items-center justify-center gap-0.5 py-1.5 text-[0.68rem] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
