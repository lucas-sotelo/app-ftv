import { cn } from "@/lib/utils";

/**
 * Bola de futevôlei (gomos amarelo/preto, estilo Mikasa) girando via CSS —
 * sem GIF/lib de animação, só SVG + a keyframe `app-spin` de globals.css
 * (que já respeita prefers-reduced-motion). Usada nos loadings de rota.
 */
export function BallSpinner({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      role="status"
      aria-label="Carregando"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn("ball-spin shrink-0", className)}
    >
      <circle cx="50" cy="50" r="47" fill="#f4c716" stroke="#1a1a1a" strokeWidth="3" />
      <path d="M50,50 L98,50 A48,48 0 0,1 74,91.57 Z" fill="#1a1a1a" />
      <path d="M50,50 L26,91.57 A48,48 0 0,1 2,50 Z" fill="#1a1a1a" />
      <path d="M50,50 L26,8.43 A48,48 0 0,1 74,8.43 Z" fill="#1a1a1a" />
      <circle cx="50" cy="50" r="47" fill="none" stroke="#1a1a1a" strokeWidth="3" />
      <ellipse cx="36" cy="30" rx="12" ry="6" fill="#fff" opacity="0.25" />
    </svg>
  );
}
