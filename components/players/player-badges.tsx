interface BadgeIcon {
  icon: string;
  label: string;
  description?: string;
}

/**
 * Fileira de ícones de conquista. `title` é o tooltip nativo do navegador —
 * o projeto não tem um componente de Tooltip hoje, e um só para isso seria
 * abstração além do necessário.
 */
export function PlayerBadges({
  badges,
  size = "md",
}: {
  badges: BadgeIcon[];
  size?: "sm" | "md";
}) {
  if (badges.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-1" aria-label="Conquistas">
      {badges.map((badge) => (
        <li key={badge.label}>
          <span
            title={badge.description ? `${badge.label}: ${badge.description}` : badge.label}
            aria-label={badge.label}
            className={size === "sm" ? "text-sm" : "text-base"}
          >
            {badge.icon}
          </span>
        </li>
      ))}
    </ul>
  );
}
