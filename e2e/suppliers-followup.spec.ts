import { test, expect, type Page } from "@playwright/test";

/**
 * Proveedores (19.4 y 19.5): hallazgo desde la ficha, reevaluación por evento con la evidencia precargada,
 * comunicación del resultado, evolución del puntaje y guía.
 * Requiere `npm run db:seed` (superusuario).
 */
async function scoreAll(page: Page, score: string) {
  const selects = page.locator('select[name^="score_"]');
  const count = await selects.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) await selects.nth(i).selectOption(score);
}

test("seguimiento de un proveedor: hallazgo, reevaluación por evento y comunicación", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const stamp = Date.now();
  const slug = `e2e-follow-${stamp}`;

  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/, { timeout: 30_000 });
  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Seguimiento ${stamp}`);
  await page.getByLabel(/^Slug/).fill(slug);
  await page.getByRole("button", { name: "Crear tenant y aplicar plantilla" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`), { timeout: 30_000 });
  const modules = page.getByRole("region", { name: "Módulos de la empresa" }).or(page.locator("section", { hasText: "Módulos de la empresa" }));
  await modules.getByRole("button", { name: "Activar Proveedores" }).click();
  await expect(modules.getByRole("button", { name: "Desactivar Proveedores" })).toBeVisible({ timeout: 20_000 });

  // Proveedor estándar evaluado y aprobado.
  await page.goto(`/t/${slug}/suppliers/new`);
  await page.getByLabel("Razón social").fill("Logística Austral SA");
  await page.locator('select[name="type"]').selectOption("service");
  await page.getByRole("radio", { name: /Estándar/ }).check();
  await page.getByRole("button", { name: "Registrar proveedor" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Logística Austral SA" })).toBeVisible({ timeout: 20_000 });
  const supplierId = page.url().split("/suppliers/")[1].split("?")[0];

  await page.goto(`/t/${slug}/suppliers/${supplierId}/evaluate`);
  await scoreAll(page, "5");
  await page.getByRole("button", { name: "Guardar evaluación" }).click();
  await expect(page).toHaveURL(/tab=evaluaciones&eval=/, { timeout: 30_000 });

  // 1. Hallazgo desde la ficha: queda como borrador en Hallazgos, con el tipo del proveedor.
  await page.goto(`/t/${slug}/suppliers/${supplierId}?tab=hallazgos`);
  await expect(page.getByText("No hay hallazgos registrados para este proveedor.")).toBeVisible();
  await page.locator('select[name="kind"]').selectOption("delivery");
  await page.locator('textarea[name="description"]').fill("El pedido llegó con 5 días de atraso y sin remito.");
  await page.getByRole("button", { name: "Registrar hallazgo" }).click();
  await expect(page.getByText(/Hallazgo registrado en borrador/)).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await expect(page.getByRole("link", { name: /Entrega · Logística Austral SA/ })).toBeVisible();
  await expect(page.getByText("Borrador").first()).toBeVisible();

  // 2. Reevaluación por evento: la evidencia del hallazgo ya está en la pantalla.
  await page.getByRole("link", { name: "Reevaluar por evento" }).click();
  await expect(page).toHaveURL(/\/evaluate\?tipo=event$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Evidencia a mano" })).toBeVisible();
  await expect(page.getByText("Hay un hallazgo abierto desde la última evaluación.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Entrega · Logística Austral SA/ })).toBeVisible();
  await expect(page.locator('select[name="kind"]')).toHaveValue("event");
  await scoreAll(page, "4");
  await page.getByRole("button", { name: "Guardar evaluación" }).click();
  await expect(page).toHaveURL(/tab=evaluaciones&eval=/, { timeout: 30_000 });
  const detail = page.getByRole("article", { name: "Detalle de la evaluación" });
  await expect(detail).toContainText("Aprobado");

  // 3. Registrar que se comunicó el resultado, con la evaluación ya elegida.
  await detail.getByRole("link", { name: "Registrar que se lo comunicó" }).click();
  await expect(page).toHaveURL(/tab=comunicaciones&tipo=resultado&eval=/, { timeout: 30_000 });
  await expect(page.locator('select[name="kind"]')).toHaveValue("evaluation_result");
  await page.locator('textarea[name="summary"]').fill("Se le informó por mail el resultado y el pedido de mejorar los plazos de entrega.");
  await page.locator('input[name="recipientName"]').fill("Laura Gómez");
  await page.getByRole("button", { name: "Registrar comunicación" }).click();
  await expect(page.getByText("Comunicación registrada")).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await expect(page.getByText("Resultado de la evaluación").first()).toBeVisible();
  await expect(page.getByText(/Se le informó por mail/)).toBeVisible();
  await expect(page.getByText(/a Laura Gómez/)).toBeVisible();

  // 4. El resumen muestra la evolución del puntaje (100 → 80).
  await page.goto(`/t/${slug}/suppliers/${supplierId}`);
  const trend = page.getByRole("region", { name: "Evolución del puntaje" }).or(page.locator("section", { hasText: "Evolución del puntaje" }));
  await expect(trend).toContainText("100,0");
  await expect(trend).toContainText("80,0");
  await expect(trend).toContainText("-20,0");

  // 5. La guía se abre desde la cabecera.
  await page.getByRole("link", { name: /Guía de proveedores/ }).click();
  await expect(page.getByRole("heading", { name: "Guía de proveedores" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Cuándo se vuelve a evaluar" })).toBeVisible();
});
