"use client";

import { ArrowDown, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <TriangleAlert className="text-destructive size-10" aria-hidden />
      <h1 className="text-xl font-bold">Algo deu errado</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Não foi possível carregar esta tela. Tente novamente; se persistir, verifique sua conexão.
      </p>
      <Button onClick={reset}>Tentar de novo</Button>
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <ArrowDown className="size-3.5" aria-hidden />
        Arraste a tela para baixo para recarregar o app
      </p>
    </main>
  );
}
