import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.test.local", quiet: true });
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const missing = REQUIRED.filter((name) => !process.env[name]);

if (missing.length > 0) {
  throw new Error(
    [
      "Os testes de integração precisam de um Supabase de verdade.",
      "",
      `Faltam: ${missing.join(", ")}`,
      "",
      "Suba um banco local com `npx supabase start` e aponte as variáveis para ele",
      "(ou use um projeto descartável). Detalhes no README, seção Testes.",
      "",
      "ATENÇÃO: nunca aponte para o banco de produção — os testes criam e apagam dados.",
    ].join("\n"),
  );
}

process.env.TZ = "America/Sao_Paulo";
