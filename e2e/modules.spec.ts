import { test, expect } from "@playwright/test";

/**
 * Módulos por empresa: el superusuario desactiva uno, sale del menú agrupado y su URL da 404;
 * al reactivarlo vuelve. Usa una empresa propia para no afectar a los demás specs.
 * Requiere `npm run db:seed` (superusuario).
 */
test("el superusuario activa y desactiva módulos de una empresa", async ({ page }) => {
  test.setTimeout(2 * 60_000);
  const stamp = Date.now();
  const slug = `e2e-mod-${stamp}`;

  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/);

  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Módulos ${stamp}`);
  await page.getByLabel(/^Slug/).fill(slug);
  await page.getByRole("button", { name: "Crear tenant y aplicar plantilla" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`), { timeout: 30_000 });

  const modules = page.getByRole("region", { name: "Módulos de la empresa" }).or(page.locator("section", { hasText: "Módulos de la empresa" }));
  await expect(modules.getByText("§6.1 (9001 · 14001 · 45001)")).toBeVisible();
  await expect(modules.getByText("Próximamente").first()).toBeVisible();
  await expect(modules.getByRole("button", { name: "Desactivar Usuarios" })).toHaveCount(0);

  // Menú agrupado de la empresa.
  await page.goto(`/t/${slug}`);
  const nav = page.getByRole("navigation", { name: "Principal" });
  const mejora = nav.getByRole("group", { name: "Mejora" });
  await expect(mejora.getByRole("link", { name: "Riesgos y oportunidades" })).toBeVisible();
  await expect(nav.getByRole("group", { name: "Operación SST" })).toHaveCount(0);

  // Desactivar: sale del menú y la página da 404.
  await page.goto(`/platform/tenants/${slug}`);
  await modules.getByRole("button", { name: "Desactivar Riesgos y oportunidades" }).click();
  await expect(modules.getByRole("button", { name: "Activar Riesgos y oportunidades" })).toBeVisible({ timeout: 20_000 });

  await page.goto(`/t/${slug}`);
  await expect(mejora.getByRole("link", { name: "Hallazgos" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Riesgos y oportunidades" })).toHaveCount(0);
  const response = await page.goto(`/t/${slug}/risks`);
  expect(response?.status()).toBe(404);

  // Reactivar: vuelve todo.
  await page.goto(`/platform/tenants/${slug}`);
  await modules.getByRole("button", { name: "Activar Riesgos y oportunidades" }).click();
  await expect(modules.getByRole("button", { name: "Desactivar Riesgos y oportunidades" })).toBeVisible({ timeout: 20_000 });
  const back = await page.goto(`/t/${slug}/risks`);
  expect(back?.status()).toBe(200);
  await expect(mejora.getByRole("link", { name: "Riesgos y oportunidades" })).toBeVisible();
});
