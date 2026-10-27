import { test, expect, type Page } from "@playwright/test";

/**
 * Inspecciones (Task 15, S6): el extintor no apto de punta a punta. Se registra desde el celular con foto, se ve en la
 * lista, en la ficha de la inspección (con su seguimiento y sin hallazgo, como indica la plantilla) y en la ficha del
 * activo (fuera de servicio); una reinspección apta lo devuelve a servicio. Después, el administrador edita la plantilla
 * (versión 2, frecuencia limitada a 3 meses) y se ve la guía. Usa una empresa propia; requiere `npm run db:seed`.
 */
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("extintor no apto: se ve en la lista, en la ficha del activo y en el seguimiento; la reinspección lo libera y la plantilla se versiona", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const stamp = Date.now();
  const slug = `e2e-noapto-${stamp}`;
  const code = `N${String(stamp).slice(-6)}-01`;

  // Empresa propia con una sede, el módulo activado y un extintor importado.
  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/);
  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E No apto ${stamp}`);
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

  await page.goto(`/t/${slug}/assets/import`);
  const csv = ["codigo,descripcion,sede,agente,capacidad_kg,fabricacion,ultimo_mantenimiento", `${code},Extintor del pasillo,Base e2e,ABC,5,2022-05-10,2026-08-01`].join("\n");
  await page.getByLabel("Archivo CSV").setInputFiles({ name: "extintor.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText("Vista previa de extintor.csv")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Confirmar e importar 1 activo(s)" }).click();
  await expect(page.getByText(/Importación lista: 1 nuevo\(s\)/)).toBeVisible({ timeout: 60_000 });

  // Inspección no apta desde el celular: precinto roto, con foto.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/t/${slug}/inspections/new?q=${code}`);
  await page.getByRole("button", { name: `Inspeccionar ${code}` }).click();
  await expect(page.getByRole("heading", { name: code, level: 2 })).toBeVisible({ timeout: 30_000 });
  const conform = page.getByRole("button", { name: "Conforme", exact: true });
  const total = await conform.count();
  for (let i = 0; i < total; i++) await conform.nth(i).click();
  const seal = page.getByRole("article", { name: "Precinto y pasador de seguridad intactos" });
  await seal.getByRole("button", { name: "No conforme" }).click();
  await seal.getByLabel(/Qué encontraste/).fill("Precinto roto, el pasador se mueve libre");
  await seal.getByLabel("Sacar o elegir foto").setInputFiles({ name: "precinto.png", mimeType: "image/png", buffer: PNG_1PX });
  await expect(seal.getByRole("img", { name: /Foto de la no conformidad/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Revisar y cerrar" }).click();
  await expect(page.getByText("No apto porque 1 ítem crítico no cumple.")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar y firmar" }).click();

  // Ficha de la inspección: no conformidad, foto y seguimiento; los extintores no abren hallazgo (decisión 5).
  await expect(page.getByRole("heading", { name: /No conformidades/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Seguimiento" })).toBeVisible();
  await expect(page.getByText(/Responsable: /)).toBeVisible();
  await expect(page.getByText("Hallazgo en borrador")).toHaveCount(0);
  const fichaUrl = page.url();

  // Lista y ficha del activo: fuera de servicio, con la inspección en su historial.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/t/${slug}/inspections`);
  await expect(page.getByRole("row", { name: new RegExp(code) })).toContainText("No apto");
  await page.goto(`/t/${slug}/assets?q=${code}`);
  await page.getByRole("link", { name: code, exact: true }).click();
  await expect(page.getByRole("heading", { name: code, level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Fuera de servicio").first()).toBeVisible();
  const history = page.locator("section", { has: page.getByRole("heading", { name: "Inspecciones", level: 2 }) });
  await expect(history).toContainText("No apto");
  await expect(page.getByText("Inspección no apta", { exact: true })).toBeVisible();
  const assetUrl = page.url();

  // Reinspección apta desde la ficha: el equipo vuelve a servicio.
  await page.getByRole("link", { name: "Inspeccionar" }).click();
  await page.getByRole("button", { name: "Empezar la inspección" }).click();
  await expect(page.getByRole("heading", { name: code, level: 2 })).toBeVisible({ timeout: 30_000 });
  const again = page.getByRole("button", { name: "Conforme", exact: true });
  const count = await again.count();
  for (let i = 0; i < count; i++) await again.nth(i).click();
  await page.getByRole("button", { name: "Revisar y cerrar" }).click();
  await page.getByRole("button", { name: "Cerrar y firmar" }).click();
  // La ficha cerrada muestra «Respuestas»; recién ahí se aplicaron las consecuencias.
  await expect(page.getByRole("heading", { name: "Respuestas" })).toBeVisible({ timeout: 30_000 });
  await page.goto(assetUrl);
  await expect(page.getByText("En servicio").first()).toBeVisible();
  await expect(page.getByText("Reinspección apta: vuelve a servicio", { exact: true })).toBeVisible();
  await expect(history).toContainText("Apto");
  // La ficha de la primera inspección no cambió.
  await page.goto(fichaUrl);
  await expect(page.getByText("Precinto roto, el pasador se mueve libre")).toBeVisible();

  // Plantillas: lista, edición con versión nueva y límite de frecuencia de los extintores.
  await page.goto(`/t/${slug}/inspections`);
  await page.getByRole("link", { name: "Plantillas", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Plantillas", level: 2 })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Control de extintores" }).click();
  await expect(page.getByText("Las inspecciones ya hechas no cambian")).toBeVisible({ timeout: 30_000 });
  const save = page.getByRole("button", { name: "Guardar como versión nueva" });
  await expect(save).toBeDisabled();

  const every = page.getByRole("spinbutton");
  await every.fill("4");
  await expect(page.getByText(/no puede superar los 3 meses/)).toBeVisible();
  await expect(save).toBeDisabled();
  await every.fill("2");

  const firstText = page.getByLabel("Texto del ítem").first();
  await firstText.fill("Está en su puesto, con cartel visible y sin obstrucciones");
  await page.getByRole("button", { name: "Agregar ítem" }).click();
  await page.getByLabel("Texto del ítem").last().fill("Cartel de uso colocado junto al extintor");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText(/Guardada como versión 2/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Versiones" })).toBeVisible();
  await expect(page.getByText("Versión 2")).toBeVisible();

  // La inspección hecha con la versión 1 sigue mostrando sus ítems.
  await page.goto(fichaUrl);
  await expect(page.getByText("Precinto y pasador de seguridad intactos").first()).toBeVisible();
  await expect(page.getByText("Cartel de uso colocado junto al extintor")).toHaveCount(0);

  // Restaurar la original: otra versión, y la frecuencia vuelve a un mes.
  await page.goto(`/t/${slug}/inspections/templates`);
  await expect(page.getByRole("row", { name: /Control de extintores/ })).toContainText("Cada 2 meses");
  await page.getByRole("link", { name: "Control de extintores" }).click();
  await page.getByRole("button", { name: "Restaurar la original" }).click();
  await page.getByRole("button", { name: "Sí, restaurar la original" }).click();
  await expect(page.getByText(/Restaurada como versión 3/)).toBeVisible({ timeout: 30_000 });
  await page.goto(`/t/${slug}/inspections/templates`);
  await expect(page.getByRole("row", { name: /Control de extintores/ })).toContainText("Cada mes");

  // Guía, también en el celular y sin scroll horizontal.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/t/${slug}/inspections/guia`);
  await expect(page.getByRole("heading", { name: "Cómo se calcula el resultado" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Al menos un ítem crítico no cumple.")).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.goto(`/t/${slug}/inspections/templates`);
  await page.getByRole("link", { name: "Control de extintores" }).click();
  await expect(page.getByLabel("Texto del ítem").first()).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});
