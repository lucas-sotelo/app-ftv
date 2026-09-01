import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export function uniqueEmail(label: string) {
  return `ftv-e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
}

export const PASSWORD = "senha-de-teste-123";

export async function signUp(page: Page, name: string, email: string) {
  await page.goto("/criar-conta");
  await page.getByLabel("Seu nome").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmar senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();
}

export async function signIn(page: Page, email: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

/**
 * Quem chega em "/comecar" sem nenhum grupo vê o tour de boas-vindas abrir
 * sozinho, e ele bloqueia o resto da tela (mesmo padrão do JoinGroupDialog
 * via convite). Fecha antes de interagir com os cartões por baixo.
 */
async function dismissOnboardingTourIfOpen(page: Page) {
  try {
    await page.getByRole("heading", { name: "Como funciona" }).waitFor({ timeout: 2000 });
    await page.getByRole("button", { name: "Fechar" }).click();
  } catch {
    // Sem tour (já tem grupo) — segue direto.
  }
}

export async function createGroup(page: Page, name: string) {
  await page.goto("/comecar");
  await dismissOnboardingTourIfOpen(page);

  // O cartão "Criar grupo" abre o dialog; o botão de dentro tem o mesmo
  // texto, então precisa desambiguar pegando o último (o de submit).
  await page.getByRole("button", { name: "Criar grupo" }).click();
  await page.getByLabel("Nome do grupo").fill(name);
  await page.getByRole("button", { name: "Criar grupo" }).last().click();
  // "/comecar" já bate com /[a-z0-9-]+$/, então esperar só esse padrão
  // resolve na hora, antes do redirect: precisa excluir a própria origem.
  await page.waitForURL((url) => url.pathname !== "/comecar" && /^\/[a-z0-9-]+$/.test(url.pathname));
  return new URL(page.url()).pathname;
}

/** Entra num grupo pelo cartão "Entrar com código" em "/comecar". */
export async function joinGroupByCode(page: Page, code: string) {
  await page.goto("/comecar");
  await dismissOnboardingTourIfOpen(page);

  await page.getByRole("button", { name: "Entrar com código" }).click();
  await page.getByLabel("Código do convite").fill(code);
  await page.getByRole("button", { name: "Entrar no grupo" }).click();
}

/** Cadastra um jogador pela tela de administração do grupo. */
export async function addPlayer(page: Page, slug: string, name: string) {
  await page.goto(`${slug}/grupo/jogadores`);
  await page.getByRole("button", { name: "Novo jogador" }).click();
  await page.getByLabel("Nome").fill(name);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

/** Escolhe um jogador num dos quatro slots do formulário de partida. */
export async function pickPlayer(page: Page, slotLabel: string, playerName: string) {
  await page.getByRole("combobox", { name: slotLabel }).click();
  await page.getByRole("option", { name: playerName, exact: true }).click();
}
