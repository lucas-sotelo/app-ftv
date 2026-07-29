"use client";

import { Download, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "ftv:install-dismissed";

/**
 * Convite de instalação. Só aparece quando o navegador de fato oferece o
 * `beforeinstallprompt` — nada de instruções para quem não pode instalar.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);

  React.useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      // Quem já dispensou o convite não vê de novo.
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      setDeferred(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!deferred) return null;

  return (
    <div className="bg-card mx-4 mb-2 flex items-center gap-3 rounded-[var(--radius-app)] border p-3 shadow-sm">
      <Download className="text-primary size-5 shrink-0" aria-hidden />
      <div className="flex-1">
        <p className="text-sm font-semibold">Instale o app</p>
        <p className="text-muted-foreground text-xs">
          Fica igual a um aplicativo, direto na tela inicial.
        </p>
      </div>
      <Button
        size="sm"
        onClick={async () => {
          await deferred.prompt();
          await deferred.userChoice;
          setDeferred(null);
        }}
      >
        Instalar
      </Button>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setDeferred(null);
        }}
        aria-label="Dispensar convite de instalação"
        className="text-muted-foreground hover:bg-muted flex size-9 items-center justify-center rounded-full"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
