import { test, expect, type Page } from "@playwright/test";

/** Requiere `npm run db:seed` y `npm run db:seed:demo`. */
async function quickLogin(page: Page, account: RegExp) {
  await page.goto("/");
  await page.getByRole("button", { name: account }).click();
  await expect(page).toHaveURL(/\/t\/tisico$/);
}

test("el administrador crea un objetivo, le agrega un indicador y edita ambos", async ({ page }) => {
  await quickLogin(page, /Ana Administración/);
  const title = `Reducir reclamos e2e ${Date.now()}`;

  await page.goto("/t/tisico/indicators");
  await page.getByRole("link", { name: "Nuevo objetivo" }).click();
  await page.getByLabel(/^Objetivo/).fill(title);
  await page.getByLabel("ISO 9001").check();
  await page.getByLabel("Responsable").selectOption({ index: 1 });
  await page.getByLabel("Fecha de cumplimiento").fill("2099-12-31");
  await page.getByRole("button", { name: "Crear y agregar indicadores" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 20_000 });

  // Indicador con alerta del lado equivocado: avisa qué falta.
  await page.getByLabel(/^Indicador/).fill("Reclamos por 100 pedidos");
  await page.getByLabel(/^Unidad/).fill("%");
  await page.getByLabel("Dirección").selectOption("lower_better");
  await page.getByLabel("Meta", { exact: true }).fill("2");
  await page.getByLabel("Umbral de alerta (opcional)").fill("3");
  await page.getByLabel("Quién carga los valores").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Agregar indicador" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Falta" })).toContainText("la alerta tiene que ser menor que la meta");

  await page.getByLabel("Umbral de alerta (opcional)").fill("1.5");
  await page.getByRole("button", { name: "Agregar indicador" }).click();
  await expect(page.getByText("Indicador creado")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Reclamos por 100 pedidos")).toBeVisible();

  await page.getByRole("button", { name: "Guardar cambios" }).first().click();
  await expect(page.getByText("Objetivo guardado")).toBeVisible({ timeout: 20_000 });

  await page.goto("/t/tisico/indicators");
  await expect(page.getByText(title)).toBeVisible();

  // Carga por período: fuera de meta pide análisis y conserva lo escrito.
  await page.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Reclamos por 100 pedidos" }).click();
  await page.getByLabel(/^Valor/).fill("5");
  await page.getByRole("button", { name: "Cargar valor" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Falta" })).toContainText("análisis del desvío");
  await expect(page.getByLabel(/^Valor/)).toHaveValue("5");

  await page.getByLabel(/^Análisis del desvío/).first().fill("Demoras del transportista");
  await page.getByRole("button", { name: "Cargar valor" }).click();
  await expect(page.getByText("Valor cargado")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Fuera de meta").first()).toBeVisible();

  await page.getByRole("button", { name: "Crear hallazgo" }).click();
  await expect(page.getByRole("link", { name: "Ver hallazgo" })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("link", { name: "Explorar riesgo" }).click();
  await expect(page.getByLabel("Tipo de fuente")).toHaveValue("indicator");
  await expect(page.getByLabel(/^¿Cuál\?/)).toHaveValue("Reclamos por 100 pedidos");
});

test("el tablero muestra el resumen, agrupa por norma y la guía es accesible", async ({ page }) => {
  await quickLogin(page, /Ana Administración/);
  await page.goto("/t/tisico/indicators");

  await expect(page.getByRole("region", { name: "Resumen" })).toContainText("Cargas vencidas");
  await expect(page.getByRole("heading", { name: "ISO 9001", level: 2 })).toBeVisible();

  await page.getByRole("link", { name: /Guía de objetivos e indicadores/ }).click();
  await expect(page.getByRole("heading", { name: "Guía de objetivos e indicadores" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Qué hacer con un desvío" })).toBeVisible();
});
