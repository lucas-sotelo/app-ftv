import { expect, test } from "@playwright/test";

/**
 * Requisitos básicos de PWA e de layout mobile. Não dependem de sessão, então
 * rodam isolados do fluxo principal.
 */
test.describe("PWA e layout", () => {
  test("o manifest tem tudo que a instalação exige", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);

    const manifest = await response.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.description).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.theme_color).toBeTruthy();
    expect(manifest.background_color).toBeTruthy();
    expect(manifest.lang).toBe("pt-BR");

    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");

    const maskable = manifest.icons.filter((icon: { purpose?: string }) =>
      icon.purpose?.includes("maskable"),
    );
    expect(maskable.length).toBeGreaterThan(0);
  });

  test("os ícones declarados existem de verdade", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    for (const icon of manifest.icons as { src: string }[]) {
      const response = await request.get(icon.src);
      expect(response.ok(), `${icon.src} deveria existir`).toBe(true);
      expect(response.headers()["content-type"]).toContain("image/png");
    }
  });

  test("o service worker é servido sem cache", async ({ request }) => {
    const response = await request.get("/sw.js");
    expect(response.ok()).toBe(true);
    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  test("a página offline funciona sozinha", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "Você está sem conexão" })).toBeVisible();
  });

  test("o login liga o manifest e não estoura na horizontal em 360px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/entrar");

    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("o app está em português", async ({ page }) => {
    await page.goto("/entrar");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  });
});
