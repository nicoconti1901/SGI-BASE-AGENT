import { test, expect, type Page } from "@playwright/test";

/**
 * Accidentabilidad, registro (Task 17.2): el colaborador da de alta el hecho, el administrador completa
 * la ficha de salud y actualiza los días, la consulta lo lee y la plataforma no ve los datos de salud.
 * Usa una empresa propia. Requiere `npm run db:seed` (superusuario).
 */
test("registro de accidentes: alta, ficha de salud, seguimiento y lectura por rol", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const stamp = Date.now();
  const slug = `e2e-acc-${stamp}`;
  const password = "Clave-e2e-123";
  const email = (who: string) => `${who}-${stamp}@e2e.test`;
  const person = "Marta Operaria";
  const title = `Caída en el depósito ${stamp}`;

  const day = (offset: number) => {
    const d = new Date(Date.now() + offset * 86_400_000);
    return d.toISOString().slice(0, 10);
  };

  async function loginAs(page: Page, who: string) {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email(who));
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(new RegExp(`/t/${slug}$`), { timeout: 30_000 });
  }

  // ── Plataforma: empresa, módulo, usuarios y nómina ────────────────────────
  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/);
  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Accidentes ${stamp}`);
  await page.getByLabel(/^Slug/).fill(slug);
  await page.getByRole("button", { name: "Crear tenant y aplicar plantilla" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`), { timeout: 30_000 });

  // Con el módulo apagado (por defecto) no hay pantalla ni paso de ficha (AT-26).
  const off = await page.goto(`/t/${slug}/safety`);
  expect(off?.status()).toBe(404);

  await page.goto(`/platform/tenants/${slug}`);
  const modules = page.locator("section", { hasText: "Módulos de la empresa" });
  await modules.getByRole("button", { name: "Activar Accidentabilidad" }).click();
  await expect(modules.getByRole("button", { name: "Desactivar Accidentabilidad" })).toBeVisible({ timeout: 20_000 });

  await page.goto(`/t/${slug}/users`);
  const invite = page.locator("form", { has: page.getByRole("button", { name: "Invitar" }) });
  for (const [who, role] of [
    ["admin", "Administrador de la organización"],
    ["colab", "Colaborador"],
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

  const csv = [
    "legajo,nombre,dni,sede,sedes_adicionales,puesto,empresa,contratista,ingreso,tareas",
    `1,${person},,Planta e2e,,Operario,,,,`,
  ].join("\n");
  await page.goto(`/t/${slug}/master-data/people/import`);
  await page.locator('input[type="file"]').setInputFiles({ name: "nomina.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText("Vista previa de nomina.csv")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/Sí, crear lo que falta/).check();
  await page.getByRole("button", { name: /Confirmar e importar 1 persona/ }).click();
  await expect(page.getByText(/Importación lista: 1 nueva/)).toBeVisible({ timeout: 30_000 });

  // ── Colaborador: da de alta el hecho, sin la ficha de salud ───────────────
  await loginAs(page, "colab");
  await page.goto(`/t/${slug}/safety`);
  await expect(page.getByRole("heading", { name: "Accidentabilidad", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Registrar accidente" }).first().click();
  await expect(page.getByLabel("Tipo")).toHaveValue("incident");
  await page.getByLabel("Título preliminar").fill(title);
  await page.getByLabel("Descripción preliminar").fill("Resbaló en el pasillo mojado.");
  await page.getByLabel(/^Fecha y hora/).fill(`${day(-10)}T10:00`);
  await page.getByLabel(/^Sede/).selectOption({ label: "Planta e2e" });
  await page.getByLabel(/^¿Hubo lesión/).selectOption({ label: "Con baja" });
  await page.getByLabel(/^Forma del accidente/).selectOption({ label: "Caída al mismo nivel" });
  await page.getByLabel(/^Agente/).selectOption({ label: "Piso, escalera o desnivel" });
  await expect(page.getByText("La persona afectada y la lesión las completa después")).toBeVisible();
  await expect(page.getByLabel(/^Persona afectada/)).toHaveCount(0);
  await page.getByRole("button", { name: "Continuar al laboratorio" }).click();
  await expect(page.getByRole("heading", { name: "Completar y publicar" })).toBeVisible({ timeout: 30_000 });
  const findingPath = new URL(page.url()).pathname.replace(/\/edit$/, "");

  const ficha = page.locator("section", { has: page.getByRole("heading", { name: "Ficha de accidente" }) });
  await expect(ficha.getByText("Con baja").first()).toBeVisible();
  await expect(ficha.getByText("Falta completar la ficha de salud")).toBeVisible();
  await expect(ficha.getByText("Solo lectura")).toBeVisible();
  await expect(ficha.getByText("Completar la ficha de salud", { exact: true })).toHaveCount(0);

  // ── Administrador: completa la ficha de salud y actualiza los días ────────
  await loginAs(page, "admin");
  await page.goto(findingPath);
  await expect(page.getByRole("heading", { name: "Completar y publicar" })).toBeVisible({ timeout: 30_000 });
  await ficha.getByText("Completar la ficha de salud", { exact: true }).click();
  const people = ficha.locator('input[role="combobox"]');
  await people.fill("Marta");
  await page.getByRole("option", { name: new RegExp(person) }).click();
  await ficha.getByLabel(/^Naturaleza de la lesión/).selectOption({ label: "Esguince o torcedura" });
  await ficha.getByLabel(/^Parte del cuerpo/).selectOption({ label: "Pie o tobillo" });
  await ficha.getByRole("button", { name: "Guardar ficha de salud" }).click();
  await expect(ficha.getByText("Ficha de salud guardada")).toBeVisible({ timeout: 20_000 });
  await expect(ficha.getByText(`${person} · legajo 1`)).toBeVisible({ timeout: 20_000 });

  await ficha.getByText("Actualizar días o reclasificar", { exact: true }).click();
  await ficha.getByLabel(/^Fecha de reintegro/).fill(day(-3));
  await ficha.getByRole("button", { name: "Registrar seguimiento" }).click();
  await expect(ficha.getByText("Seguimiento registrado")).toBeVisible({ timeout: 20_000 });
  await expect(ficha.getByText(/reintegro/).first()).toBeVisible();
  await expect(ficha.getByText("6 día(s)")).toBeVisible();

  // ── Consulta: lee todo, sin controles de edición ──────────────────────────
  await loginAs(page, "consulta");
  await page.goto(findingPath);
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
  await expect(ficha.getByText(`${person} · legajo 1`)).toBeVisible();
  await expect(ficha.getByText("Esguince o torcedura")).toBeVisible();
  await expect(ficha.getByText("Solo lectura")).toBeVisible();
  await expect(ficha.getByRole("button")).toHaveCount(0);
  await expect(ficha.getByText("Registrar seguimiento")).toHaveCount(0);
  await page.goto(`/t/${slug}/safety`);
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await expect(page.getByRole("link", { name: "Registrar accidente" })).toHaveCount(0);

  // ── Plataforma: no recibe los datos de salud ──────────────────────────────
  await page.context().clearCookies();
  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/);
  await page.goto(findingPath);
  await expect(page.getByText("Los datos de salud no se muestran al personal de plataforma.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(person)).toHaveCount(0);
  await expect(page.getByText("Esguince o torcedura")).toHaveCount(0);
});
