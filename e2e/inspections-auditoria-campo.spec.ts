import { test, expect, type Page } from "@playwright/test";

/**
 * Inspecciones (Task 15, S11): auditoría de seguridad en campo. El administrador fija la meta mensual de una sede, el auditor
 * hace la auditoría desde el celular (con trabajo en altura marcado, una no conformidad crítica abre un hallazgo) y el
 * cumplimiento del programa de la sede se actualiza. Usa una empresa propia;
 * requiere `npm run db:seed` (superusuario).
 */
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Marca todo «Conforme» (los ítems automáticos y numéricos no tienen ese botón). */
async function allConform(page: Page) {
  const conform = page.getByRole("button", { name: "Conforme", exact: true });
  const total = await conform.count();
  for (let i = 0; i < total; i++) await conform.nth(i).click();
}

test("auditoría de campo: la meta de la sede, la auditoría con altura y el cumplimiento del programa", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const stamp = Date.now();
  const slug = `e2e-campo-${stamp}`;

  // Empresa propia con una sede y el módulo activado.
  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/);
  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Campo ${stamp}`);
  await page.getByLabel(/^Slug/).fill(slug);
  await page.getByRole("button", { name: "Crear tenant y aplicar plantilla" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`), { timeout: 30_000 });
  const modules = page.getByRole("region", { name: "Módulos de la empresa" }).or(page.locator("section", { hasText: "Módulos de la empresa" }));
  await modules.getByRole("button", { name: "Activar Inspecciones", exact: true }).click();
  await expect(modules.getByRole("button", { name: "Desactivar Inspecciones" })).toBeVisible({ timeout: 20_000 });

  await page.goto(`/t/${slug}/master-data/sites`);
  const site = page.locator("form", { has: page.getByRole("button", { name: "Registrar sede" }) });
  await site.getByLabel("Nombre").fill("Obra e2e");
  await site.getByRole("button", { name: "Registrar sede" }).click();
  await expect(page.getByText("Alta registrada")).toBeVisible();

  // La sede aparece sin meta; el administrador fija 1 auditoría por mes.
  await page.goto(`/t/${slug}/inspections/campo`);
  await expect(page.getByRole("heading", { name: "Cumplimiento del programa" })).toBeVisible({ timeout: 30_000 });
  const row = page.getByRole("row", { name: /Obra e2e/ });
  await expect(row.getByText("Sin meta")).toBeVisible();
  await page.getByLabel("Meta mensual de Obra e2e").fill("1");
  await page.getByRole("button", { name: "Guardar la meta de Obra e2e" }).click();
  await expect(page.getByRole("row", { name: /Obra e2e/ }).getByText("En curso")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("row", { name: /Obra e2e/ }).getByText(/0 %.*faltan 1/)).toBeVisible();

  // ── Auditoría en el celular, con trabajo en altura ──
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/t/${slug}/inspections/campo`);
  await page.locator("select[name=siteId]").selectOption({ label: "Obra e2e" });
  await page.getByLabel("Contratista").fill("Alturas del Sur SA");
  await page.getByLabel("Trabajo en altura").check();
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.getByRole("button", { name: "Empezar la auditoría" }).click();
  await expect(page.getByRole("heading", { name: "Auditoría de seguridad en campo", level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Contratista: Alturas del Sur SA/)).toBeVisible();
  await expect(page.getByText(/Tareas especiales: Trabajo en altura/)).toBeVisible();
  await expect(page.getByRole("article", { name: "Punto de anclaje adecuado e independiente de la plataforma" })).toBeVisible();
  await expect(page.getByRole("article", { name: "Vigía y plan de rescate" })).toHaveCount(0);
  const firstConform = page.getByRole("button", { name: "Conforme", exact: true }).first();
  expect((await firstConform.boundingBox())!.height).toBeGreaterThanOrEqual(48);

  await allConform(page);
  const anchor = page.getByRole("article", { name: "Punto de anclaje adecuado e independiente de la plataforma" });
  await anchor.getByRole("button", { name: "No conforme" }).click();
  await anchor.getByLabel(/Qué encontraste/).fill("Anclado a la baranda de la plataforma");
  await anchor.getByLabel("Sacar o elegir foto").setInputFiles({ name: "anclaje.png", mimeType: "image/png", buffer: PNG_1PX });
  await expect(anchor.getByRole("img", { name: /Foto de la no conformidad/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Revisar y cerrar" }).click();
  await expect(page.getByText("No apto porque 1 ítem crítico no cumple.")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar y firmar" }).click();

  // Cerrada: acción de seguimiento y hallazgo en borrador; sin "siguiente activo".
  await expect(page.getByRole("heading", { name: /No conformidades/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Seguimiento" })).toBeVisible();
  await expect(page.getByText("Hallazgo en borrador").first()).toBeVisible();
  await expect(page.getByText(/Siguiente activo pendiente/)).toHaveCount(0);

  // El programa de la sede se cumplió.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/t/${slug}/inspections/campo`);
  const done = page.getByRole("row", { name: /Obra e2e/ });
  await expect(done.getByText("Cumplida")).toBeVisible({ timeout: 30_000 });
  await expect(done.getByText(/100 %/)).toBeVisible();
});
