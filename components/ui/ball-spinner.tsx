import { cn } from "@/lib/utils";

/**
 * Bola de futevôlei girando via CSS — só SVG, sem GIF/lib de animação. Três
 * "costuras" curvas espelham o padrão de gomos de uma bola de verdade
 * (Mikasa FT-5), rotacionadas 120° via <g transform>. Usada só na tela de
 * boot: em telas pequenas/rápidas (loading.tsx de rota) ela ficava apertada
 * e chamava mais atenção do que ajudava, então foi tirada de lá.
 */
export function BallSpinner({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <svg
      role="status"
      aria-label="Carregando"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn("ball-spin shrink-0", className)}
    >
      <circle cx="50" cy="50" r="45" fill="#f7c823" stroke="#161616" strokeWidth="4" />
      <g fill="none" stroke="#161616" strokeWidth="6" strokeLinecap="round">
        <path d="M50,7 C73,22 73,78 50,93" />
        <path d="M50,7 C73,22 73,78 50,93" transform="rotate(120 50 50)" />
        <path d="M50,7 C73,22 73,78 50,93" transform="rotate(240 50 50)" />
      </g>
      <ellipse cx="34" cy="27" rx="10" ry="5" fill="#fff" opacity="0.3" />
    </svg>
  );
}
