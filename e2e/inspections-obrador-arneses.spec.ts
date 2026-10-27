import { test, expect, type Page } from "@playwright/test";

/**
 * Inspecciones (Task 15, S7 y S9): la zona de obradores (un área por sede, sin activo) y los arneses y cabos de vida
 * (baja definitiva, vida útil). Se registran desde el celular con foto. Usa una empresa propia; requiere `npm run db:seed`.
 */
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Marca todo «Conforme» (los ítems automáticos no tienen botón). */
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

test("zona de obradores y arneses: el obrador se programa y se inspecciona desde el celular; el arnés no apto se da de baja", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const stamp = Date.now();
  const slug = `e2e-obrarn-${stamp}`;
  const tag = String(stamp).slice(-6);

  // Empresa propia con una sede y el módulo activado.
  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/);
  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Obrador ${stamp}`);
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

  // ── Zona de obradores, en el celular: programar la sede e inspeccionarla con una crítica ──
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/t/${slug}/inspections/new`);
  await expect(page.getByRole("heading", { name: "Zona de obradores", level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Sin programar")).toBeVisible();
  await page.getByRole("button", { name: "Programar la zona de obradores de Obra e2e" }).click();
  await expect(page.getByText(/Próxima inspección: /)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Quitar del programa la zona de obradores de Obra e2e" })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  await page.getByRole("button", { name: "Inspeccionar la zona de obradores de Obra e2e" }).click();
  await expect(page.getByRole("heading", { name: "Zona de obradores", level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("El sistema no tiene extintores cargados en esta sede.")).toBeVisible();
  await allConform(page);
  await nonconform(page, "Tableros con tapa y sin partes vivas expuestas", "Tablero abierto, cables a la vista", "tablero.png");
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.getByRole("button", { name: "Revisar y cerrar" }).click();
  await expect(page.getByText("No apto porque 1 ítem crítico no cumple.")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar y firmar" }).click();

  // La ficha: no conformidad, seguimiento y, como la plantilla lo indica, hallazgo en borrador.
  await expect(page.getByRole("heading", { name: /No conformidades/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Seguimiento" })).toBeVisible();
  await expect(page.getByText("Hallazgo en borrador")).toBeVisible();
  await expect(page.getByText("Tablero abierto, cables a la vista")).toBeVisible();

  // La lista y el programa: figura sin activo, no apta, y la sede tiene su próxima fecha.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/t/${slug}/inspections`);
  const row = page.getByRole("row", { name: /Zona de obradores/ });
  await expect(row).toContainText("No apto");
  await expect(row).toContainText("Obra e2e");
  await page.goto(`/t/${slug}/inspections?vista=proximas`);
  await expect(page.getByText("No hay inspecciones para los próximos 7 días.")).toBeVisible();

  // ── Arneses y cabos de vida: importar por CSV (uno vigente, uno con la vida útil vencida) ──
  const fresh = `ARN${tag}-01`;
  const old = `ARN${tag}-02`;
  await page.goto(`/t/${slug}/assets/import?tipo=fall_protection`);
  await expect(page.getByRole("heading", { name: /Importar arneses y cabos de vida/i })).toBeVisible({ timeout: 30_000 });
  const csv = [
    "codigo,descripcion,sede,tipo_equipo,serie,fabricacion,vida_util_anios",
    `${fresh},Arnés de cuadrilla,Obra e2e,Arnés de cuerpo completo,SN-${tag}-1,2025-06-01,5`,
    `${old},Arnés viejo,Obra e2e,Arnés de cuerpo completo,SN-${tag}-2,2015-06-01,5`,
  ].join("\n");
  await page.getByLabel("Archivo CSV").setInputFiles({ name: "arneses.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText("Vista previa de arneses.csv")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Confirmar e importar 2 activo(s)" }).click();
  await expect(page.getByText(/Importación lista: 2 nuevo\(s\)/)).toBeVisible({ timeout: 60_000 });

  // El vencido pide la baja en su ficha.
  await page.goto(`/t/${slug}/assets?q=${old}`);
  await page.getByRole("link", { name: old, exact: true }).click();
  await expect(page.getByRole("heading", { name: old, level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Vida útil vencida: dar de baja/)).toBeVisible();

  // El vigente: inspección no apta desde el celular, con foto.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/t/${slug}/inspections/new?q=${fresh}`);
  await page.getByRole("button", { name: `Inspeccionar ${fresh}` }).click();
  await expect(page.getByRole("heading", { name: fresh, level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("article", { name: "Vida útil vigente" })).toBeVisible();
  await allConform(page);
  await nonconform(page, "Cintas sin cortes, deshilachado, quemaduras ni daño químico", "Corte de 3 cm en la cinta dorsal", "cinta.png");
  await page.getByRole("button", { name: "Revisar y cerrar" }).click();
  await expect(page.getByText("No apto porque 1 ítem crítico no cumple.")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar y firmar" }).click();

  // Ficha: acción de destrucción con foto, sin hallazgo (decisión 5).
  await expect(page.getByRole("heading", { name: /No conformidades/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Seguimiento" })).toBeVisible();
  await expect(page.getByText(/destruirlo y adjuntar la foto/)).toBeVisible();
  await expect(page.getByText("Hallazgo en borrador")).toHaveCount(0);

  // Baja definitiva: dado de baja, sin volver a inspeccionarlo.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/t/${slug}/assets?q=${fresh}`);
  await page.getByRole("link", { name: fresh, exact: true }).click();
  await expect(page.getByRole("heading", { name: fresh, level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Dado de baja").first()).toBeVisible();
  await expect(page.getByText("Inspección no apta: baja definitiva", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Inspeccionar" })).toHaveCount(0);
});
