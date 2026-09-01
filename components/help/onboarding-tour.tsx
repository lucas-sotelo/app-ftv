"use client";

import { ClipboardList, HelpCircle, KeyRound, Trophy, Users } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const SEEN_KEY = "ftv:tour-seen";

const STEPS = [
  {
    icon: Users,
    title: "Crie ou entre em um grupo",
    description:
      "Cada grupo de futevôlei ou beach tênis tem seu próprio ranking e histórico. Crie o seu ou peça pra alguém te passar o código de convite.",
  },
  {
    icon: KeyRound,
    title: "Convide a galera",
    description:
      "Como admin, gere um código em Grupo → Convites e manda no WhatsApp. A pessoa entra em \"Entrar com código\" e digita o que você mandou.",
  },
  {
    icon: ClipboardList,
    title: "Registre as partidas",
    description:
      "Depois de cada jogo, registre o placar. Nada de conta na mão — o app calcula tudo pra você.",
  },
  {
    icon: Trophy,
    title: "Acompanhe as estatísticas",
    description:
      "Ranking, saldo de sets, duplas mais fortes e confrontos diretos — tudo atualizado sozinho a cada partida.",
  },
];

/**
 * Tour de boas-vindas. Autocontido (botão "?" + sheet) pra poder ser plugado
 * em mais de um lugar sem duplicar estado. `autoShow` liga a abertura
 * automática na primeira visita (controlada só por localStorage — sem
 * coluna nova no banco pra algo puramente cosmético).
 */
export function OnboardingTour({ autoShow = false }: { autoShow?: boolean }) {
  // Inicializador lazy em vez de efeito: evita o flash de "abre um tick
  // depois de montar" e o setState síncrono dentro de efeito. `window`
  // sempre existe aqui pois o componente já roda hidratado no client.
  const [open, setOpen] = React.useState(
    () => autoShow && typeof window !== "undefined" && localStorage.getItem(SEEN_KEY) !== "1",
  );
  const [step, setStep] = React.useState(0);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      localStorage.setItem(SEEN_KEY, "1");
      setStep(0);
    }
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Como funciona o app"
        onClick={() => setOpen(true)}
      >
        <HelpCircle aria-hidden />
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Como funciona</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="bg-primary/10 text-primary flex size-14 shrink-0 items-center justify-center rounded-full">
              <current.icon className="size-7" aria-hidden />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-base font-semibold">{current.title}</p>
              <p className="text-muted-foreground text-sm text-balance">{current.description}</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5" role="presentation">
            {STEPS.map((s, index) => (
              <span
                key={s.title}
                aria-hidden
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === step ? "bg-primary w-5" : "bg-muted w-1.5",
                )}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                block
                onClick={() => setStep((s) => s - 1)}
              >
                Voltar
              </Button>
            ) : null}
            <Button
              type="button"
              block
              onClick={() => (isLast ? handleOpenChange(false) : setStep((s) => s + 1))}
            >
              {isLast ? "Entendi!" : "Próximo"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
