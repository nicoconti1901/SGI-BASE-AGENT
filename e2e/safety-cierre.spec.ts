import { test, expect, type Page } from "@playwright/test";

/**
 * Accidentabilidad, cierre (Task 17.5): un accidente con baja y fecha de reintegro más las horas del mes dan el IF
 * del tablero (AT-27); el CSV por sede y mes, el de casos con nombres y el resumen imprimible salen con el período
 * del tablero; el personal de plataforma no recibe los nombres; la guía está a un clic. Sin el módulo no hay nada (AT-26).
 * Usa una empresa propia. Requiere `npm run db:seed` (superusuario).
 */
test("accidente con baja, horas del mes, tablero, exportación, resumen y guía", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const stamp = Date.now();
  const slug = `e2e-accc-${stamp}`;
  const password = "Clave-e2e-123";
  const email = (who: string) => `${who}-${stamp}@e2e.test`;
  const site = `Planta cierre ${stamp}`;
  const person = "Julia Operaria";
  const title = `Golpe en el taller ${stamp}`;

  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  // Tres días atrás, con reintegro ayer: 1 día de baja (el del accidente no cuenta), en el mes de ese día.
  const month = day(-3).slice(0, 7);

  async function loginAs(page: Page, who: string) {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email(who));
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(new RegExp(`/t/${slug}$`), { timeout: 30_000 });
  }

  async function loginPlatform(page: Page) {
    await page.context().clearCookies();
    await page.goto("/");
    await page.getByRole("button", { name: /Superusuario SGI/ }).click();
    await expect(page).toHaveURL(/\/platform$/, { timeout: 60_000 });
  }

  // ── Plataforma: empresa, módulo apagado (AT-26), usuarios y nómina ────────
  await loginPlatform(page);
  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Cierre ${stamp}`);
  await page.getByLabel(/^Slug/).fill(slug);
  await page.getByRole("button", { name: "Crear tenant y aplicar plantilla" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`), { timeout: 30_000 });

  for (const path of ["safety/guia", "safety/resumen", "safety/stats"]) {
    expect((await page.goto(`/t/${slug}/${path}`))?.status(), path).toBe(404);
  }
  expect((await page.request.get(`/t/${slug}/safety/export?tipo=totales`)).status()).toBe(404);

  await page.goto(`/platform/tenants/${slug}`);
  const modules = page.locator("section", { hasText: "Módulos de la empresa" });
  await modules.getByRole("button", { name: "Activar Accidentabilidad" }).click();
  await expect(modules.getByRole("button", { name: "Desactivar Accidentabilidad" })).toBeVisible({ timeout: 20_000 });

  await page.goto(`/t/${slug}/users`);
  const invite = page.locator("form", { has: page.getByRole("button", { name: "Invitar" }) });
  for (const [who, role] of [
    ["admin", "Administrador de la organización"],
    ["consulta", "Consulta"],
  ] as const) {
    await invite.getByLabel("Nombre").fill(`E2E ${who}`);
    await invite.getByLabel("Email").fill(email(who));
    await invite.getByLabel("Contraseña temporal").fill(password);
    await invite.getByLabel("Rol").selectOption({ label: role });
    await invite.getByRole("button", { name: "Invitar" }).click();
    await expect(invite.getByText("Usuario invitado correctamente.")).toBeVisible({ timeout: 20_000 });
    await expect(invite.getByRole("button", { name: "Invitar" })).toBeEnabled();
  }

  const roster = ["legajo,nombre,dni,sede,sedes_adicionales,puesto,empresa,contratista,ingreso,tareas", `1,${person},,${site},,Operario,,,,`].join("\n");
  await page.goto(`/t/${slug}/master-data/people/import`);
  await page.locator('input[type="file"]').setInputFiles({ name: "nomina.csv", mimeType: "text/csv", buffer: Buffer.from(roster) });
  await expect(page.getByText("Vista previa de nomina.csv")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/Sí, crear lo que falta/).check();
  await page.getByRole("button", { name: /Confirmar e importar 1 persona/ }).click();
  await expect(page.getByText(/Importación lista: 1 nueva/)).toBeVisible({ timeout: 30_000 });

  // ── Administrador: accidente con baja y reintegro, y las horas del mes ────
  await loginAs(page, "admin");
  await page.goto(`/t/${slug}/findings/new?type=incident`);
  await page.getByLabel("Título preliminar").fill(title);
  await page.getByLabel("Descripción preliminar").fill("Se golpeó la mano con una pieza.");
  await page.getByLabel(/^Fecha y hora/).fill(`${day(-3)}T10:00`);
  await page.getByLabel(/^Sede/).selectOption({ label: site });
  await page.getByLabel(/^¿Hubo lesión/).selectOption({ label: "Con baja" });
  await page.getByLabel(/^Forma del accidente/).selectOption({ label: "Caída al mismo nivel" });
  await page.getByLabel(/^Agente/).selectOption({ label: "Piso, escalera o desnivel" });
  await page.getByLabel(/^Fecha de reintegro/).fill(day(-1));
  await page.getByLabel(/^Persona afectada/).fill("Julia");
  await page.getByRole("option", { name: new RegExp(person) }).click();
  await page.getByRole("button", { name: "Continuar al laboratorio" }).click();
  await expect(page.getByRole("heading", { name: "Completar y publicar" })).toBeVisible({ timeout: 30_000 });

  await page.goto(`/t/${slug}/safety/exposure?mes=${month}`);
  await expect(page.getByRole("heading", { name: "Horas trabajadas" })).toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    await page.getByLabel(`Horas del personal propio en ${site}`).fill("10000");
    await page.getByLabel(`Dotación del personal propio en ${site}`).fill("50");
    await page.getByLabel(`Sin personal contratista en ${site}`).check({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByRole("button", { name: /^Guardar / }).click();
  await expect(page.getByText(/Guardado: 2 carga\(s\) nueva\(s\)/)).toBeVisible({ timeout: 30_000 });

  // ── Tablero: IF = 1 caso × 1.000.000 / 10.000 horas = 100,00 (AT-27) ──────
  await page.goto(`/t/${slug}/safety/stats?mes=${month}&grupo=total`);
  await expect(page.getByRole("article").filter({ hasText: "Frecuencia (IF)" })).toContainText("100,00", { timeout: 30_000 });
  await expect(page.getByRole("article").filter({ hasText: "Incidencia (II)" })).toContainText("20,00");
  await expect(page.getByRole("link", { name: "Resumen para imprimir" })).toBeVisible();

  // ── Guía a un clic desde la cabecera ──────────────────────────────────────
  await page.getByRole("link", { name: /Guía de accidentabilidad/ }).click();
  await expect(page.getByRole("heading", { name: "Guía de accidentabilidad", level: 2 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "«Sin datos», «parcial» y «provisorio»" })).toBeVisible();

  // ── Exportación con el período del tablero ────────────────────────────────
  const query = `ventana=month&mes=${month}&grupo=total`;
  const totals = await page.request.get(`/t/${slug}/safety/export?${query}&tipo=totales`);
  expect(totals.status()).toBe(200);
  expect(totals.headers()["content-type"]).toContain("text/csv");
  const totalsCsv = await totals.text();
  expect(totalsCsv).toContain("IF (casos con baja por 1.000.000 h)");
  expect(totalsCsv).toContain(`${site};${month};Personal propio;Completo;10000;50,0;0;0;0;1;0;0;1;0;No;100,00;0,10;20,00;1,0`);
  expect(totalsCsv).not.toContain(person);

  const cases = await page.request.get(`/t/${slug}/safety/export?${query}&tipo=casos`);
  expect(cases.status()).toBe(200);
  const casesCsv = await cases.text();
  expect(casesCsv).toContain(person);
  expect(casesCsv).toContain("Con baja");
  expect(casesCsv).toContain(title);

  // ── Consulta: ve el resumen imprimible y puede exportar (D10) ─────────────
  await loginAs(page, "consulta");
  await page.goto(`/t/${slug}/safety/resumen?${query}`);
  await expect(page.getByRole("heading", { name: "Resumen de accidentabilidad" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("row", { name: /Frecuencia \(IF\)/ })).toContainText("100,00");
  await expect(page.getByRole("row", { name: new RegExp(site) })).toContainText("100,00");
  await expect(page.getByRole("button", { name: "Imprimir resumen" })).toBeVisible();
  // Al imprimir se ocultan el menú y las pestañas.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("navigation", { name: "Accidentabilidad" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Imprimir resumen" })).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.goto(`/t/${slug}/safety/stats?${query}`);
  await expect(page.getByRole("link", { name: "Descargar CSV por sede y mes" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Descargar casos (con nombres)" })).toBeVisible();
  expect((await page.request.get(`/t/${slug}/safety/export?${query}&tipo=casos`)).status()).toBe(200);

  // ── Plataforma: totales sí; nombres no (D13) ──────────────────────────────
  await loginPlatform(page);
  expect((await page.request.get(`/t/${slug}/safety/export?${query}&tipo=totales`)).status()).toBe(200);
  expect((await page.request.get(`/t/${slug}/safety/export?${query}&tipo=casos`)).status()).toBe(403);
});
