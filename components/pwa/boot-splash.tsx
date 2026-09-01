"use client";

import * as React from "react";
import { BallSpinner } from "@/components/ui/ball-spinner";

const PHRASES = [
  "Ajustando as marcações da quadra…",
  "Conferindo a altura da rede…",
  "Esquentando a areia…",
  "Enchendo a bola de ar…",
  "Alongando pro primeiro saque…",
  "Afiando o levantamento…",
];

const PHRASE_INTERVAL_MS = 500;
const FADE_MS = 300;
const SESSION_KEY = "ftv-booted";

/**
 * Tela de boot mostrada só na abertura fria do app (uma vez por sessão de
 * aba — sessionStorage), vivendo no layout raiz. Como o layout raiz não
 * remonta em navegações internas do App Router, ela nunca aparece de novo
 * ao trocar de tela dentro do app, só num carregamento/refresh de verdade.
 *
 * O ícone estático do PWA por trás disso (splash nativo do SO, controlado
 * pelo manifest.webmanifest) já cobre o instante antes do JS carregar —
 * esta tela cobre o instante logo depois, com o "de repente soltando umas
 * frases" pedido.
 */
export function BootSplash() {
  const [phase, setPhase] = React.useState<"visible" | "fading" | "gone">("visible");
  const [phraseIndex, setPhraseIndex] = React.useState(0);

  React.useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      const t = window.setTimeout(() => setPhase("gone"), 0);
      return () => window.clearTimeout(t);
    }
    sessionStorage.setItem(SESSION_KEY, "1");

    const stepTimers = PHRASES.map((_, i) =>
      window.setTimeout(() => setPhraseIndex(i), i * PHRASE_INTERVAL_MS),
    );
    const fadeTimer = window.setTimeout(
      () => setPhase("fading"),
      PHRASES.length * PHRASE_INTERVAL_MS,
    );
    const goneTimer = window.setTimeout(
      () => setPhase("gone"),
      PHRASES.length * PHRASE_INTERVAL_MS + FADE_MS,
    );

    return () => {
      for (const t of stepTimers) window.clearTimeout(t);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(goneTimer);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      className="bg-background fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 transition-opacity"
      style={{ opacity: phase === "fading" ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
    >
      <BallSpinner />
      <p
        key={phraseIndex}
        aria-live="polite"
        className="animate-in fade-in text-muted-foreground px-6 text-center text-sm font-medium"
      >
        {PHRASES[phraseIndex]}
      </p>
    </div>
  );
}
