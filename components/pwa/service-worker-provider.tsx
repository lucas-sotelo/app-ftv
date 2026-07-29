"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface PwaState {
  online: boolean;
  updateReady: boolean;
  applyUpdate: () => void;
}

const PwaContext = React.createContext<PwaState>({
  online: true,
  updateReady: false,
  applyUpdate: () => {},
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

  const [waiting, setWaiting] = React.useState<ServiceWorker | null>(null);

  React.useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    let registration: ServiceWorkerRegistration | undefined;
    // clients.claim() no activate faz o SW assumir a página já na primeira
    // instalação: sem essa marca, o controllerchange resultante recarregaria
    // a página logo após o load, derrubando o que já tinha sido digitado.
    const hadController = Boolean(navigator.serviceWorker.controller);

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        if (registration.waiting) setWaiting(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const installing = registration?.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // Só é "atualização" se já havia um SW controlando a página.
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(installing);
            }
          });
        });
      } catch {
        // PWA é progressivo: falhar aqui não pode derrubar o app.
      }
    };

    void register();

    let reloading = false;
    const onControllerChange = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
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

  const applyUpdate = React.useCallback(() => {
    waiting?.postMessage({ type: "SKIP_WAITING" });
  }, [waiting]);

  const value = React.useMemo(
    () => ({ online, updateReady: waiting !== null, applyUpdate }),
    [online, waiting, applyUpdate],
  );

  return (
    <PwaContext.Provider value={value}>
      {children}
      <OfflineBanner online={online} />
      {waiting ? <UpdateBanner onApply={applyUpdate} /> : null}
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

function UpdateBanner({ onApply }: { onApply: () => void }) {
  return (
    <div
      role="status"
      className="bg-card fixed inset-x-3 bottom-20 z-50 flex items-center gap-3 rounded-[var(--radius-app)] border p-3 shadow-lg sm:left-auto sm:w-80"
    >
      <RefreshCw className="text-primary size-5 shrink-0" />
      <p className="flex-1 text-sm font-medium">Nova versão disponível.</p>
      <Button size="sm" onClick={onApply}>
        Atualizar
      </Button>
    </div>
  );
}
