"use client";

import { LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { PlayerAvatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/actions/auth";

export function HomeUserMenu({
  displayName,
  avatarUrl,
  profileHref,
}: {
  displayName: string;
  avatarUrl: string | null;
  /** Perfil vive dentro de um grupo — sem grupo ainda, não há para onde ir. */
  profileHref: string | null;
}) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
        aria-label="Menu da conta"
      >
        <PlayerAvatar name={displayName} imageUrl={avatarUrl} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profileHref ? (
          <DropdownMenuItem onSelect={() => router.push(profileHref)}>
            <User aria-hidden />
            Perfil
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem variant="destructive" onSelect={() => signOutAction()}>
          <LogOut aria-hidden />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
