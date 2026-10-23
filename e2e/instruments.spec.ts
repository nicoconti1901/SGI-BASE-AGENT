import { test, expect } from "@playwright/test";

/**
 * Equipos de medición (Task 16.1–16.2): registrar un detector de gases con un canal, verlo como «No usar» (sin
 * calibración inicial) en la lista y en la ficha, filtrar por el contador y comprobar que un equipo sin control
 * figura aparte. Usa una empresa propia y activa el módulo desde la plataforma. Requiere `npm run db:seed`.
 */
test("registra un detector, lo ve como «No usar» sin calibración inicial y filtra por estado", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const stamp = Date.now();
  const slug = `e2e-cal-${stamp}`;
  const code = `DET-${String(stamp).slice(-5)}`;
  // Un aviso de React en consola (por ejemplo, un campo que pasa de controlado a no controlado) rompe la prueba.
  const warnings: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /controlled|uncontrolled|hydrat/i.test(m.text())) warnings.push(m.text().slice(0, 200));
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/, { timeout: 30_000 });
  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Calibraciones ${stamp}`);
  await page.getByLabel(/^Slug/).fill(slug);
  await page.getByRole("button", { name: "Crear tenant y aplicar plantilla" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`), { timeout: 30_000 });
  const modules = page.getByRole("region", { name: "Módulos de la empresa" }).or(page.locator("section", { hasText: "Módulos de la empresa" }));
  await modules.getByRole("button", { name: "Activar Equipos de medición", exact: true }).click();
  await expect(modules.getByRole("button", { name: "Desactivar Equipos de medición" })).toBeVisible({ timeout: 20_000 });

  await page.goto(`/t/${slug}/master-data/sites`);
  const site = page.locator("form", { has: page.getByRole("button", { name: "Registrar sede" }) });
  await site.getByLabel("Nombre").fill("Base e2e");
  await site.getByRole("button", { name: "Registrar sede" }).click();
  await expect(page.getByText("Alta registrada")).toBeVisible();

  // Lista vacía con la invitación a registrar el primero.
  await page.goto(`/t/${slug}/instruments`);
  await expect(page.getByRole("heading", { name: "Equipos de medición (0)" })).toBeVisible();
  await expect(page.getByText("Todavía no hay equipos de medición.")).toBeVisible();

  // Alta de un detector de H₂S: 6 meses sugeridos por ser detector de gases.
  await page.getByRole("link", { name: "Registrar equipo" }).first().click();
  await expect(page).toHaveURL(/\/instruments\/new$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Registrar un equipo de medición" })).toBeVisible();
  await page.getByLabel("Código").fill(code);
  await page.getByLabel("Descripción").fill("Detector de gases cuadrilla norte");
  await page.getByLabel("Sede").selectOption({ label: "Base e2e" });
  await page.getByLabel("Magnitud").selectOption("gas_concentration");
  await expect(page.getByLabel("Calibrar cada (meses)")).toHaveValue("6");
  await page.getByLabel("Canal 1: nombre").fill("H₂S");
  await page.getByLabel("Unidad").fill("ppm");
  await page.getByLabel("Rango: hasta").fill("100");
  await page.getByLabel("% de la lectura").fill("10");
  await page.getByRole("button", { name: "Registrar equipo" }).click();

  // La ficha dice NO USAR y por qué.
  await expect(page.getByText("NO USAR")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Sin calibración inicial").first()).toBeVisible();
  await expect(page.getByText("Qué hacer: Cargar la calibración inicial")).toBeVisible();
  await expect(page.getByText("Se acepta si el error más la incertidumbre no supera ±(10 % de la lectura).")).toBeVisible();
  // Edición: la configuración vuelve cargada y se puede cambiar.
  // Navegación completa: en desarrollo la primera visita compila la ruta y la navegación suave puede tardar.
  await page.goto((await page.getByRole("link", { name: "Editar equipo" }).getAttribute("href"))!);
  await expect(page.getByLabel("Canal 1: nombre")).toHaveValue("H₂S", { timeout: 30_000 });
  await expect(page.getByLabel("Calibrar cada (meses)")).toHaveValue("6");
  await page.getByLabel("Descripción").fill("Detector de gases cuadrilla sur");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible({ timeout: 30_000 });

  // Un segundo equipo sin control metrológico (con su justificación).
  await page.goto(`/t/${slug}/instruments/new`);
  await page.getByLabel("Código").fill(`${code}-IND`);
  await page.getByLabel("Descripción").fill("Termómetro indicativo de oficina");
  await page.getByLabel("Sede").selectOption({ label: "Base e2e" });
  await page.getByLabel("Se calibra en un laboratorio").uncheck();
  await page.getByLabel("Por qué no se calibra ni se verifica").fill("Indicativo, no decide nada");
  await page.getByRole("button", { name: "Registrar equipo" }).click();
  await expect(page).toHaveURL(new RegExp(`/instruments/(?!new)[a-z0-9]+$`), { timeout: 30_000 });
  await expect(page.getByText("Se puede usar").or(page.getByText("Sin control metrológico", { exact: true })).first()).toBeVisible();

  // La lista: el detector va primero, como «No usar» con el motivo; el contador filtra.
  await page.goto(`/t/${slug}/instruments`);
  await expect(page.getByRole("heading", { name: "Equipos de medición (2)" })).toBeVisible();
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toContainText(code);
  await expect(rows.first()).toContainText("No usar");
  await expect(rows.first()).toContainText("Sin calibración inicial");
  await page.getByRole("link", { name: /^No usar: 1/ }).click();
  await expect(page).toHaveURL(/estado=unusable/);
  await expect(rows).toHaveCount(1);

  // El equipo de medición no aparece entre los activos de inspección.
  await page.goto(`/t/${slug}/assets`);
  await expect(page.getByText(code)).toHaveCount(0);

  // Exportación CSV con los mismos filtros.
  const res = await page.request.get(`/t/${slug}/instruments/export`);
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("No");

  expect(warnings).toEqual([]);
});
