import { expect, test, type Page } from "@playwright/test";
import { addPlayer, createGroup, joinGroupByCode, pickPlayer, signUp, uniqueEmail } from "./helpers";

/**
 * Jornada completa: da criação da conta até um membro comum tentando (e não
 * conseguindo) uma ação administrativa.
 *
 * Roda em série porque cada passo depende do anterior — é a mesma sequência
 * que uma pessoa faria na beira da quadra.
 */
test.describe.configure({ mode: "serial" });

const PLAYERS = ["Luis", "Alex", "Daniel", "Ronaldo"];

test.describe("fluxo principal", () => {
  const ownerEmail = uniqueEmail("owner");
  const guestEmail = uniqueEmail("convidado");
  let slug = "";
  let inviteCode = "";

  // Testes 1–8 são o mesmo dono de conta navegando em sequência: usam uma
  // única page/context (aberta uma vez em beforeAll), senão cada test()
  // ganharia um context isolado sem a sessão de login dos passos anteriores.
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("1 — cria conta e grupo", async () => {
    await signUp(page, "Dono do Grupo", ownerEmail);
    await page.waitForURL(/\/(comecar)?$/);

    slug = await createGroup(page, `Futevôlei E2E ${Date.now()}`);
    await expect(page.getByRole("link", { name: /Registrar partida/ }).first()).toBeVisible();
  });

  test("2 — cadastra quatro jogadores", async () => {
    for (const name of PLAYERS) {
      await addPlayer(page, slug, name);
    }

    await page.goto(`${slug}/grupo/jogadores`);
    for (const name of PLAYERS) {
      await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
    }
  });

  test("3 — registra partida sem placar", async () => {
    await page.goto(`${slug}/partidas/nova`);

    await pickPlayer(page, "Time A — jogador 1", "Luis");
    await pickPlayer(page, "Time A — jogador 2", "Alex");
    await pickPlayer(page, "Time B — jogador 1", "Daniel");
    await pickPlayer(page, "Time B — jogador 2", "Ronaldo");

    // Sem placar, é obrigatório escolher o vencedor.
    await page.getByRole("button", { name: "Salvar partida" }).click();
    await expect(page.getByText("Sem placar, escolha qual time venceu.")).toBeVisible();

    await page.getByRole("button", { name: "Time A", exact: true }).click();
    await page.getByRole("button", { name: "Salvar partida" }).click();

    await page.waitForURL(`**${slug}/partidas`);
    await expect(page.getByText("Luis")).toBeVisible();
  });

  test("4 — registra partida com placar e deriva o vencedor", async () => {
    await page.goto(`${slug}/partidas/nova`);

    await pickPlayer(page, "Time A — jogador 1", "Luis");
    await pickPlayer(page, "Time A — jogador 2", "Daniel");
    await pickPlayer(page, "Time B — jogador 1", "Alex");
    await pickPlayer(page, "Time B — jogador 2", "Ronaldo");

    await page.getByLabel("Placar do time A").fill("9");
    await page.getByLabel("Placar do time B").fill("15");

    // Com placar o seletor manual de vencedor some.
    await expect(page.getByText("Vencedor pelo placar: Time B")).toBeVisible();

    await page.getByRole("button", { name: "Salvar partida" }).click();
    await page.waitForURL(`**${slug}/partidas`);
    await expect(page.getByText("15", { exact: true })).toBeVisible();
  });

  test("5 — o mesmo jogador não pode entrar duas vezes", async () => {
    await page.goto(`${slug}/partidas/nova`);
    await pickPlayer(page, "Time A — jogador 1", "Luis");
    await page.getByRole("combobox", { name: "Time A — jogador 2" }).click();

    // Luis já está escalado: a opção fica desabilitada em tempo real.
    await expect(page.getByRole("option", { name: "Luis", exact: true })).toBeDisabled();
  });

  test("6 — estatísticas refletem as duas partidas", async () => {
    await page.goto(`${slug}/estatisticas`);

    await expect(page.getByRole("heading", { name: "Estatísticas" })).toBeVisible();
    // Jogo 1: Time A (Luis+Alex) venceu. Jogo 2: Time B (Alex+Ronaldo) venceu
    // pelo placar. Alex jogou nos dois times vencedores (100%); Daniel jogou
    // nos dois perdedores (Daniel+Ronaldo no jogo 1, Luis+Daniel no jogo 2).
    //
    // RankingTable renderiza cards (mobile) e tabela (desktop) ao mesmo
    // tempo, só uma via CSS: getByText(...).first() pegaria a cópia
    // escondida dependendo do viewport, então filtra pela visível.
    await expect(page.getByText("Alex").and(page.locator(":visible")).first()).toBeVisible();
    await expect(page.getByText("100,0%").and(page.locator(":visible")).first()).toBeVisible();

    await page.getByRole("link", { name: "Duplas", exact: true }).click();
    await expect(page).toHaveURL(/aba=duplas/);
    // Nomes da dupla saem em ordem alfabética do banco, não na ordem em que
    // foram escalados no formulário.
    await expect(
      page.getByText("Alex + Luis").and(page.locator(":visible")).first(),
    ).toBeVisible();

    await page.getByRole("link", { name: "Confrontos", exact: true }).click();
    await expect(page).toHaveURL(/aba=confrontos/);
  });

  test("7 — filtros aparecem na URL e podem ser compartilhados", async () => {
    await page.goto(`${slug}/estatisticas?periodo=year&min=1`);
    await expect(page.getByRole("heading", { name: "Estatísticas" })).toBeVisible();
    await expect(page).toHaveURL(/periodo=year/);
  });

  test("8 — gera um convite", async () => {
    await page.goto(`${slug}/grupo`);
    await page.getByRole("button", { name: /Gerar convite/ }).click();

    const code = page.locator("li p.font-mono").first();
    await expect(code).toBeVisible();
    inviteCode = (await code.textContent())?.trim() ?? "";
    expect(inviteCode.length).toBeGreaterThan(4);
  });

  test("9 — convidado entra no grupo e consegue ler", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await signUp(page, "Membro Convidado", guestEmail);
    await page.waitForURL(/\/(comecar)?$/);

    await joinGroupByCode(page, inviteCode);
    await page.waitForURL(`**${slug}`);

    // Lê partidas e estatísticas normalmente.
    await page.goto(`${slug}/partidas`);
    await expect(page.getByText("Luis").first()).toBeVisible();

    await page.goto(`${slug}/estatisticas`);
    await expect(page.getByRole("heading", { name: "Estatísticas" })).toBeVisible();

    await context.close();
  });

  test("10 — membro comum não vê nem alcança ações administrativas", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(guestEmail);
    await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste-123");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL(`**${slug}`);

    // A interface não oferece o atalho de registrar partida.
    await expect(page.getByRole("link", { name: /Registrar partida/ })).toHaveCount(0);

    // E ir direto na URL também não funciona: o servidor redireciona.
    await page.goto(`${slug}/partidas/nova`);
    await page.waitForURL(`**${slug}/partidas`);
    await expect(page.getByRole("button", { name: "Salvar partida" })).toHaveCount(0);

    await page.goto(`${slug}/grupo/jogadores`);
    await page.waitForURL(`**${slug}/grupo`);
    await expect(page.getByRole("button", { name: "Novo jogador" })).toHaveCount(0);

    await context.close();
  });

  test("11 — não expõe outro grupo trocando o slug na URL", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const otherEmail = uniqueEmail("outro");
    await signUp(page, "Pessoa de Fora", otherEmail);
    await page.waitForURL(/\/(comecar)?$/);
    await createGroup(page, `Outro grupo ${Date.now()}`);

    // Tentar acessar o grupo alheio pelo slug dá "não encontrado".
    await page.goto(slug);
    await expect(page.getByText("Grupo não encontrado")).toBeVisible();

    await context.close();
  });
});
