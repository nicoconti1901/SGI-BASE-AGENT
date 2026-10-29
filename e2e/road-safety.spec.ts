import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Seguridad vial (Task 18, 18.3 y 18.4): un choque con solo daño material se registra una vez, los km del mes se cargan
 * a mano, el índice aparece en `/road-safety` (1 hecho en 1.000 km = 1.000,00 por millón de km) y no suma en el tablero
 * laboral. El colaborador ve el tablero pero no los conductores ni el CSV con nombres. Usa una empresa propia; requiere
 * `npm run db:seed` (superusuario). El vehículo se «adelanta» en el tiempo con la base: el alta por la pantalla lo deja
 * creado hoy y la flota de un mes cerrado solo incluye los vehículos que ya existían.
 */
test("seguridad vial: choque con daño material, km del mes, índice vial y sin suma en el tablero laboral", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  const db = new PrismaClient();
  const stamp = Date.now();
  const slug = `e2e-vial-${stamp}`;
  const password = "Clave-e2e-123";
  const email = (who: string) => `${who}-${stamp}@e2e.test`;
  const code = `VIAL${String(stamp).slice(-6)}`;
  const title = `Choque en ruta ${stamp}`;

  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 10));
  const prevMonth = prev.toISOString().slice(0, 7);
  const isoInDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

  async function loginAs(page: Page, who: string) {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email(who));
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(new RegExp(`/t/${slug}$`), { timeout: 30_000 });
  }

  try {
    // ── Plataforma: empresa, tres módulos, usuarios ────────────────────────
    await page.goto("/");
    await page.getByRole("button", { name: /Superusuario SGI/ }).click();
    await expect(page).toHaveURL(/\/platform$/, { timeout: 60_000 });
    await page.goto("/platform/tenants");
    await page.getByLabel("Nombre").fill(`E2E Vial ${stamp}`);
    await page.getByLabel(/^Slug/).fill(slug);
    await page.getByRole("button", { name: "Crear tenant y aplicar plantilla" }).click();
    await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`), { timeout: 30_000 });
    const modules = page.locator("section", { hasText: "Módulos de la empresa" });
    for (const name of ["Inspecciones", "Accidentabilidad", "Seguridad vial"]) {
      await modules.getByRole("button", { name: `Activar ${name}`, exact: true }).click();
      await expect(modules.getByRole("button", { name: `Desactivar ${name}` })).toBeVisible({ timeout: 20_000 });
    }

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

    // ── Administrador: sede y un vehículo por CSV ──────────────────────────
    await loginAs(page, "admin");
    await page.goto(`/t/${slug}/master-data/sites`);
    const site = page.locator("form", { has: page.getByRole("button", { name: "Registrar sede" }) });
    await site.getByLabel("Nombre").fill("Base vial");
    await site.getByRole("button", { name: "Registrar sede" }).click();
    await expect(page.getByText("Alta registrada")).toBeVisible();

    await page.goto(`/t/${slug}/assets/import?tipo=light_vehicle`);
    await expect(page.getByRole("heading", { name: /Importar vehículos livianos/i })).toBeVisible({ timeout: 30_000 });
    const csv = [
      "codigo,descripcion,sede,dominio,marca,modelo,vence_seguro,vence_rto,vence_service",
      `${code},Camioneta de cuadrilla,Base vial,AB123CD,Toyota,Hilux,${isoInDays(200)},${isoInDays(200)},${isoInDays(100)}`,
    ].join("\n");
    await page.getByLabel("Archivo CSV").setInputFiles({ name: "vehiculos.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(page.getByText("Vista previa de vehiculos.csv")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Confirmar e importar 1 activo(s)" }).click();
    await expect(page.getByText(/Importación lista: 1 nuevo\(s\)/)).toBeVisible({ timeout: 60_000 });
    await db.asset.updateMany({ where: { code }, data: { createdAt: new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1)) } });

    // ── Choque con solo daño material: un hecho, con su detalle vial ───────
    await page.goto(`/t/${slug}/road-safety`);
    await expect(page.getByRole("heading", { name: "Seguridad vial", level: 1 })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("link", { name: "Registrar hecho de tránsito" }).click();
    await expect(page.getByLabel("Tipo")).toHaveValue("incident");
    await page.getByLabel("Título preliminar").fill(title);
    await page.getByLabel("Descripción preliminar").fill("Choque leve al maniobrar, sin lesionados.");
    await page.getByLabel(/^Fecha y hora/).fill(`${prevMonth}-10T10:00`);
    await page.getByLabel(/^Sede/).selectOption({ label: "Base vial" });
    await page.getByLabel("Fue un hecho de tránsito").check();
    await page.getByLabel(/^¿Hubo lesión/).selectOption({ label: "Solo daño material" });
    await page.getByLabel(/^Vehículo de la flota/).selectOption({ label: `${code} · Camioneta de cuadrilla` });
    await page.getByRole("button", { name: "Continuar al laboratorio" }).click();
    await expect(page.getByRole("heading", { name: "Completar y publicar" })).toBeVisible({ timeout: 30_000 });

    // ── Km del mes: sin odómetros, se cargan a mano con motivo ─────────────
    await page.goto(`/t/${slug}/road-safety/km?mes=${prevMonth}`);
    const row = page.getByRole("row", { name: new RegExp(code) });
    await expect(row.getByText("Sin dato")).toBeVisible({ timeout: 30_000 });
    await row.getByRole("button", { name: "Cargar a mano" }).click();
    await row.getByLabel(`Km de ${code}`).fill("1000");
    await row.getByLabel(`Motivo para ${code}`).fill("Sin odómetros cargados en la prueba");
    await row.getByRole("button", { name: "Guardar" }).click();
    await expect(row.getByText("Manual").first()).toBeVisible({ timeout: 30_000 });

    // ── Tablero vial: 1 hecho en 1.000 km = 1.000,00 por millón de km ──────
    await page.goto(`/t/${slug}/road-safety?ventana=month&mes=${prevMonth}`);
    await expect(page.getByRole("heading", { name: "3. Tasas por millón de km" })).toBeVisible({ timeout: 30_000 });
    const monthCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Mes", exact: true }) });
    await expect(monthCard).toContainText("1.000,00");
    await expect(monthCard).toContainText("Poca exposición");
    await expect(page.getByRole("heading", { name: "1. Resultado final" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "6. Conductores para revisar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Descargar casos (con nombres)" })).toBeVisible();

    // ── Tablero laboral: el daño material no suma ──────────────────────────
    await page.goto(`/t/${slug}/safety/stats?ventana=month&mes=${prevMonth}`);
    await expect(page.getByRole("heading", { name: "Índices de siniestralidad" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("No hubo eventos en el período.")).toBeVisible();

    // ── Ajustes y guía ─────────────────────────────────────────────────────
    await page.goto(`/t/${slug}/road-safety/ajustes`);
    await expect(page.getByRole("heading", { name: "Conductores habilitados" })).toBeVisible({ timeout: 30_000 });
    await page.goto(`/t/${slug}/road-safety/guia`);
    await expect(page.getByRole("heading", { name: "Guía de seguridad vial" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/sin verificar/).first()).toBeVisible();

    // ── Colaborador: ve el tablero y los totales, pero no a los conductores ─
    await loginAs(page, "colab");
    await page.goto(`/t/${slug}/road-safety?ventana=month&mes=${prevMonth}`);
    await expect(page.getByRole("heading", { name: "3. Tasas por millón de km" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Mes", exact: true }) })).toContainText("1.000,00");
    await expect(page.getByRole("heading", { name: "6. Conductores para revisar" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Descargar casos (con nombres)" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Conductores", exact: true })).toHaveCount(0);
    await page.goto(`/t/${slug}/road-safety/conductores`);
    await expect(page.getByText("Esta lista es del administrador y del responsable de proceso.")).toBeVisible({ timeout: 30_000 });
    const denied = await page.request.get(`/t/${slug}/road-safety/export?ventana=month&mes=${prevMonth}&tipo=casos`);
    expect(denied.status()).toBe(403);
    const totals = await page.request.get(`/t/${slug}/road-safety/export?ventana=month&mes=${prevMonth}&tipo=totales`);
    expect(totals.status()).toBe(200);
    expect(await totals.text()).toContain("1000,00;0,00;0,00;completo;");
  } finally {
    await db.$disconnect();
  }
});
