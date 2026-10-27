import { test, expect, type Page } from "@playwright/test";

/**
 * Inspecciones (Task 15, S11): auditoría de seguridad en campo. Se arma con sede, contratista y tareas especiales, se
 * registra desde el celular con foto y se mide contra la meta mensual de la sede. Usa una empresa propia; requiere `npm run db:seed`.
 */
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Marca todo «Conforme». */
async function allConform(page: Page) {
  const conform = page.getByRole("button", { name: "Conforme", exact: true });
  const total = await conform.count();
  for (let i = 0; i < total; i++) await conform.nth(i).click();
}

async function nonconform(page: Page, itemText: string, comment: string, photoName: string) {
  const item = page.getByRole("article", { name: itemText });
  await item.getByRole("button", { name: "No conforme" }).click();
  await item.getByLabel(/Qué encontraste/).fill(comment);
  await item.getByLabel("Sacar o elegir foto").setInputFiles({ name: photoName, mimeType: "image/png", buffer: PNG_1PX });
  await expect(item.getByRole("img", { name: /Foto de la no conformidad/ })).toBeVisible({ timeout: 30_000 });
}

test("auditoría en campo: la meta de la sede, la auditoría con altura desde el celular y el cumplimiento del programa", async ({ page }) => {
  test.setTimeout(9 * 60_000);
  const stamp = Date.now();
  const slug = `e2e-campo-${stamp}`;

  // Empresa propia con una sede y el módulo activado.
  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/, { timeout: 60_000 });
  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Campo ${stamp}`);
  await page.getByLabel(/^Slug/).fill(slug);
  await page.getByRole("button", { name: "Crear tenant y aplicar plantilla" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`), { timeout: 90_000 });
  const modules = page.getByRole("region", { name: "Módulos de la empresa" }).or(page.locator("section", { hasText: "Módulos de la empresa" }));
  await modules.getByRole("button", { name: "Activar Inspecciones", exact: true }).click();
  await expect(modules.getByRole("button", { name: "Desactivar Inspecciones" })).toBeVisible({ timeout: 20_000 });

  await page.goto(`/t/${slug}/master-data/sites`);
  const site = page.locator("form", { has: page.getByRole("button", { name: "Registrar sede" }) });
  await site.getByLabel("Nombre").fill("Frente e2e");
  await site.getByRole("button", { name: "Registrar sede" }).click();
  await expect(page.getByText("Alta registrada")).toBeVisible();

  // ── La meta mensual de la sede ──
  await page.goto(`/t/${slug}/inspections/campo`);
  await expect(page.getByRole("heading", { name: /Programa de /, level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("program-Frente e2e")).toContainText("0 auditoría(s) este mes · sin meta");
  await page.getByLabel("Meta mensual de Frente e2e").fill("2");
  await page.getByRole("button", { name: "Guardar la meta de Frente e2e" }).click();
  await expect(page.getByTestId("program-Frente e2e")).toContainText("0 de 2 auditorías · 0 %", { timeout: 30_000 });

  // ── Auditoría con trabajo en altura, desde el celular ──
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await page.locator("#siteId").selectOption({ label: "Frente e2e" });
  await page.locator("#contractorName").fill("Montajes del Sur");
  await page.getByLabel("Trabajo en altura").check();
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.getByRole("button", { name: "Empezar la auditoría" }).click();
  await expect(page.getByRole("heading", { name: "Auditoría de seguridad en campo", level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Contratista: Montajes del Sur/)).toBeVisible();
  await expect(page.getByText(/Tareas especiales: Trabajo en altura/)).toBeVisible();

  // Solo aplican los ítems de altura: no hay ítems de izaje ni de espacio confinado.
  await expect(page.getByRole("article", { name: /Punto de anclaje adecuado/ })).toBeVisible();
  await expect(page.getByRole("article", { name: /Plan de izaje/ })).toHaveCount(0);
  await expect(page.getByRole("article", { name: /Medición de gases/ })).toHaveCount(0);

  await allConform(page);
  await nonconform(page, "Arnés y cabo inspeccionados, vigentes (código del activo)", "Arnés sin inspección vigente", "arnes.png");
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.getByRole("button", { name: "Revisar y cerrar" }).click();
  await expect(page.getByText("No apto porque 1 ítem crítico no cumple.")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar y firmar" }).click();

  // La ficha: no conformidad, seguimiento y hallazgo en borrador (la plantilla lo pide con una crítica).
  await expect(page.getByRole("heading", { name: /No conformidades/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Seguimiento" })).toBeVisible();
  await expect(page.getByText("Hallazgo en borrador")).toBeVisible();
  await expect(page.getByText("Arnés sin inspección vigente")).toBeVisible();

  // ── El programa de la sede cuenta la auditoría cerrada ──
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/t/${slug}/inspections/campo`);
  await expect(page.getByTestId("program-Frente e2e")).toContainText("1 de 2 auditorías · 50 %", { timeout: 30_000 });
  await expect(page.getByText("Faltan 1")).toBeVisible();

  // Aparece en la lista general de inspecciones.
  await page.goto(`/t/${slug}/inspections`);
  const row = page.getByRole("row", { name: /Auditoría de seguridad en campo/ });
  await expect(row).toContainText("No apto");
  await expect(row).toContainText("Frente e2e");
});
