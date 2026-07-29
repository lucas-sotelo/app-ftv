import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Métrica principal em número grande. Nada de "card corporativo": o valor
 * domina, o rótulo fica discreto e o detalhe explica a amostra.
 */
export function StatTile({
  label,
  value,
  detail,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card flex flex-col gap-0.5 rounded-[var(--radius-app)] border p-3",
        className,
      )}
    >
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <div className="tabular text-2xl leading-tight font-bold">{value}</div>
      {detail ? <div className="text-muted-foreground truncate text-xs">{detail}</div> : null}
    </div>
  );
}
