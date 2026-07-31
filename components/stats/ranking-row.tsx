import Link from "next/link";
import { PlayerAvatar } from "@/components/ui/avatar";
import { WinRateBar } from "@/components/ui/win-rate";
import { formatGames } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

/**
 * Linha de ranking em formato de card — usada no celular.
 * A amostra (nº de jogos) aparece sempre: "1 jogo" nunca vira 100% escondido.
 */
export function RankingRow({
  position,
  title,
  subtitle,
  href,
  games,
  wins,
  losses,
  winRate,
  avatarSeed,
  avatarUrl,
  highlight = false,
  emoji,
}: {
  position: number;
  title: string;
  subtitle?: string;
  href?: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  avatarSeed?: string;
  avatarUrl?: string | null;
  highlight?: boolean;
  emoji?: string | null;
}) {
  const content = (
    <>
      <span
        className={cn(
          "tabular w-6 shrink-0 text-center text-sm font-bold",
          position <= 3 ? "text-primary" : "text-muted-foreground",
        )}
        aria-label={`${position}º lugar`}
      >
        {position}
      </span>
      {avatarSeed ? (
        <PlayerAvatar name={title} seed={avatarSeed} imageUrl={avatarUrl} size="sm" />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {emoji ? <span aria-hidden>{emoji} </span> : null}
          {title}
        </span>
        <span className="text-muted-foreground block truncate text-xs">
          {subtitle ? `${subtitle} · ` : ""}
          {formatGames(games)} · {wins}V {losses}D
        </span>
      </span>
      <WinRateBar value={winRate} className="w-24 shrink-0 justify-end" compact />
    </>
  );

  const className = cn(
    "bg-card flex min-h-14 w-full items-center gap-2 rounded-[var(--radius-app)] border px-2 py-2 text-left",
    highlight && "border-primary/40 bg-primary/5",
    href && "hover:bg-muted/60 transition-colors",
  );

  if (!href) return <div className={className}>{content}</div>;
  return (
    <Link href={href} className={className} prefetch={false}>
      {content}
    </Link>
  );
}
