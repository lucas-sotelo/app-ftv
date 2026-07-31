import Image from "next/image";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 md:flex-row">
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
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-app)] shadow-sm md:hidden">
              <Image
                src="/images/banner-home.jpg"
                alt=""
                fill
                priority
                className="object-cover"
                sizes="400px"
              />
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
