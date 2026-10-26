import { test, expect, type Page } from "@playwright/test";

/**
 * Accidentabilidad, horas trabajadas y tablero (Tasks 17.3 y 17.4): sin horas el tablero dice «sin datos» y
 * lleva a cargarlas; con las horas del mes el índice se calcula (IF 0,00, distinto de «sin datos»); una
 * corrección deja su revisión; el CSV se previsualiza; y el colaborador ve todo en solo lectura.
 * Usa una empresa propia. Requiere `npm run db:seed` (superusuario).
 */
test("horas trabajadas y tablero: sin datos, carga, corrección con revisión, CSV y solo lectura", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const stamp = Date.now();
  const slug = `e2e-accs-${stamp}`;
  const password = "Clave-e2e-123";
  const email = (who: string) => `${who}-${stamp}@e2e.test`;
  const site = `Planta tablero ${stamp}`;
  const month = new Date().toISOString().slice(0, 7);

  async function loginAs(page: Page, who: string) {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email(who));
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(new RegExp(`/t/${slug}$`), { timeout: 30_000 });
  }

  // ── Plataforma: empresa, módulo, usuarios y una sede ──────────────────────
  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/, { timeout: 60_000 });
  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Tablero ${stamp}`);
  await page.getByLabel(/^Slug/).fill(slug);
  await page.getByRole("button", { name: "Crear tenant y aplicar plantilla" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`), { timeout: 30_000 });
  const modules = page.locator("section", { hasText: "Módulos de la empresa" });
  await modules.getByRole("button", { name: "Activar Accidentabilidad" }).click();
  await expect(modules.getByRole("button", { name: "Desactivar Accidentabilidad" })).toBeVisible({ timeout: 20_000 });

  await page.goto(`/t/${slug}/users`);
  const invite = page.locator("form", { has: page.getByRole("button", { name: "Invitar" }) });
  for (const [who, role] of [
    ["admin", "Administrador de la organización"],
    ["colab", "Colaborador"],
  ] as const) {
    await invite.getByLabel("Nombre").fill(`E2E ${who}`);
    await invite.getByLabel("Email").fill(email(who));
    await invite.getByLabel("Contraseña temporal").fill(password);
    await invite.getByLabel("Rol").selectOption({ label: role });
    await invite.getByRole("button", { name: "Invitar" }).click();
    await expect(invite.getByText("Usuario invitado correctamente.")).toBeVisible({ timeout: 20_000 });
    await expect(invite.getByRole("button", { name: "Invitar" })).toBeEnabled();
  }

  // Una sede por la nómina (el import crea lo que falta).
  const roster = ["legajo,nombre,dni,sede,sedes_adicionales,puesto,empresa,contratista,ingreso,tareas", `1,Persona Tablero,,${site},,Operario,,,,`].join("\n");
  await page.goto(`/t/${slug}/master-data/people/import`);
  await page.locator('input[type="file"]').setInputFiles({ name: "nomina.csv", mimeType: "text/csv", buffer: Buffer.from(roster) });
  await expect(page.getByText("Vista previa de nomina.csv")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/Sí, crear lo que falta/).check();
  await page.getByRole("button", { name: /Confirmar e importar 1 persona/ }).click();
  await expect(page.getByText(/Importación lista: 1 nueva/)).toBeVisible({ timeout: 30_000 });

  // ── Administrador: sin horas, el tablero dice «sin datos» y lleva a cargarlas (AT-28) ──
  await loginAs(page, "admin");
  await page.goto(`/t/${slug}/safety/stats?mes=${month}`);
  await expect(page.getByRole("heading", { name: "Índices de siniestralidad" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Todavía no se puede calcular.")).toBeVisible();
  await expect(page.getByText(new RegExp(`Falta cargar las horas de .* en ${site} \\(personal propio\\)`))).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "Frecuencia (IF)" })).toContainText("Sin datos");
  await page.getByRole("link", { name: "Cargar las horas" }).click();
  await expect(page).toHaveURL(/\/safety\/exposure/, { timeout: 30_000 });

  // ── Carga del mes: propio con horas, sin contratistas ─────────────────────
  await page.goto(`/t/${slug}/safety/exposure?mes=${month}`);
  await expect(page.getByRole("heading", { name: "Horas trabajadas" })).toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    await page.getByLabel(`Horas del personal propio en ${site}`).fill("20000");
    await page.getByLabel(`Dotación del personal propio en ${site}`).fill("110");
    await page.getByLabel(`Sin personal contratista en ${site}`).check({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByRole("button", { name: /^Guardar / }).click();
  await expect(page.getByText(/Guardado: 2 carga\(s\) nueva\(s\) y 0 corrección\(es\)/)).toBeVisible({ timeout: 30_000 });

  // El tablero ya calcula: IF 0,00 (hay horas y ningún accidente), no «sin datos» (AT-04).
  await page.goto(`/t/${slug}/safety/stats?mes=${month}&grupo=total`);
  const ifCard = page.getByRole("article").filter({ hasText: "Frecuencia (IF)" });
  await expect(ifCard).toContainText("0,00", { timeout: 30_000 });
  await expect(page.getByText("Todavía no se puede calcular.")).toHaveCount(0);

  // ── Corrección: dentro del mes en curso no pide motivo, pero queda la revisión ─
  await page.goto(`/t/${slug}/safety/exposure?mes=${month}`);
  await expect(async () => {
    await page.getByLabel(`Horas del personal propio en ${site}`).fill("21000");
    await expect(page.getByRole("button", { name: /^Guardar / })).toBeEnabled({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("button", { name: /^Guardar / }).click();
  await expect(page.getByText(/0 carga\(s\) nueva\(s\) y 1 corrección\(es\)/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Correcciones de este mes" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/20\.000 h \/ 110 → 21\.000 h \/ 110/)).toBeVisible();

  // ── CSV: vista previa sin guardar, una sede inexistente es un error por fila ──
  const csv = ["sede;mes;empresa;horas;dotacion", `${site};${month};propio;21000;110`, `Sede fantasma;${month};propio;100;1`].join("\n");
  await page.goto(`/t/${slug}/safety/exposure/import`);
  await page.getByLabel("Archivo CSV").setInputFiles({ name: "horas.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText("Vista previa de horas.csv")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/No existe la sede «Sede fantasma»/)).toBeVisible();
  await expect(page.getByText("No hay nada para importar.")).toBeVisible();

  // ── Ajustes: solo el administrador ────────────────────────────────────────
  await page.goto(`/t/${slug}/safety/settings`);
  await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Base del índice de gravedad").selectOption("1000000");
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(page.getByText("Ajustes guardados")).toBeVisible({ timeout: 30_000 });

  // ── Colaborador: ve el tablero y las horas en solo lectura, sin ajustes ───
  await loginAs(page, "colab");
  await page.goto(`/t/${slug}/safety/stats?mes=${month}`);
  await expect(page.getByRole("article").filter({ hasText: "Frecuencia (IF)" })).toContainText("0,00", { timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Ajustes" })).toHaveCount(0);
  await page.goto(`/t/${slug}/safety/exposure?mes=${month}`);
  await expect(page.getByRole("cell", { name: /21\.000 h · 110 pers\./ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /^Guardar / })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Importar desde CSV" })).toHaveCount(0);
  const settings = await page.goto(`/t/${slug}/safety/settings`);
  expect(settings?.status()).toBe(404);
});
