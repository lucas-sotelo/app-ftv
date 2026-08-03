import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element -- background full-screen fixo (position: fixed), incompatível com o position: absolute embutido no next/image `fill`. */}
      <img
        src="/images/imagem_ftv_home.png"
        alt=""
        aria-hidden
        className="fixed inset-0 z-0 h-full w-full object-cover"
      />
      <div aria-hidden className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm" />

      <div className="relative z-20 flex w-full max-w-sm flex-col items-center gap-3 px-4 py-10 text-center text-white">
        <h1 className="text-2xl leading-tight font-extrabold tracking-tight">Resenha na Areia</h1>
        <p className="text-sm text-white/80">Partidas, duplas e estatísticas do grupo.</p>
        <div className="mt-3 w-full">{children}</div>
      </div>
    </main>
  );
}
