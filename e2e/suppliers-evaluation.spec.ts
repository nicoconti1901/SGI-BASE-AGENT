import { test, expect, type Page } from "@playwright/test";

/**
 * Proveedores (19.3): evaluación inicial con cálculo en vivo, evaluación condicional con plan de mejora,
 * contratista con la ART vencida que pasa a «no habilitado», lista de aprobados y publicación de criterios.
 * Requiere `npm run db:seed` (superusuario).
 */
async function createSupplier(page: Page, slug: string, fields: { name: string; type: "product" | "service" | "contractor"; critical?: boolean }) {
  await page.goto(`/t/${slug}/suppliers/new`);
  await page.getByLabel("Razón social").fill(fields.name);
  await page.locator('select[name="type"]').selectOption(fields.type);
  if (fields.critical) {
    await page.getByRole("radio", { name: /Crítico/ }).check();
    await page.getByLabel("Motivo de la criticidad").fill("Afecta la seguridad en planta");
  } else {
    await page.getByRole("radio", { name: /Estándar/ }).check();
  }
  await page.getByRole("button", { name: "Registrar proveedor" }).click();
  await expect(page.getByRole("heading", { level: 1, name: fields.name })).toBeVisible({ timeout: 20_000 });
  return page.url().split("/suppliers/")[1].split("?")[0];
}

async function scoreAll(page: Page, score: string) {
  const selects = page.locator('select[name^="score_"]');
  const count = await selects.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) await selects.nth(i).selectOption(score);
}

async function uploadDocument(page: Page, name: string, expiresAt: string) {
  const value = await page.locator('select[name="typeId"] option', { hasText: name }).first().getAttribute("value");
  await page.locator('select[name="typeId"]').selectOption(value!);
  await page.locator('input[name="file"]').setInputFiles({ name: "documento.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 e2e") });
  await page.locator('input[name="expiresAt"]').fill(expiresAt);
  await page.getByRole("button", { name: "Cargar documento" }).click();
  await expect(page.getByText("Documento cargado")).toBeVisible({ timeout: 20_000 });
  // El aviso queda en pantalla: se recarga para que el próximo aviso no se confunda con este.
  await page.reload();
}

