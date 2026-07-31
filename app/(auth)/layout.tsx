import Image from "next/image";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={64}
            height={64}
            className="rounded-[var(--radius-app)] shadow-sm"
            priority
          />
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
    </main>
  );
}
