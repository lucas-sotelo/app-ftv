import { Trophy } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/ui/avatar";
import type { MatchListItem, MatchPlayerRef } from "@/lib/data/types";
import { formatTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

function TeamLine({
  players,
  won,
  score,
  slug,
}: {
  players: MatchPlayerRef[];
  won: boolean;
  score: number | null;
  slug: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-[calc(var(--radius-app)-0.35rem)] px-2 py-1.5",
        won && "bg-accent/60",
      )}
    >
      <Trophy
        className={cn("size-4 shrink-0", won ? "text-court-700 dark:text-court-400" : "opacity-0")}
        aria-hidden
      />
      <div className="flex -space-x-2">
        {players.map((player) => (
          <PlayerAvatar
            key={player.playerId}
            name={player.displayName}
            seed={player.playerId}
            imageUrl={player.avatarUrl}
            size="sm"
            className="ring-card ring-2"
          />
        ))}
      </div>
      <p className={cn("min-w-0 flex-1 text-sm", won ? "font-semibold" : "text-muted-foreground")}>
        {players.map((player, index) => (
          <span key={player.playerId}>
            {index > 0 ? <span className="text-muted-foreground"> + </span> : null}
            <Link
              href={`/${slug}/jogadores/${player.playerId}`}
              className="hover:underline"
              prefetch={false}
            >
              {player.displayName}
            </Link>
          </span>
        ))}
      </p>
      {score !== null ? <span className="tabular text-base font-bold">{score}</span> : null}
      <span className="sr-only">{won ? "venceu" : "perdeu"}</span>
    </div>
  );
}

export function MatchCard({
  match,
  slug,
  timeZone,
  actions,
}: {
  match: MatchListItem;
  slug: string;
  timeZone: string;
  actions?: React.ReactNode;
}) {
  const removed = match.deletedAt !== null;
  const voided = match.status === "voided";

  return (
    <article
      className={cn(
        "bg-card rounded-[var(--radius-app)] border p-2",
        (removed || voided) && "opacity-70",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-1">
        <span className="text-muted-foreground tabular text-xs">
          {formatTime(match.playedAt, timeZone)}
        </span>
        <div className="flex items-center gap-1.5">
          {voided ? <Badge variant="warning">Anulada</Badge> : null}
          {removed ? <Badge variant="danger">Excluída</Badge> : null}
          {actions}
        </div>
      </div>

      <TeamLine
        players={match.teamA}
        won={match.winningSide === "A"}
        score={match.teamAScore}
        slug={slug}
      />
      <div className="text-muted-foreground px-2 py-0.5 text-center text-xs font-semibold">×</div>
      <TeamLine
        players={match.teamB}
        won={match.winningSide === "B"}
        score={match.teamBScore}
        slug={slug}
      />

      {match.notes ? (
        <p className="text-muted-foreground px-2 pt-1.5 pb-1 text-xs">{match.notes}</p>
      ) : null}
    </article>
  );
}