test("evaluación de proveedores: aprobado, condicional con plan, ART vencida y criterios", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const stamp = Date.now();
  const slug = `e2e-eval-${stamp}`;
  const yearAhead = `${new Date().getFullYear() + 2}-06-30`;

  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/, { timeout: 30_000 });
  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Evaluación ${stamp}`);
  await page.getByLabel(/^Slug/).fill(slug);
  await page.getByRole("button", { name: "Crear tenant y aplicar plantilla" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`), { timeout: 30_000 });
  const modules = page.getByRole("region", { name: "Módulos de la empresa" }).or(page.locator("section", { hasText: "Módulos de la empresa" }));
  await modules.getByRole("button", { name: "Activar Proveedores" }).click();
  await expect(modules.getByRole("button", { name: "Desactivar Proveedores" })).toBeVisible({ timeout: 20_000 });

  // El plan de mejora necesita un responsable que sea integrante de la empresa.
  await page.goto(`/t/${slug}/users`);
  await page.getByLabel("Nombre", { exact: true }).fill("Marta Responsable");
  await page.getByLabel("Email").fill(`marta-${stamp}@e2e.test`);
  await page.getByLabel("Contraseña temporal").fill("Prueba1234!");
  await page.getByLabel("Rol").selectOption("process_owner");
  await page.getByRole("button", { name: "Invitar" }).click();
  await expect(page.getByText("Usuario invitado correctamente.")).toBeVisible({ timeout: 30_000 });

  // 1. Proveedor de producto: evaluación inicial, todo en 5 → aprobado con 100,0.
  const productId = await createSupplier(page, slug, { name: "Aceros del Plata SA", type: "product" });
  await page.getByRole("link", { name: "Evaluar", exact: true }).first().click();
  await expect(page).toHaveURL(/\/evaluate$/, { timeout: 30_000 });
  await expect(page.getByText(/Faltan \d+ notas?/)).toBeVisible({ timeout: 20_000 });
  await scoreAll(page, "5");
  await expect(page.getByText("100,0").first()).toBeVisible();
  await page.getByRole("button", { name: "Guardar evaluación" }).click();
  await expect(page).toHaveURL(/tab=evaluaciones&eval=/, { timeout: 30_000 });
  await expect(page.getByRole("article", { name: "Detalle de la evaluación" })).toContainText("Aprobado");
  await expect(page.getByRole("article", { name: "Detalle de la evaluación" })).toContainText(/criterios v1/i);

  // Aprobado y habilitado: figura en la lista de aprobados.
  await page.goto(`/t/${slug}/suppliers/approved`);
  await expect(page.getByText("Aceros del Plata SA")).toBeVisible();

  // 2. Servicio estándar con todo en 3 → «con condiciones»: no se guarda sin plan de mejora.
  const serviceId = await createSupplier(page, slug, { name: "Limpieza Norte SRL", type: "service" });
  await page.goto(`/t/${slug}/suppliers/${serviceId}/evaluate`);
  await scoreAll(page, "3");
  await expect(page.getByText("Con condiciones").first()).toBeVisible();
  await expect(page.getByRole("group", { name: "Plan de mejora" })).toBeVisible();
  await page.locator('input[name="planTitle"]').fill("Presentar el plan de capacitación del personal");
  await page.getByRole("button", { name: "Guardar evaluación" }).click();
  await expect(page).toHaveURL(/tab=evaluaciones&eval=/, { timeout: 30_000 });
  const detail = page.getByRole("article", { name: "Detalle de la evaluación" });
  await expect(detail).toContainText("Con condiciones");
  await expect(detail).toContainText("Presentar el plan de capacitación del personal");

  // 3. Contratista crítico: aprobado, pero sin documentación bloqueante no está habilitado.
  const contractorId = await createSupplier(page, slug, { name: "Montajes del Sur SA", type: "contractor", critical: true });
  await page.goto(`/t/${slug}/suppliers/${contractorId}/evaluate`);
  await scoreAll(page, "5");
  await page.getByRole("button", { name: "Guardar evaluación" }).click();
  await expect(page).toHaveURL(/tab=evaluaciones&eval=/, { timeout: 30_000 });
  await page.goto(`/t/${slug}/suppliers/${contractorId}`);
  await expect(page.getByText("No habilitado").first()).toBeVisible();

  await page.goto(`/t/${slug}/suppliers/${contractorId}?tab=documentos`);
  await uploadDocument(page, "Certificado de cobertura de ART", "2020-01-31"); // vencida
  await uploadDocument(page, "Nómina de personal cubierto", yearAhead);
  await uploadDocument(page, "Seguro de vida colectivo", yearAhead);
  await uploadDocument(page, "F.931", yearAhead);
  await expect(page.getByText("Vencido").first()).toBeVisible();
  await page.goto(`/t/${slug}/suppliers/${contractorId}`);
  await expect(page.getByText("No habilitado").first()).toBeVisible();
  await expect(page.getByText(/vencida desde el/)).toBeVisible();
  await page.goto(`/t/${slug}/suppliers/approved`);
  await expect(page.getByText("Montajes del Sur SA")).toHaveCount(0);

  // Con una ART vigente vuelve a figurar.
  await page.goto(`/t/${slug}/suppliers/${contractorId}?tab=documentos`);
  await uploadDocument(page, "Certificado de cobertura de ART", yearAhead);
  await page.goto(`/t/${slug}/suppliers/${contractorId}`);
  await expect(page.getByText("Habilitado", { exact: true }).first()).toBeVisible();
  await page.goto(`/t/${slug}/suppliers/approved`);
  await expect(page.getByText("Montajes del Sur SA")).toBeVisible();

  // 4. Criterios: un borrador de la v2 se publica contando qué cambió.
  await page.goto(`/t/${slug}/suppliers/criteria?tipo=product`);
  await expect(page.getByText("Versión 1 (vigente)")).toBeVisible();
  await page.getByRole("button", { name: "Crear borrador de la próxima versión" }).click();
  await expect(page.getByText("Borrador de la versión 2")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Publicar versión 2" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "qué cambió" })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Qué cambió en esta versión").fill("Sin cambios de fondo: revisión anual");
  await page.getByRole("button", { name: "Publicar versión 2" }).click();
  await expect(page.getByText(/Versión publicada/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Versión 2 (vigente)")).toBeVisible();

  // La evaluación hecha con la v1 conserva sus criterios.
  await page.goto(`/t/${slug}/suppliers/${productId}?tab=evaluaciones`);
  await page.getByRole("link", { name: /Inicial/ }).first().click();
  await expect(page.getByRole("article", { name: "Detalle de la evaluación" })).toContainText(/criterios v1/i);
});
