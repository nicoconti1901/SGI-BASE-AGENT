import { test, expect, type Page } from "@playwright/test";

/** Requiere `npm run db:seed` y `npm run db:seed:demo`. */
async function loginAsContributor(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Carla Calidad/ }).click();
  await expect(page).toHaveURL(/\/t\/tisico$/);
}

test("registrar una exploración lleva al riesgo sin mostrar errores", async ({ page }) => {
  await loginAsContributor(page);
  await page.goto("/t/tisico/risks");
  await page.getByRole("link", { name: "Explorar una fuente" }).click();

  await page.getByLabel("Tipo de fuente").selectOption("supplier");
  await expect(page.getByText(/Qué pasa si este proveedor se atrasa/)).toBeVisible();
  await page.getByLabel("¿Cuál?").fill(`Proveedor e2e ${Date.now()}`);
  await page.getByRole("button", { name: "Registrar" }).click();

  // La primera compilación en dev de la ficha puede tardar.
  await expect(page).not.toHaveURL(/explore/, { timeout: 20_000 });
  await expect(page).toHaveURL(/\/t\/tisico\/risks\/[^/]+$/);
  await expect(page.getByText(/NEXT_REDIRECT/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Descripción: causa/ })).toBeVisible();
});

test("+ Oportunidad crea una oportunidad directa", async ({ page }) => {
  await loginAsContributor(page);
  await page.goto("/t/tisico/risks");
  await page.getByRole("link", { name: "+ Oportunidad" }).click();
  await expect(page.getByRole("heading", { name: "Nueva oportunidad" })).toBeVisible();

  await page.getByLabel("Título").fill(`Oportunidad e2e ${Date.now()}`);
  await page.getByLabel("Beneficio esperado").fill("Menos errores de carga");
  await page.getByRole("button", { name: "Registrar oportunidad" }).click();

  await expect(page).toHaveURL(/\/t\/tisico\/risks\/opportunities\/[^/]+$/);
});

test("la guía está en español y accesible desde el workspace", async ({ page }) => {
  await loginAsContributor(page);
  await page.goto("/t/tisico/risks");
  await expect(page.getByRole("heading", { name: "1 · Identificación" })).toBeVisible();
  await expect(page.getByText(/Discovery|Workspace/)).toHaveCount(0);
  await page.getByRole("link", { name: "Guía para identificar →" }).click();
  await expect(
    page.getByRole("heading", { name: "Guía para identificar riesgos y oportunidades" }),
  ).toBeVisible();
});
