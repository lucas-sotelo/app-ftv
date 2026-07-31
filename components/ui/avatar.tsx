import { initials } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

/**
 * Avatar por iniciais. A cor de fundo vem de um hash estável do id, para o
 * mesmo jogador ter sempre a mesma cor entre sessões.
 */
const TONES = [
  "bg-skyb-500/18 text-skyb-700 dark:text-skyb-400",
  "bg-court-500/18 text-court-700 dark:text-court-400",
  "bg-sand-400/25 text-secondary-foreground dark:text-sand-100",
  "bg-primary/15 text-primary",
];

function toneFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

export function PlayerAvatar({
  name,
  seed,
  size = "md",
  className,
  imageUrl,
}: {
  name: string;
  seed?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Foto/avatar já enviado (ex.: `groups.avatar_url`). Sem URL, cai nas iniciais. */
  imageUrl?: string | null;
}) {
  const sizes = {
    sm: "size-7 text-[0.65rem]",
    md: "size-9 text-xs",
    lg: "size-14 text-lg",
  } as const;

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitrária, sem domínio fixo para next/image.
      <img
        src={imageUrl}
        alt=""
        aria-hidden
        className={cn("inline-block shrink-0 rounded-full object-cover", sizes[size], className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizes[size],
        toneFor(seed ?? name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
