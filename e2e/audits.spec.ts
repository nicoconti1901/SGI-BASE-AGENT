import { test, expect, type Page } from "@playwright/test";

/** Requiere `npm run db:seed` y `npm run db:seed:demo`. Usa 2099 para no mezclar con el año real. */
async function quickLogin(page: Page, account: RegExp) {
  await page.goto("/");
  await page.getByRole("button", { name: account }).click();
  await expect(page).toHaveURL(/\/t\/tisico$/);
}

async function createAudit(page: Page, title: string) {
  await page.goto("/t/tisico/audits");
  await page.getByRole("link", { name: "Planificar auditoría" }).click();
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Inicio").fill("2099-03-10");
  await page.getByLabel("Fin").fill("2099-03-11");
  await page.getByRole("button", { name: "Crear y completar el plan" }).click();
  await expect(page).toHaveURL(/\/t\/tisico\/audits\/[^/]+$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test("el administrador planifica una auditoría y ve qué falta para prepararla", async ({ page }) => {
  await quickLogin(page, /Ana Administración/);
  await createAudit(page, `Compras e2e ${Date.now()}`);

  await page.getByLabel("Objetivo").fill("Verificar la evaluación de proveedores críticos");
  await page.getByLabel("Alcance").fill("Proceso de compras, planta 1");
  await page.getByLabel("ISO 9001").check();
  await page.getByLabel("Auditor líder").selectOption({ label: "Ana Administración" });
  await page.getByLabel("Área o proceso").fill("Compras");
  await page.getByLabel("Responsable auditado").selectOption({ label: "Bruno Procesos" });
  await page.getByRole("button", { name: "Guardar plan" }).click();
  await expect(page.getByText("Plan guardado")).toBeVisible();

  await page.getByRole("button", { name: "Marcar como preparada" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Falta:" })).toContainText(
    "Agregá al menos un ítem a la lista de verificación",
  );
});

test("avisa cuando alguien audita su propio trabajo", async ({ page }) => {
  await quickLogin(page, /Ana Administración/);
  await createAudit(page, `Despacho e2e ${Date.now()}`);

  await page.getByLabel("Auditor líder").selectOption({ label: "Bruno Procesos" });
  await page.getByLabel("Área o proceso").fill("Despacho");
  await page.getByLabel("Responsable auditado").selectOption({ label: "Bruno Procesos" });
  await expect(page.getByText(/figura como auditor y como auditado/)).toBeVisible();
  await expect(page.getByLabel(/justificá la excepción/)).toBeVisible();
});

test("consulta ve el programa pero no puede planificar", async ({ page }) => {
  await quickLogin(page, /Elena Consulta/);
  await page.goto("/t/tisico/audits");
  await expect(page.getByRole("heading", { name: "Auditorías internas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Planificar auditoría" })).toHaveCount(0);
  await page.goto("/t/tisico/audits/new");
  await expect(page).toHaveURL(/\/t\/tisico\/audits$/);
});

test("arma la lista desde el catálogo, inicia y registra resultados", async ({ page }) => {
  await quickLogin(page, /Ana Administración/);
  await createAudit(page, `Contexto e2e ${Date.now()}`);

  await page.getByLabel("Objetivo").fill("Verificar que el contexto de la organización está actualizado");
  await page.getByLabel("Alcance").fill("Dirección, planificación estratégica 2099");
  await page.getByLabel("ISO 9001").check();
  await page.getByLabel("Auditor líder").selectOption({ label: "Ana Administración" });
  await page.getByLabel("Área o proceso").fill("Dirección");
  await page.getByRole("button", { name: "Guardar plan" }).click();
  await expect(page.getByText("Plan guardado")).toBeVisible();

  // Con la norma guardada aparecen los requisitos de la empresa.
  const iso9001 = page.getByRole("group", { name: "ISO 9001" });
  await iso9001.getByRole("checkbox").nth(0).check();
  await iso9001.getByRole("checkbox").nth(1).check();
  await page.getByRole("button", { name: /Guardar lista \(2 requisitos\)/ }).click();
  await expect(page.getByText(/Lista actualizada: 2 ítems/)).toBeVisible();

  await page.getByRole("button", { name: "Marcar como preparada" }).click();
  await expect(page.getByText(/Preparada/).first()).toBeVisible();

  // 2099 es futuro: iniciar pide motivo.
  await page.getByLabel("Motivo para adelantar el inicio").fill("Prueba automatizada");
  await page.getByRole("button", { name: "Iniciar auditoría" }).click();
  await expect(page.getByText("0 de 2 ítems con resultado")).toBeVisible();

  const firstItem = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Guardar resultado" }) }).first();
  await firstItem.getByText("Conforme", { exact: true }).click();
  await firstItem.getByRole("button", { name: "Guardar resultado" }).click();
  await expect(page.getByText("1 de 2 ítems con resultado")).toBeVisible();

  // Una NC menor crea el Hallazgo en borrador vinculado a la auditoría.
  const secondItem = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Guardar resultado" }) }).nth(1);
  await secondItem.getByText("NC menor", { exact: true }).click();
  await secondItem.getByLabel(/Evidencia/).fill("El análisis de contexto no se revisó desde 2097");
  await secondItem.getByRole("button", { name: "Guardar resultado" }).click();
  await expect(page.getByRole("heading", { name: "3 · Hallazgos" })).toBeVisible();

  const findings = page.locator("section").filter({ has: page.getByRole("heading", { name: "3 · Hallazgos" }) });
  await findings.getByRole("link").first().click();
  // Borrador: se abre el editor, con el enlace de vuelta a la auditoría.
  await expect(page.getByRole("heading", { name: "Completar y publicar" })).toBeVisible();
  await expect(page.getByRole("link", { name: /auditoría interna AI-2099-/ })).toBeVisible();
});
