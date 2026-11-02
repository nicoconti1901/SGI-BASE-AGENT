import { test, expect, type Page } from "@playwright/test";

// El tablero (segundo test) necesita al menos un objetivo vigente de ISO 9001, que crea el primero.
// El primer test recorre seis pantallas: con el servidor de desarrollo en frío no entra en 30 s.
test.describe.configure({ mode: "serial", timeout: 90_000 });

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
  // Con la base vacía también aparece el link del estado vacío: se usa el del encabezado.
  await page.getByRole("link", { name: "Nuevo objetivo" }).first().click();
  const next = page.getByRole("button", { name: "Guardar y seguir", exact: true });
  // Paso 1: qué lograr (sin norma no deja seguir).
  await page.getByLabel(/^Objetivo/).fill(title);
  await next.click();
  await expect(page.getByRole("alert").filter({ hasText: "al menos una norma" })).toBeVisible();
  await page.getByLabel("ISO 9001").check();
  await next.click();
  // Paso 2: quién y cuándo. El paso 1 queda como resumen.
  await expect(page.getByText("Paso 2 de 3")).toBeVisible();
  await page.getByLabel("Responsable del objetivo").selectOption({ label: "Ana Administración" });
  await page.getByLabel("Fecha de cumplimiento").fill("2099-12-31");
  await next.click();
  // Paso 3: plan por filas.
  await page.getByLabel("Acción 1: qué se va a hacer").fill("Relevar los reclamos del último año");
  await page.getByLabel("Acción 1: responsable").selectOption({ index: 1 });
  await page.getByLabel("Acción 1: fecha límite").fill("2099-06-30");
  await page.getByRole("button", { name: "+ Presupuesto" }).click();
  await page.getByRole("button", { name: "Guardar y seguir con los indicadores" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 20_000 });
  // El objetivo queda como resumen, no como formulario.
  await expect(page.getByText("Relevar los reclamos del último año")).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar", exact: true })).toBeVisible();

  // Indicador por pasos: la meta con el aviso del lado equivocado no deja seguir.
  await page.getByLabel(/^¿Qué vas a medir\?/).fill("Reclamos por 100 pedidos");
  await page.getByRole("button", { name: "%", exact: true }).click();
  await next.click();
  await page.getByLabel(/Cuanto más bajo, mejor/).check();
  await page.getByLabel(/^Meta/).fill("2");
  await page.getByLabel("Avisarme antes de no cumplir la meta").check();
  await page.getByLabel("Valor que dispara el aviso").fill("3");
  await next.click();
  await expect(page.getByRole("alert").filter({ hasText: "la alerta tiene que ser menor que la meta" })).toBeVisible();

  await page.getByRole("button", { name: /^Usar 1,9/ }).click();
  await next.click();
  await page.getByLabel("Responsable del indicador").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Guardar indicador" }).click();
  // Al terminar el indicador se ve el resumen de todo el objetivo y el camino de vuelta a la lista.
  await expect(page.getByText("Indicador guardado. Así quedó el objetivo completo.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Reclamos por 100 pedidos")).toBeVisible();

  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByRole("button", { name: "Guardar cambios" }).first().click();
  await expect(page.getByRole("button", { name: "Editar", exact: true })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("link", { name: "Volver a la lista de objetivos" }).first().click();
  await expect(page).toHaveURL(/\/t\/tisico\/indicators$/);

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

  await page.getByRole("link", { name: "Registrar riesgo" }).click();
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
