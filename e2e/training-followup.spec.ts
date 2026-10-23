import { test, expect } from "@playwright/test";

/**
 * Capacitaciones, tramo de avisos, eficacia y plan anual (20.5 y 20.6): se planifica una sesión, se la
 * registra desde el plan, el plan marca 100 %, y se evalúa la eficacia (primero reprogramando un «no eficaz»
 * y después como eficaz). Usa una empresa propia.
 * Requiere `npm run db:seed` (superusuario).
 */
test("planifica una sesión, la registra desde el plan y evalúa su eficacia", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const stamp = Date.now();
  const slug = `e2e-capf-${stamp}`;
  const site = `Planta plan ${stamp}`;
  const position = `Operario plan ${stamp}`;
  const roster = [
    "legajo,nombre,dni,sede,sedes_adicionales,puesto,empresa,contratista,ingreso,tareas",
    `P${stamp}-1,Ana Planificada,30111222,${site},,${position},,,15/01/2024,`,
  ].join("\n");

  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/, { timeout: 60_000 });
  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Cap plan ${stamp}`);
  await page.getByLabel(/^Slug/).fill(slug);
  await page.getByRole("button", { name: "Crear tenant y aplicar plantilla" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`), { timeout: 30_000 });
  const modules = page.locator("section", { hasText: "Módulos de la empresa" });
  await modules.getByRole("button", { name: "Activar Capacitaciones" }).click();
  await expect(modules.getByRole("button", { name: "Desactivar Capacitaciones" })).toBeVisible({ timeout: 20_000 });

  // Nómina y curso con eficacia (Trabajo en altura, del catálogo sugerido).
  await page.goto(`/t/${slug}/master-data/people/import`);
  await page.locator('input[type="file"]').setInputFiles({ name: "nomina.csv", mimeType: "text/csv", buffer: Buffer.from(roster) });
  await expect(page.getByText("Vista previa de nomina.csv")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/Sí, crear lo que falta/).check();
  await page.getByRole("button", { name: "Confirmar e importar 1 persona(s)" }).click();
  await expect(page.getByText(/Importación lista: 1 nueva\(s\)/)).toBeVisible({ timeout: 30_000 });
  await page.goto(`/t/${slug}/training/courses`);
  await page.getByLabel("Importar Trabajo en altura").check();
  await page.getByRole("button", { name: "Importar los elegidos" }).click();
  await expect(page.getByText("Se importó 1 curso").or(page.getByText("Se importaron 1 curso"))).toBeVisible({ timeout: 20_000 });

  // Plan anual: se agrega una sesión y queda pendiente.
  await page.goto(`/t/${slug}/training/plan`);
  await expect(page.getByText(/Todavía no hay capacitaciones en el plan/)).toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    await page.getByRole("button", { name: "Agregar al plan" }).click({ timeout: 5_000 });
    await expect(page.getByRole("row", { name: /Trabajo en altura/ })).toContainText("Pendiente", { timeout: 5_000 });
  }).toPass({ timeout: 60_000 });

  // Se registra desde el plan: el curso viene fijo y la sesión queda como realizada.
  await page.getByRole("link", { name: "Registrar", exact: true }).click();
  await expect(page).toHaveURL(/\/training\/sessions\/new\?planned=/, { timeout: 30_000 });
  await expect(async () => {
    await page.getByPlaceholder("Nombre").fill("Instructora Interna");
    await page.getByLabel("Buscar").fill("Planificada");
    await page.getByLabel("Asistió Ana Planificada").check({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByRole("button", { name: "Registrar sesión con 1 asistente(s)" }).click();
  await expect(page).toHaveURL(/\/training\/sessions\/[a-z0-9]+$/, { timeout: 30_000 });

  await page.goto(`/t/${slug}/training/plan`);
  await expect(page.getByText(/100% \(1 de 1\)/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("row", { name: /Trabajo en altura/ })).toContainText("Realizada");
  await expect(page.getByRole("link", { name: "Exportar para firma (CSV)" })).toBeVisible();

  // Eficacia: el curso la pide, así que la sesión aparece pendiente. Primero un «no eficaz» que se reprograma.
  await page.goto(`/t/${slug}/training/effectiveness`);
  await expect(page.getByRole("row", { name: /Trabajo en altura/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Evaluar" }).click();
  await expect(page.getByRole("heading", { name: /Evaluar eficacia: Trabajo en altura/ })).toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    await page.getByLabel("Resultado general").selectOption("not_effective");
    await page.getByLabel("Cómo se evaluó").selectOption("observation");
    await page.getByRole("textbox", { name: /^Qué se observó/ }).first().fill("No usa el anclaje en las tareas");
    await page.getByLabel("Reprogramar la evaluación").check({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("button", { name: "Guardar evaluación" }).click();
  await expect(page).toHaveURL(/\/training\/effectiveness$/, { timeout: 30_000 });
  await expect(page.getByRole("row", { name: /Trabajo en altura/ })).toBeVisible();

  // Después de reforzar, se evalúa como eficaz y la bandeja queda vacía.
  await page.getByRole("link", { name: "Evaluar" }).click();
  await page.getByLabel("Cómo se evaluó").selectOption("practical_test");
  await page.getByRole("button", { name: "Guardar evaluación" }).click();
  await expect(page).toHaveURL(/\/training\/effectiveness$/, { timeout: 30_000 });
  await expect(page.getByText("No hay evaluaciones de eficacia pendientes.")).toBeVisible({ timeout: 30_000 });

  // Guía.
  await page.goto(`/t/${slug}/training/guia`);
  await expect(page.getByRole("heading", { name: "Guía de Capacitaciones" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Quién está habilitado para una tarea crítica" })).toBeVisible();
});
