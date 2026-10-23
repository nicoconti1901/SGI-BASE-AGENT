import { test, expect } from "@playwright/test";

/**
 * Capacitaciones, tramo de registro y seguimiento (20.3 y 20.4): se importa la nómina, se exige un curso
 * a un puesto, se registra una sesión con asistentes, se ve el cumplimiento por sede y por persona, se
 * anula un registro con motivo y se importa el histórico. Usa una empresa propia.
 * Requiere `npm run db:seed` (superusuario).
 */
test("registra una sesión, ve el cumplimiento por sede y persona, y anula con motivo", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const stamp = Date.now();
  const slug = `e2e-capr-${stamp}`;
  const site = `Planta cap ${stamp}`;
  const position = `Operario cap ${stamp}`;
  const roster = [
    "legajo,nombre,dni,sede,sedes_adicionales,puesto,empresa,contratista,ingreso,tareas",
    `C${stamp}-1,Ana Asistente,30111222,${site},,${position},,,15/01/2024,`,
    `C${stamp}-2,Beto Ausente,30333444,${site},,${position},,,15/01/2024,`,
  ].join("\n");

  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/, { timeout: 60_000 });
  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Cap registro ${stamp}`);
  await page.getByLabel(/^Slug/).fill(slug);
  await page.getByRole("button", { name: "Crear tenant y aplicar plantilla" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`), { timeout: 30_000 });
  const modules = page.locator("section", { hasText: "Módulos de la empresa" });
  await modules.getByRole("button", { name: "Activar Capacitaciones" }).click();
  await expect(modules.getByRole("button", { name: "Desactivar Capacitaciones" })).toBeVisible({ timeout: 20_000 });

  // Nómina: dos personas en un puesto nuevo.
  await page.goto(`/t/${slug}/master-data/people/import`);
  await page.locator('input[type="file"]').setInputFiles({ name: "nomina.csv", mimeType: "text/csv", buffer: Buffer.from(roster) });
  await expect(page.getByText("Vista previa de nomina.csv")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/Sí, crear lo que falta/).check();
  await page.getByRole("button", { name: "Confirmar e importar 2 persona(s)" }).click();
  await expect(page.getByText(/Importación lista: 2 nueva\(s\)/)).toBeVisible({ timeout: 30_000 });

  // Curso del catálogo y requisito obligatorio para el puesto.
  await page.goto(`/t/${slug}/training/courses`);
  await page.getByLabel("Importar Trabajo en altura").check();
  await page.getByRole("button", { name: "Importar los elegidos" }).click();
  await expect(page.getByText("Se importó 1 curso").or(page.getByText("Se importaron 1 curso"))).toBeVisible({ timeout: 20_000 });
  await page.goto(`/t/${slug}/training/requirements`);
  await page.getByLabel(`Exigencia: ${position} — Trabajo en altura`).selectOption("mandatory");
  await page.getByRole("button", { name: "Ver el impacto" }).click();
  await expect(page.getByRole("list", { name: "Impacto de los cambios" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Confirmar y guardar" }).click();
  await expect(page.getByText(/Matriz guardada/)).toBeVisible({ timeout: 20_000 });

  // Sesión: solo Ana asistió.
  await page.goto(`/t/${slug}/training/sessions/new`);
  // En desarrollo la pantalla puede terminar de montarse (y recargarse) después del primer llenado.
  await expect(async () => {
    await page.getByPlaceholder("Nombre").fill("Instructora Externa");
    await page.getByLabel("Buscar").fill("Asistente");
    await page.getByLabel("Asistió Ana Asistente").check({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByRole("button", { name: "Registrar sesión con 1 asistente(s)" }).click();
  await expect(page).toHaveURL(/\/training\/sessions\/[a-z0-9]+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Asistentes" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Ana Asistente/ })).toContainText("Aprobó");
  await expect(page.getByText("Todavía no se subió la planilla.")).toBeVisible();

  // Planilla para imprimir con DNI.
  await page.getByRole("link", { name: "Planilla para imprimir" }).click();
  await expect(page.getByRole("heading", { name: "Planilla de asistencia a capacitación" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("row", { name: /Ana Asistente/ })).toContainText("30111222");

  // Resumen: la sede queda en 50 % (Ana vigente, Beto todavía en plazo: el requisito es nuevo).
  await page.goto(`/t/${slug}/training`);
  await expect(page.getByRole("heading", { name: site })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("50 % al día")).toBeVisible();

  // Cumplimiento: el filtro por estado deja solo a Beto, y su ficha dice que está en plazo.
  await page.goto(`/t/${slug}/training/compliance?estado=in_grace`);
  await expect(page.getByRole("link", { name: "Beto Ausente" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Ana Asistente" })).toHaveCount(0);
  await page.getByRole("link", { name: "Beto Ausente" }).click();
  await expect(page.getByRole("heading", { name: "Beto Ausente" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("listitem").filter({ hasText: "Trabajo en altura" }).first()).toContainText("En plazo");

  // Ana: vigente; al anular el registro con motivo vuelve a «En plazo» y el historial conserva el motivo.
  await page.goto(`/t/${slug}/training/compliance`);
  await page.getByRole("link", { name: "Ana Asistente" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Trabajo en altura" }).first()).toContainText("Vigente", { timeout: 30_000 });
  await page.getByRole("button", { name: "Anular", exact: true }).first().click();
  await page.getByLabel(/^Motivo/).fill("Se cargó a la persona equivocada");
  await page.getByRole("button", { name: "Confirmar anulación" }).click();
  await expect(page.getByText("Anulado: Se cargó a la persona equivocada")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("listitem").filter({ hasText: "Trabajo en altura" }).first()).toContainText("En plazo");

  // Histórico por CSV: un error por curso inexistente; reimportar no duplica.
  const csv = ["legajo;curso;fecha;resultado", `C${stamp}-2;Trabajo en altura;01/09/2026;aprobado`, `C${stamp}-2;Curso fantasma;01/09/2026;aprobado`].join("\n");
  await page.goto(`/t/${slug}/training/sessions/import`);
  await page.getByLabel("Archivo CSV").setInputFiles({ name: "historico.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText("Vista previa de historico.csv")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/No existe el curso «Curso fantasma»/)).toBeVisible();
  await page.getByRole("button", { name: "Confirmar e importar 1 registro(s)" }).click();
  await expect(page.getByText(/Importación lista: 1 nuevo\(s\)/)).toBeVisible({ timeout: 30_000 });
  await page.goto(`/t/${slug}/training/sessions/import`);
  await page.getByLabel("Archivo CSV").setInputFiles({ name: "historico.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText("No hay nada para importar.")).toBeVisible({ timeout: 30_000 });
});
