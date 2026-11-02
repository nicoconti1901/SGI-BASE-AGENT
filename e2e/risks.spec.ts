import { test, expect, type Page } from "@playwright/test";

/** Requiere `npm run db:seed` y `npm run db:seed:demo`. */
async function loginAsContributor(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Carla Calidad/ }).click();
  await expect(page).toHaveURL(/\/t\/tisico$/);
}

test("registrar un riesgo lleva a su ficha con el próximo paso a la vista", async ({ page }) => {
  await loginAsContributor(page);
  await page.goto("/t/tisico/risks");
  await page.getByRole("link", { name: "Registrar riesgo" }).first().click();
  await expect(page.getByRole("heading", { name: "Registrar riesgo" })).toBeVisible();

  await page.getByLabel("Título").fill(`Riesgo e2e ${Date.now()}`);
  await page.getByRole("button", { name: "Guardar y seguir" }).click();
  await page.getByLabel("Tipo de fuente").selectOption("supplier");
  await expect(page.getByText(/Qué pasa si este proveedor se atrasa/)).toBeVisible();
  await page.getByLabel("¿Cuál?").fill("Proveedor único de acero");
  await page.getByRole("button", { name: "Registrar riesgo" }).click();

  // La primera compilación en dev de la ficha puede tardar.
  await expect(page).toHaveURL(/\/t\/tisico\/risks\/[^/]+$/, { timeout: 20_000 });
  await expect(page.getByText(/NEXT_REDIRECT/)).toHaveCount(0);
  await expect(page.getByText("Evaluar el nivel del riesgo")).toBeVisible();
  await expect(page.getByText("Carla Calidad").first()).toBeVisible();
});

test("registrar una oportunidad tiene su propia pantalla", async ({ page }) => {
  await loginAsContributor(page);
  await page.goto("/t/tisico/risks");
  await page.getByRole("link", { name: "Registrar oportunidad" }).first().click();
  await expect(page.getByRole("heading", { name: "Registrar oportunidad" })).toBeVisible();

  await page.getByLabel("Título").fill(`Oportunidad e2e ${Date.now()}`);
  await page.getByLabel("Beneficio esperado").fill("Menos errores de carga");
  await page.getByRole("button", { name: "Guardar y seguir" }).click();
  await page.getByRole("button", { name: "Registrar oportunidad" }).click();

  await expect(page).toHaveURL(/\/t\/tisico\/risks\/opportunities\/[^/]+$/);
});

test("la guía está en español y accesible desde el workspace", async ({ page }) => {
  await loginAsContributor(page);
  await page.goto("/t/tisico/risks");
  await expect(page.getByRole("heading", { name: "Riesgos", exact: true })).toBeVisible();
  await expect(page.getByText(/Discovery|Workspace/)).toHaveCount(0);
  await page.getByRole("link", { name: "Guía para identificar →" }).click();
  await expect(
    page.getByRole("heading", { name: "Guía para identificar riesgos y oportunidades" }),
  ).toBeVisible();
});
