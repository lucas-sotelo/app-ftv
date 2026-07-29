import "@testing-library/jest-dom/vitest";

// O produto é pt-BR e America/Sao_Paulo. Fixar isso nos testes evita que uma
// máquina com outro fuso "passe" num teste de período que quebraria em prod.
process.env.TZ = "America/Sao_Paulo";
