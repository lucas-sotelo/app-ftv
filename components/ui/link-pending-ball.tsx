"use client";

import { useLinkStatus } from "next/link";
import { BallSpinner } from "@/components/ui/ball-spinner";
import { cn } from "@/lib/utils";

/**
 * Feedback imediato de navegação: rotas de grupo são force-dynamic e, em
 * conexão lenta, o prefetch do loading.tsx pode não terminar a tempo — nesse
 * caso o Next não tem fallback pra mostrar e a tela fica parada sem
 * indício nenhum (ver docs/01-app/.../linking-and-navigating.md, seção
 * "Slow networks"). `useLinkStatus` sabe que o clique está pendente mesmo
 * assim; só precisa estar dentro de um <Link>.
 */
export function LinkPendingBall({ size = 14, className }: { size?: number; className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <BallSpinner
      size={size}
      className={cn("link-pending-ball", pending && "is-pending", className)}
    />
  );
}
