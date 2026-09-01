"use client";

import { BarChart3, Flame, Home, ListOrdered, Menu, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LinkPendingBall } from "@/components/ui/link-pending-ball";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { key: "inicio", label: "Início", icon: Home, segment: "" },
  { key: "partidas", label: "Partidas", icon: ListOrdered, segment: "partidas" },
  { key: "estatisticas", label: "Estatísticas", icon: BarChart3, segment: "estatisticas" },
  { key: "resenha", label: "Resenha", icon: Flame, segment: "resenha" },
] as const;

const MORE_ITEMS = [
  { key: "grupo", label: "Grupo", icon: Users, segment: "grupo" },
  { key: "perfil", label: "Perfil", icon: User, segment: "perfil" },
] as const;

export function BottomNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const base = `/${slug}`;

  const moreActive = MORE_ITEMS.some((item) => pathname.startsWith(`${base}/${item.segment}`));

  return (
    <nav
      aria-label="Navegação principal"
      className="bg-card/95 safe-bottom sticky bottom-0 z-30 border-t backdrop-blur"
    >
      <ul className="mx-auto flex max-w-3xl">
        {NAV_ITEMS.map((item) => {
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
                <span className="relative inline-flex">
                  <Icon className="size-5" aria-hidden />
                  <LinkPendingBall size={10} className="absolute -top-1.5 -right-1.5" />
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger
              aria-current={moreActive ? "page" : undefined}
              className={cn(
                "touch-target flex w-full flex-col items-center justify-center gap-0.5 py-1.5 text-[0.68rem] font-medium",
                moreActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Menu className="size-5" aria-hidden />
              <span>Mais</span>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Mais opções</SheetTitle>
              </SheetHeader>
              <ul className="flex flex-col gap-1">
                {MORE_ITEMS.map((item) => {
                  const href = `${base}/${item.segment}`;
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  const Icon = item.icon;

                  return (
                    <li key={item.key}>
                      <Link
                        href={href}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-[var(--radius-app)] px-3 py-3 text-sm font-medium",
                          active ? "bg-primary/10 text-primary" : "hover:bg-muted",
                        )}
                      >
                        <span className="relative inline-flex">
                          <Icon className="size-5" aria-hidden />
                          <LinkPendingBall size={10} className="absolute -top-1.5 -right-1.5" />
                        </span>
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
