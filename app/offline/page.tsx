import { WifiOff } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sem conexão" };

/**
 * Fallback do service worker. É estática de propósito: precisa funcionar sem
 * rede e sem sessão.
 */
export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOff className="text-muted-foreground size-10" aria-hidden />
      <h1 className="text-xl font-bold">Você está sem conexão</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        As telas já visitadas continuam disponíveis. Para registrar uma partida é preciso estar
        online — nada fica pendente de sincronização.
      </p>
    </main>
  );
}
