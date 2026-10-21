import { test, expect } from "@playwright/test";

/**
 * Capacitaciones, primer tramo (cursos y matriz): el módulo viene apagado, el superusuario lo activa en
 * la empresa, se importan cursos del catálogo, se define la matriz con vista previa del impacto
 * (con la advertencia de tarea crítica sin cursos) y se registra el sello de revisión.
 * Usa una empresa propia. Requiere `npm run db:seed` (superusuario).
 */
test("se arma la matriz de capacitaciones con vista previa de impacto y sello de revisión", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const stamp = Date.now();
  const slug = `e2e-cap-${stamp}`;
  const position = `Operador e2e ${stamp}`;
  const task = `Altura e2e ${stamp}`;

  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/, { timeout: 60_000 });

  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Capacitaciones ${stamp}`);
  await page.getByLabel(/^Slug/).fill(slug);
  await page.getByRole("button", { name: "Crear tenant y aplicar plantilla" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`), { timeout: 30_000 });

  // Apagado por defecto: la página da 404 hasta que se activa.
  const before = await page.goto(`/t/${slug}/training`);
  expect(before?.status()).toBe(404);

  await page.goto(`/platform/tenants/${slug}`);
  const modules = page.locator("section", { hasText: "Módulos de la empresa" });
  await modules.getByRole("button", { name: "Activar Capacitaciones" }).click();
  await expect(modules.getByRole("button", { name: "Desactivar Capacitaciones" })).toBeVisible({ timeout: 20_000 });

  // Un puesto y una tarea crítica en Datos maestros.
  await page.goto(`/t/${slug}/master-data/positions`);
  const positionForm = page.locator("form", { has: page.getByRole("button", { name: "Registrar puesto" }) });
  await positionForm.getByLabel("Nombre").fill(position);
  await positionForm.getByRole("button", { name: "Registrar puesto" }).click();
  await expect(page.getByText("Alta registrada")).toBeVisible();
  await page.goto(`/t/${slug}/master-data/tasks`);
  const taskForm = page.locator("form", { has: page.getByRole("button", { name: "Registrar tarea" }) });
  await taskForm.getByLabel("Nombre").fill(task);
  await taskForm.getByLabel("Tarea crítica").check();
  await taskForm.getByRole("button", { name: "Registrar tarea" }).click();
  await expect(page.getByText("Alta registrada")).toBeVisible();

  // Cursos: importar dos del catálogo sugerido (nada se activa solo).
  await page.goto(`/t/${slug}/training`);
  await expect(page).toHaveURL(new RegExp(`/t/${slug}/training/courses$`));
  await expect(page.getByRole("heading", { name: "Capacitaciones", level: 1 })).toBeVisible();
  await expect(page.getByText("Todavía no hay cursos.")).toBeVisible();
  await expect(page.getByText("A validar").first()).toBeVisible();
  await page.getByLabel("Importar Trabajo en altura").check();
  await page.getByLabel("Importar Inducción de seguridad al ingreso").check();
  await page.getByRole("button", { name: "Importar los elegidos" }).click();
  await expect(page.getByText("Se importaron 2 cursos")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Cursos (2)" })).toBeVisible();

  // Un curso propio con vigencia de 12 meses.
  const create = page.locator("form", { has: page.getByRole("button", { name: "Registrar curso" }) });
  await create.getByLabel("Nombre").fill(`Curso propio ${stamp}`);
  await create.getByLabel("Vigencia (meses)").fill("12");
  await create.getByRole("button", { name: "Registrar curso" }).click();
  await expect(page.getByText("Curso registrado")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Cursos (3)" })).toBeVisible();

  // Matriz: la tarea crítica sin cursos obligatorios genera una advertencia.
  await page.getByRole("link", { name: "Requisitos", exact: true }).click();
  await expect(page).toHaveURL(/\/training\/requirements$/, { timeout: 30_000 });
  await expect(page.getByText(`La tarea crítica «${task}» no tiene cursos obligatorios`)).toBeVisible();

  await page.getByLabel(`Exigencia: ${task} — Trabajo en altura`).selectOption("mandatory");
  await expect(page.getByText(`La tarea crítica «${task}» no tiene cursos obligatorios`)).toHaveCount(0);
  await page.getByLabel("Exigencia: Todo el personal — Inducción de seguridad al ingreso").selectOption("mandatory");
  await page.getByLabel(`Exigencia: ${position} — Trabajo en altura`).selectOption("recommended");
  await expect(page.getByText("3 cambios sin guardar")).toBeVisible();

  // La vista previa muestra a cuántos alcanza antes de guardar.
  await page.getByRole("button", { name: "Ver el impacto" }).click();
  const impact = page.getByRole("list", { name: "Impacto de los cambios" });
  await expect(impact).toBeVisible({ timeout: 20_000 });
  await expect(impact).toContainText("exige a");
  await expect(impact).toContainText("recomienda a");
  await page.getByRole("button", { name: "Confirmar y guardar" }).click();
  await expect(page.getByText(/Matriz guardada: 3 alta\(s\)/)).toBeVisible({ timeout: 20_000 });

  // Persiste al recargar.
  await page.reload();
  await expect(page.getByLabel(`Exigencia: ${task} — Trabajo en altura`)).toHaveValue("mandatory");
  await expect(page.getByLabel("Exigencia: Todo el personal — Inducción de seguridad al ingreso")).toHaveValue("mandatory");
  await expect(page.getByLabel(`Exigencia: ${position} — Trabajo en altura`)).toHaveValue("recommended");

  // Sello de revisión.
  await page.getByLabel(/Quiénes participaron/).fill("Delegado de seguridad y jefe de planta");
  await page.getByRole("button", { name: "Registrar revisión de la matriz" }).click();
  await expect(page.getByText("Revisión registrada")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Última revisión:")).toBeVisible();
  await expect(page.getByText("Delegado de seguridad y jefe de planta").first()).toBeVisible();

  // Una celda de curso con baja bloqueada: no se puede dar de baja un curso que está en la matriz.
  await page.getByRole("link", { name: "Cursos", exact: true }).click();
  await page.getByRole("button", { name: "Dar de baja: Trabajo en altura" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "se exige en" })).toBeVisible({ timeout: 20_000 });
});
