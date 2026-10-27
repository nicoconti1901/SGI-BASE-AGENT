import { test, expect, type Page } from "@playwright/test";

/**
 * Inspecciones (Task 15, S10): equipos y vehículos pesados. El operador hace el control previo desde el celular (un gancho
 * dañado en una hidrogrúa la deja fuera de servicio y abre un hallazgo) y SST la libera con la inspección mensual. Usa una empresa propia;
 * requiere `npm run db:seed` (superusuario).
 */
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

const isoInDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/** Marca todo «Conforme» (los ítems automáticos y numéricos no tienen ese botón). */
async function allConform(page: Page) {
  const conform = page.getByRole("button", { name: "Conforme", exact: true });
  const total = await conform.count();
  for (let i = 0; i < total; i++) await conform.nth(i).click();
}

async function setNumber(page: Page, itemText: string, value: string) {
  const input = page.getByRole("article", { name: itemText }).getByRole("spinbutton");
  await input.fill(value);
  await input.blur();
}

test("equipos pesados: el control previo deja la hidrogrúa parada y la inspección mensual la libera", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const stamp = Date.now();
  const slug = `e2e-pes-${stamp}`;
  const code = `GRU${String(stamp).slice(-6)}`;

  // Empresa propia con una sede y el módulo activado.
  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/);
  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Pesados ${stamp}`);
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

  // Alta por CSV: una hidrogrúa con izaje, que no circula, con los documentos al día.
  await page.goto(`/t/${slug}/assets/import?tipo=heavy_equipment`);
  await expect(page.getByRole("heading", { name: /Importar equipos y vehículos pesados/i })).toBeVisible({ timeout: 30_000 });
  const csv = [
    "codigo,descripcion,sede,tipo_equipo,circula_via_publica,tiene_izaje,medidor,lectura_inicial,vence_seguro,vence_service,vence_certificacion_izaje,vence_revision_izaje",
    `${code},Hidrogrúa de obra,Obra e2e,hidrogrua,no,sí,horas,4500,${isoInDays(200)},${isoInDays(100)},${isoInDays(200)},${isoInDays(60)}`,
  ].join("\n");
  await page.getByLabel("Archivo CSV").setInputFiles({ name: "pesados.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText("Vista previa de pesados.csv")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Confirmar e importar 1 activo(s)" }).click();
  await expect(page.getByText(/Importación lista: 1 nuevo\(s\)/)).toBeVisible({ timeout: 60_000 });

  // Ficha: el control previo aún no se hizo.
  await page.goto(`/t/${slug}/assets?q=${code}`);
  await page.getByRole("link", { name: code, exact: true }).click();
  await expect(page.getByRole("heading", { name: code, level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Todavía no se hizo ningún control previo.")).toBeVisible();

  // ── Control previo al uso, en el celular: el gancho está dañado ──
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/t/${slug}/inspections/new?q=${code}`);
  await page.getByRole("button", { name: `Control previo al uso de ${code}` }).click();
  await expect(page.getByRole("heading", { name: code, level: 2 })).toBeVisible({ timeout: 30_000 });
  // 13 controles + 4 de izaje + el horómetro.
  await expect(page.getByText("0 de 18")).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  const firstConform = page.getByRole("button", { name: "Conforme", exact: true }).first();
  expect((await firstConform.boundingBox())!.height).toBeGreaterThanOrEqual(48);

  await allConform(page);
  const hooks = page.getByRole("article", { name: "Ganchos con traba; cables y eslingas sin daño" });
  await hooks.getByRole("button", { name: "No conforme" }).click();
  await hooks.getByLabel(/Qué encontraste/).fill("Eslinga con hilos cortados");
  await hooks.getByLabel("Sacar o elegir foto").setInputFiles({ name: "eslinga.png", mimeType: "image/png", buffer: PNG_1PX });
  await expect(hooks.getByRole("img", { name: /Foto de la no conformidad/ })).toBeVisible({ timeout: 30_000 });
  await setNumber(page, "Horómetro (horas)", "4510");
  await page.getByRole("button", { name: "Revisar y cerrar" }).click();
  await expect(page.getByText("No apto porque 1 ítem crítico no cumple.")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar y firmar" }).click();

  // Cerrado: acción de seguimiento y hallazgo en borrador por la crítica.
  await expect(page.getByRole("heading", { name: /No conformidades/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Seguimiento" })).toBeVisible();
  await expect(page.getByText("Hallazgo en borrador").first()).toBeVisible();

  // La ficha: fuera de servicio y el último control previo.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/t/${slug}/assets?q=${code}`);
  await page.getByRole("link", { name: code, exact: true }).click();
  await expect(page.getByRole("heading", { name: code, level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Fuera de servicio").first()).toBeVisible();
  await expect(page.getByText(/Último control previo: hoy/)).toBeVisible();

  // ── Inspección mensual (SST): reinspección apta, libera el equipo ──
  await page.goto(`/t/${slug}/inspections/new?q=${code}`);
  await page.getByRole("button", { name: `Inspeccionar ${code}` }).click();
  await expect(page.getByRole("heading", { name: code, level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("article", { name: "Revisión trimestral de izaje vigente" })).toBeVisible();
  await expect(page.getByRole("article", { name: "RTO vigente" })).toHaveCount(0);
  await allConform(page);
  await setNumber(page, "Horómetro (horas)", "4600");
  await page.getByRole("button", { name: "Revisar y cerrar" }).click();
  await expect(page.getByText("Apto", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Cerrar y firmar" }).click();
  await expect(page.getByRole("heading", { name: /Inspección del/ }).or(page.getByText("Apto").first())).toBeVisible({ timeout: 30_000 });

  await page.goto(`/t/${slug}/assets?q=${code}`);
  await page.getByRole("link", { name: code, exact: true }).click();
  await expect(page.getByRole("heading", { name: code, level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("En servicio").first()).toBeVisible();
  await expect(page.getByText("Reinspección apta: vuelve a servicio", { exact: true })).toBeVisible();
});
