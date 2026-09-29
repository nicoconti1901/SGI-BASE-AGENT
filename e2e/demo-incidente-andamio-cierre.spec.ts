import { test, expect, type Page } from "@playwright/test";

/**
 * Demo en vivo, parte 2: el incidente del andamio recorre su ciclo de vida
 * (en curso → en verificación → cerrado). Usa el incidente publicado más
 * reciente con ese título (creado por demo-incidente-andamio.spec.ts).
 *   DEMO=1 npx playwright test e2e/demo-incidente-andamio-cierre.spec.ts --headed --workers=1
 */
test.skip(!process.env.DEMO, "Solo para demostración en vivo (DEMO=1)");
test.use({ launchOptions: { slowMo: 350 }, viewport: { width: 1400, height: 900 } });

const TITLE = "Caída de operario desde andamio en nave 2";
const pause = (page: Page, ms = 1500) => page.waitForTimeout(ms);

async function login(page: Page, who: RegExp) {
  await page.goto("/");
  await page.getByRole("button", { name: who }).click();
  await expect(page).toHaveURL(/\/t\/tisico$/);
}

async function openIncident(page: Page) {
  await page.goto(`/t/tisico/findings?q=${encodeURIComponent(TITLE)}`);
  const row = page.getByRole("row").filter({ hasText: TITLE }).filter({ hasText: /Publicado|En curso|En verificación/ }).first();
  expect(
    await row.count(),
    "No hay un incidente del andamio abierto: corré antes demo-incidente-andamio.spec.ts",
  ).toBeGreaterThan(0);
  await row.getByRole("link", { name: "Ver" }).click();
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
}

test("incidente del andamio: medidas, verificación de eficacia y cierre", async ({ page }) => {
  test.setTimeout(10 * 60_000);

  // 1. Facundo (SST) ejecuta las medidas
  await login(page, /Facundo SST/);
  await openIncident(page);
  await pause(page, 2500);

  for (let i = 0; i < 3; i++) {
    const start = page.getByRole("button", { name: "Iniciar medida" }).first();
    if (await start.isVisible()) {
      await start.click();
      await pause(page);
    }
    // Solo los formularios de cierre de medida (no el de documentación del hallazgo).
    const closeInputs = page.locator('form:has(button:text("Confirmar cierre")) input[type="file"]');
    await closeInputs.first().setInputFiles({
      name: `evidencia-medida-${i + 1}.pdf`,
      mimeType: "application/pdf",
      buffer: Buffer.from(`%PDF-1.4 evidencia de la medida ${i + 1}`),
    });
    await page.locator('form:has(button:text("Confirmar cierre"))').first().getByPlaceholder("Descripción de la evidencia (opcional)").fill(
      ["PR-SST-07 rev. 3 aprobado", "FR-SST-12 rev. 4 con verificación en campo", "Roldana y línea de vida instaladas — foto"][i],
    );
    await page.getByRole("button", { name: "Confirmar cierre" }).first().click();
    await pause(page, 2500);
  }

  await expect(page.getByText("En verificación").first()).toBeVisible();
  await page.getByRole("heading", { name: "Verificación de eficacia" }).scrollIntoViewIfNeeded();
  await pause(page, 4000);

  // 2. Ana (administradora, no es responsable de ninguna medida) verifica la eficacia
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await login(page, /Ana Administración/);
  await openIncident(page);
  await page.getByRole("heading", { name: "Verificación de eficacia" }).scrollIntoViewIfNeeded();
  await pause(page, 2000);

  await page.getByLabel("Eficaz: no volvió a ocurrir").check();
  await page
    .getByLabel("Evidencia de eficacia")
    .fill(
      "Se inspeccionaron los 12 trabajos en altura de octubre: todos con permiso FR-SST-12 verificado en campo, línea de vida instalada y barandas completas. Sin incidentes nuevos.",
    );
  // La demo corre el mismo día del cierre: la verificación se adelanta con motivo.
  await page
    .getByLabel("Motivo para verificar antes de lo programado")
    .fill("Demostración: se simula el período de observación de 30 días");
  await pause(page);
  await page.getByRole("button", { name: "Registrar verificación" }).click();
  await expect(page.getByRole("heading", { name: "Verificaciones de eficacia" })).toBeVisible({ timeout: 20_000 });
  await pause(page, 2000);

  // 3. Historial completo
  await page.getByText(/^Historial \(/).click();
  await page.getByText(/^Historial \(/).scrollIntoViewIfNeeded();
  await pause(page, 8000);
});
