import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Script from "next/script";
import { Toaster } from "sonner";
import { BootSplash } from "@/components/pwa/boot-splash";
import { PwaUpdater } from "@/components/pwa/pwa-updater";
import { ServiceWorkerProvider } from "@/components/pwa/service-worker-provider";
import "./globals.css";

// Captura o `beforeinstallprompt` o quanto antes (antes da hidratação): em
// mobile, com o bundle ainda carregando, o evento pode disparar antes do
// InstallPrompt montar — ou numa rota onde ele nem existe (ex.: /comecar).
// Guardar em `window` evita perder o evento pra sempre nesses casos.
const CAPTURE_INSTALL_PROMPT_SCRIPT = `
  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    window.__ftvInstallPrompt = event;
    window.dispatchEvent(new Event("ftv:beforeinstallprompt"));
  });
`;

const sans = Geist({ variable: "--font-sans-app", subsets: ["latin"], display: "swap" });
const mono = Geist_Mono({ variable: "--font-mono-app", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Resenha na Areia — partidas e estatísticas",
    template: "%s · Resenha na Areia",
  },
  description:
    "Organize os grupos de futevôlei e beach tênis, registre as partidas e acompanhe estatísticas de jogadores, duplas e confrontos.",
  applicationName: "Resenha na Areia",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Resenha na Areia",
  },
  icons: {
    icon: [
      { url: "/icons/icon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/images/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/images/icon-192x192.png", sizes: "192x192" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfbf6" },
    { media: "(prefers-color-scheme: dark)", color: "#12161f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <Script id="pwa-install-capture" strategy="beforeInteractive">
        {CAPTURE_INSTALL_PROMPT_SCRIPT}
      </Script>
      <body className="flex min-h-dvh flex-col antialiased">
        <BootSplash />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ServiceWorkerProvider>{children}</ServiceWorkerProvider>
          <PwaUpdater />
          <Toaster position="top-center" richColors closeButton toastOptions={{ duration: 4000 }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
