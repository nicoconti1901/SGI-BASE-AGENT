import { test, expect } from "@playwright/test";

/**
 * Inspecciones (Task 15, tramo de extintores): importar activos por CSV, registrar una inspección no apta
 * desde el celular (375 px, con foto), verla en la lista y comprobar que con el módulo apagado dan 404.
 * Usa una empresa propia y activa el módulo desde la plataforma. Requiere `npm run db:seed` (superusuario).
 */
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

function csv(prefix: string) {
  const header = "codigo,descripcion,sede,agente,capacidad_kg,fabricacion,ultimo_mantenimiento";
  const rows = Array.from({ length: 20 }, (_, i) => `${prefix}-${String(i + 1).padStart(2, "0")},Extintor ${i + 1},Base e2e,ABC,5,2022-05-10,2026-08-01`);
  rows[4] = `${prefix}-05,Sede inexistente,Sede Fantasma,ABC,5,2022-05-10,2026-08-01`;
  rows[9] = `${prefix}-10,Agente raro,Base e2e,XYZ,5,2022-05-10,2026-08-01`;
  return [header, ...rows].join("\n");
}

test("importa extintores, registra una inspección no apta desde el celular y respeta el módulo apagado", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const stamp = Date.now();
  const slug = `e2e-insp-${stamp}`;
  const prefix = `X${String(stamp).slice(-6)}`;

  // Empresa propia, con una sede y el módulo activado.
  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/);
  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Inspecciones ${stamp}`);
  await page.getByLabel(/^Slug/).fill(slug);
  await page.getByRole("button", { name: "Crear tenant y aplicar plantilla" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`), { timeout: 30_000 });
  const modules = page.getByRole("region", { name: "Módulos de la empresa" }).or(page.locator("section", { hasText: "Módulos de la empresa" }));
  await modules.getByRole("button", { name: "Activar Inspecciones", exact: true }).click();
  await expect(modules.getByRole("button", { name: "Desactivar Inspecciones" })).toBeVisible({ timeout: 20_000 });

  await page.goto(`/t/${slug}/master-data/sites`);
  const site = page.locator("form", { has: page.getByRole("button", { name: "Registrar sede" }) });
  await site.getByLabel("Nombre").fill("Base e2e");
  await site.getByRole("button", { name: "Registrar sede" }).click();
  await expect(page.getByText("Alta registrada")).toBeVisible();

  // Importación: 20 filas con 2 errores → 18 nuevos; reimportar no duplica.
  await page.goto(`/t/${slug}/assets/import`);
  const file = { name: "extintores.csv", mimeType: "text/csv", buffer: Buffer.from(csv(prefix)) };
  await page.getByLabel("Archivo CSV").setInputFiles(file);
  await expect(page.getByText("Vista previa de extintores.csv")).toBeVisible({ timeout: 30_000 });
  const summary = page.getByRole("region", { name: "Resultado de la vista previa" });
  await expect(summary).toContainText("Nuevos");
  await expect(summary.getByText("18", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("La sede «Sede Fantasma» no existe")).toBeVisible();
  await expect(page.getByText(/Agente desconocido/)).toBeVisible();
  await page.getByRole("button", { name: "Confirmar e importar 18 activo(s)" }).click();
  await expect(page.getByText(/Importación lista: 18 nuevo\(s\)/)).toBeVisible({ timeout: 60_000 });

  await page.goto(`/t/${slug}/assets/import`);
  await page.getByLabel("Archivo CSV").setInputFiles(file);
  await expect(page.getByText("Vista previa de extintores.csv")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("No hay nada para importar.")).toBeVisible();
  await page.goto(`/t/${slug}/assets`);
  await expect(page.getByRole("heading", { name: "Activos (18)" })).toBeVisible();

  // Inspección desde el celular.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/t/${slug}/inspections/new?q=${prefix}-01`);
  await page.getByRole("button", { name: `Inspeccionar ${prefix}-01` }).click();
  await expect(page.getByRole("heading", { name: `${prefix}-01`, level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("1 de 12")).toBeVisible();

  // Sin scroll horizontal y con botones de al menos 48 px.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const firstConform = page.getByRole("button", { name: "Conforme", exact: true }).first();
  expect((await firstConform.boundingBox())!.height).toBeGreaterThanOrEqual(48);

  // Todo conforme, salvo el precinto.
  const conformButtons = page.getByRole("button", { name: "Conforme", exact: true });
  const total = await conformButtons.count();
  for (let i = 0; i < total; i++) await conformButtons.nth(i).click();
  await expect(page.getByText("12 de 12")).toBeVisible();

  const seal = page.getByRole("article", { name: "Precinto y pasador de seguridad intactos" });
  await seal.getByRole("button", { name: "No conforme" }).click();
  await seal.getByLabel(/Qué encontraste/).fill("Precinto roto, el pasador se mueve libre");
  await seal.getByLabel("Sacar o elegir foto").setInputFiles({ name: "precinto.png", mimeType: "image/png", buffer: PNG_1PX });
  await expect(seal.getByRole("img", { name: /Foto de la no conformidad/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Guardado").first()).toBeVisible();

  // Revisar: el resultado se calcula y se explica; no se edita.
  await page.getByRole("button", { name: "Revisar y cerrar" }).click();
  await expect(page.getByText("No apto", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("No apto porque 1 ítem crítico no cumple.")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar y firmar" }).click();

  // Ficha cerrada, lista y ronda.
  await expect(page.getByText("Observaciones: ")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /No conformidades/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Precinto roto, el pasador se mueve libre")).toBeVisible();
  await expect(page.getByRole("img", { name: /Foto: / })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto(`/t/${slug}/inspections`);
  const row = page.getByRole("row", { name: new RegExp(`${prefix}-01`) });
  await expect(row).toContainText("No apto");

  await page.goto(`/t/${slug}/inspections/new?q=${prefix}-02`);
  await page.getByRole("button", { name: `Inspeccionar ${prefix}-02` }).click();
  await expect(page.getByRole("heading", { name: `${prefix}-02`, level: 2 })).toBeVisible({ timeout: 30_000 });

  // Módulo apagado: 404 en /inspections y /assets.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/platform/tenants/${slug}`);
  await modules.getByRole("button", { name: "Desactivar Inspecciones" }).click();
  await expect(modules.getByRole("button", { name: "Activar Inspecciones", exact: true })).toBeVisible({ timeout: 20_000 });
  expect((await page.goto(`/t/${slug}/inspections`))?.status()).toBe(404);
  expect((await page.goto(`/t/${slug}/assets`))?.status()).toBe(404);
});
