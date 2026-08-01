import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.193.99.76'],
  reactStrictMode: true,
  experimental: {
    // Default é 0 desde o Next 15 (ver node_modules/next/dist/docs/.../staleTimes.md):
    // toda troca de aba dentro de um grupo (force-dynamic) refazia a busca no
    // servidor do zero, mesmo sem dado novo. GroupRealtime já força
    // router.refresh() quando algo muda de verdade, então reaproveitar por 30s
    // não introduz dado obsoleto além do que já é aceitável.
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [
      {
        // O service worker nunca pode ficar preso em cache: senão o app trava
        // numa versão antiga e o aviso de "nova versão" nunca dispara.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
