import { test, expect } from "@playwright/test";

/**
 * Proveedores (19.2): el superusuario activa el módulo en una empresa propia; se carga un
 * contratista crítico, se rechaza un CUIT repetido, se importa un CSV con una fila inválida
 * y se consulta la lista de aprobados (nadie se aprueba al importar).
 * Requiere `npm run db:seed` (superusuario).
 */
test("registro de proveedores: alta, CUIT repetido, importación y lista de aprobados", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const stamp = Date.now();
  const slug = `e2e-prov-${stamp}`;

  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/);

  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Proveedores ${stamp}`);
  await page.getByLabel(/^Slug/).fill(slug);
  await page.getByRole("button", { name: "Crear tenant y aplicar plantilla" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`), { timeout: 30_000 });

  // Sin activar, el módulo no existe para la empresa.
  const hidden = await page.goto(`/t/${slug}/suppliers`);
  expect(hidden?.status()).toBe(404);

  await page.goto(`/platform/tenants/${slug}`);
  const modules = page.getByRole("region", { name: "Módulos de la empresa" }).or(page.locator("section", { hasText: "Módulos de la empresa" }));
  await modules.getByRole("button", { name: "Activar Proveedores" }).click();
  await expect(modules.getByRole("button", { name: "Desactivar Proveedores" })).toBeVisible({ timeout: 20_000 });

  // Menú: aparece en «Personas y terceros».
  await page.goto(`/t/${slug}`);
  await expect(page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Proveedores" })).toBeVisible();

  // Lista vacía con guía.
  await page.goto(`/t/${slug}/suppliers`);
  await expect(page.getByRole("heading", { level: 1, name: "Proveedores" })).toBeVisible();
  await expect(page.getByText("Todavía no cargó proveedores.")).toBeVisible();

  // Alta de un contratista crítico: el motivo de la criticidad es obligatorio.
  await page.getByRole("link", { name: "Nuevo proveedor" }).first().click();
  await page.getByLabel("Razón social").fill("Montajes del Sur SA");
  await page.getByLabel("CUIT").fill("30-50001091-2");
  await page.locator('select[name="type"]').selectOption("contractor");
  await page.getByLabel("Rubro").fill("Montaje industrial");
  await page.getByRole("radio", { name: /Crítico/ }).check();
  await page.getByLabel("Motivo de la criticidad").fill("Trabaja en altura dentro de la planta");
  await page.getByRole("button", { name: "Registrar proveedor" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Montajes del Sur SA" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Sin evaluar").first()).toBeVisible();
  await expect(page.getByText("No habilitado").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Personas" })).toBeVisible(); // solo contratistas

  // Mismo CUIT en otro proveedor: rechazado con el nombre del que ya lo tiene.
  await page.goto(`/t/${slug}/suppliers/new`);
  await page.getByLabel("Razón social").fill("Otro Proveedor SRL");
  await page.getByLabel("CUIT").fill("30500010912");
  await page.locator('select[name="type"]').selectOption("product");
  await page.getByRole("button", { name: "Registrar proveedor" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Montajes del Sur SA" })).toBeVisible();

  // Importación: 2 válidas y 1 con CUIT inválido.
  await page.goto(`/t/${slug}/suppliers/import`);
  const csv = [
    "razon_social,cuit,tipo,rubro,criticidad,motivo_criticidad",
    "Ferretería Central,,producto,Ferretería,bajo impacto,Compra ocasional de insumos menores",
    "Laboratorio Andes SRL,20-12345678-6,servicio,Ensayos,estándar,",
    "CUIT Roto SA,20-12345678-5,servicio,,,",
    "Montajes del Sur SA,30-50001091-2,contratista,,crítico,Altura",
  ].join("\n");
  await page.getByLabel("Archivo CSV").setInputFiles({ name: "proveedores.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
  await expect(page.getByText("Todavía no se guardó nada.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Fila 4 · cuit")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar e importar 2 proveedores" }).click();
  await expect(page.getByText(/Importación lista: 2 proveedores nuevos, 1 que ya existía/)).toBeVisible({ timeout: 30_000 });

  // La lista los muestra sin evaluar; ninguno aprobado.
  await page.goto(`/t/${slug}/suppliers`);
  await expect(page.getByRole("link", { name: "Ferretería Central" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Laboratorio Andes SRL" })).toBeVisible();
  await page.getByRole("link", { name: "Sin evaluar", exact: false }).first().click();
  await expect(page.getByRole("link", { name: "Montajes del Sur SA" })).toBeVisible();

  // Lista de aprobados: vacía (importar y cargar no aprueba) y exportable.
  await page.goto(`/t/${slug}/suppliers/approved`);
  await expect(page.getByRole("heading", { level: 1, name: "Lista de aprobados" })).toBeVisible();
  await expect(page.getByText("Todavía no hay proveedores aprobados.")).toBeVisible();
  const csvResponse = await page.request.get(`/t/${slug}/suppliers/approved/export`);
  expect(csvResponse.ok()).toBe(true);
  expect(csvResponse.headers()["content-type"]).toContain("text/csv");
  expect(await csvResponse.text()).toContain("Razón social;CUIT;Tipo");
});
