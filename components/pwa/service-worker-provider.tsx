"use client";

import { WifiOff } from "lucide-react";
import * as React from "react";
import { createClient } from "@/lib/supabase/client";

interface PwaState {
  online: boolean;
}

const PwaContext = React.createContext<PwaState>({
  online: true,
});

export function useOnline() {
  return React.useContext(PwaContext).online;
}

function subscribeToConnectivity(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  // O estado de conexão é uma fonte externa: no servidor assumimos online,
  // para o HTML inicial não vir com o aviso de offline.
  const online = React.useSyncExternalStore(
    subscribeToConnectivity,
    () => navigator.onLine,
    () => true,
  );

  React.useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // PWA é progressivo: falhar aqui não pode derrubar o app.
    });
  }, []);

  // O cache de páginas guarda HTML renderizado com os dados do usuário.
  // Ao trocar de conta ou sair, ele é descartado.
  React.useEffect(() => {
    const supabase = createClient();
    let lastUserId: string | null = null;

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user.id ?? null;
      const changedUser = userId !== lastUserId;
      lastUserId = userId;
      if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && changedUser)) {
        navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PRIVATE_CACHE" });
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const value = React.useMemo(() => ({ online }), [online]);

  return (
    <PwaContext.Provider value={value}>
      {children}
      <OfflineBanner online={online} />
    </PwaContext.Provider>
  );
}

function OfflineBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div
      role="status"
      className="bg-sand-300 text-secondary-foreground fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
    >
      <WifiOff className="size-4 shrink-0" />
      <span>Sem conexão. Você pode consultar, mas não registrar partidas.</span>
    </div>
  );
}
