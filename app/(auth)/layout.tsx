import Image from "next/image";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="from-sand-50 via-background to-skyb-400/10 dark:bg-background relative flex flex-1 overflow-hidden bg-gradient-to-br md:flex-row">
      {/* Manchas de luz decorativas — só no fundo claro, discretas o
          bastante pra não brigar com o conteúdo em cima. */}
      <div
        aria-hidden
        className="bg-court-400/20 pointer-events-none absolute -top-24 -left-24 size-72 rounded-full blur-3xl dark:hidden"
      />
      <div
        aria-hidden
        className="bg-skyb-400/20 pointer-events-none absolute -right-20 bottom-0 size-80 rounded-full blur-3xl dark:hidden"
      />

      {/* Painel lateral: só a partir de md, para não competir com o
          formulário em telas pequenas (mobile-first, 360px). */}
      <div className="relative hidden md:block md:w-2/5 lg:w-1/2">
        <Image
          src="/images/banner-home.jpg"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="(min-width: 768px) 50vw, 0px"
        />
        <div className="from-foreground/80 via-foreground/10 absolute inset-0 bg-gradient-to-t to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-8 text-white lg:p-10">
          <p className="text-xl leading-snug font-bold tracking-tight text-balance lg:text-2xl">
            Sua resenha, suas estatísticas.
          </p>
          <p className="mt-1.5 text-sm text-white/80">
            Partidas, duplas e rankings do seu grupo de futevôlei e beach tênis.
          </p>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-app)] shadow-md md:hidden">
              <Image
                src="/images/banner-home.jpg"
                alt=""
                fill
                priority
                className="object-cover"
                sizes="400px"
              />
              <div className="from-foreground/70 absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
            </div>
            <div>
              <h1 className="text-2xl leading-tight font-extrabold tracking-tight">
                Resenha na Areia
              </h1>
              <p className="text-muted-foreground text-sm">
                Partidas, duplas e estatísticas do grupo.
              </p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
