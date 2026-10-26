import { test, expect, type Page } from "@playwright/test";

/**
 * Carga de calibraciones (Task 16.3): un detector de H₂S con tres puntos, el resultado calculado en vivo, el
 * certificado adjunto, el cierre y el equipo vigente; después un envío al laboratorio. Usa una empresa propia y activa
 * el módulo desde la plataforma. Requiere `npm run db:seed`.
 */
async function setup(page: Page, stamp: number) {
  const slug = `e2e-carga-${stamp}`;
  const code = `DET-${String(stamp).slice(-5)}`;
  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/, { timeout: 30_000 });
  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Carga ${stamp}`);
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

  await page.goto(`/t/${slug}/instruments/new`);
  await page.getByLabel("Código").fill(code);
  await page.getByLabel("Descripción").fill("Detector de gases cuadrilla norte");
  await page.getByLabel("Sede").selectOption({ label: "Base e2e" });
  await page.getByLabel("Magnitud").selectOption("gas_concentration");
  await page.getByLabel("Canal 1: nombre").fill("H₂S");
  await page.getByLabel("Unidad").fill("ppm");
  await page.getByLabel("Rango: hasta").fill("100");
  await page.getByLabel("% de la lectura").fill("10");
  await page.getByRole("button", { name: "Registrar equipo" }).click();
  await expect(page.getByText("NO USAR")).toBeVisible({ timeout: 30_000 });
  return { slug, code, fichaUrl: page.url() };
}

async function fillRow(page: Page, group: string, index: number, values: [string, string, string]) {
  const scope = page.getByRole("group", { name: group });
  await scope.getByLabel("Patrón").nth(index).fill(values[0]);
  await scope.getByLabel("Medido").nth(index).fill(values[1]);
  await scope.getByLabel("Incert. (U)").nth(index).fill(values[2]);
}

test("carga la calibración de un detector con tres puntos, ve el resultado en vivo y lo deja vigente", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const warnings: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /controlled|uncontrolled|hydrat/i.test(m.text())) warnings.push(m.text().slice(0, 200));
  });
  const { slug, code, fichaUrl } = await setup(page, Date.now());

  await page.getByRole("link", { name: "Cargar calibración" }).click();
  await expect(page).toHaveURL(/\/records\/new$/, { timeout: 30_000 });
  await page.getByRole("textbox", { name: /^Laboratorio/ }).fill("INTI");
  await page.getByLabel("Trazabilidad").selectOption("accredited_lab");
  await page.getByLabel("Organismo que acredita").fill("OAA");
  await page.getByLabel("N.º de acreditación").fill("LC 123");

  // Mientras no hay puntos no se puede cerrar y se explica qué falta.
  await expect(page.getByRole("button", { name: "Cerrar y guardar resultado" })).toBeDisabled();
  await expect(page.getByText("Todavía no se puede calcular. Falta:")).toBeVisible();

  // Tres puntos del caso del SPEC: el segundo está justo en el límite (2,2 + 0,3 = 2,5) y pasa.
  await fillRow(page, "Puntos medidos", 0, ["10", "10,5", "0,3"]);
  await expect(page.getByText("Pasa").first()).toBeVisible();
  await page.getByRole("button", { name: "Agregar un punto de H₂S" }).click();
  await fillRow(page, "Puntos medidos", 1, ["25", "27,2", "0,3"]);
  await page.getByRole("button", { name: "Agregar un punto de H₂S" }).click();
  await fillRow(page, "Puntos medidos", 2, ["50", "53", "0,5"]);
  await expect(page.getByText("No pasa")).toHaveCount(0);
  const result = page.getByRole("region", { name: "Resultado calculado" });
  await expect(result).toContainText("Apto");
  await expect(result).toContainText("Vigente hasta el");

  // Un punto fuera de tolerancia cambia el resultado al instante; se corrige y vuelve a pasar.
  await fillRow(page, "Puntos medidos", 2, ["50", "55,6", "0,5"]);
  await expect(page.getByText("No pasa")).toBeVisible();
  await expect(result).toContainText("No apto");
  await fillRow(page, "Puntos medidos", 2, ["50", "53", "0,5"]);
  await expect(result).toContainText("Apto");

  // Sin certificado, el cierre se rechaza pero el borrador queda guardado.
  await page.getByRole("button", { name: "Cerrar y guardar resultado" }).click();
  await expect(page.getByText(/Adjuntá el certificado/)).toBeVisible({ timeout: 30_000 });

  await page.getByLabel(/Adjuntar el certificado/).setInputFiles({ name: "certificado-001.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 e2e") });
  await page.getByRole("button", { name: "Cerrar y guardar resultado" }).click();
  await expect(page).toHaveURL(fichaUrl, { timeout: 30_000 });

  // La ficha: vigente, con el certificado para descargar y el detalle del registro.
  await expect(page.getByText("Se puede usar")).toBeVisible();
  await expect(page.getByText("NO USAR")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "certificado-001.pdf" })).toBeVisible();
  await page.getByRole("link", { name: "Ver detalle" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Calibración del .* · ${code}`) })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("cell", { name: "±5" })).toBeVisible();

  // Envío al laboratorio: el equipo pasa a «No usar: en calibración» hasta que vuelve.
  await page.goto(fichaUrl);
  await page.getByText("Enviar a calibrar").click();
  await page.getByRole("button", { name: "Registrar el envío" }).click();
  await expect(page.getByText("NO USAR")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("En calibración").first()).toBeVisible();
  // El panel sigue abierto tras el envío: solo se abre si hace falta.
  const back = page.getByRole("button", { name: "Registrar el regreso" });
  if (!(await back.isVisible())) await page.getByText("Registrar el regreso del laboratorio").click();
  await back.click();
  await expect(page.getByText("Se puede usar")).toBeVisible({ timeout: 30_000 });

  // Anular el registro con motivo: el equipo vuelve a «sin calibración inicial» y el registro queda a la vista, anulado.
  await page.getByRole("link", { name: "Ver detalle" }).click();
  await page.getByText("Anular este registro").click();
  await page.getByLabel("Motivo de la anulación").fill("Se cargó en el equipo equivocado");
  await page.getByRole("button", { name: "Anular registro" }).click();
  await expect(page.getByText("Anulado: Se cargó en el equipo equivocado").first()).toBeVisible({ timeout: 30_000 });
  await page.goto(fichaUrl);
  await expect(page.getByText("NO USAR")).toBeVisible();
  await expect(page.getByText("Sin calibración inicial").first()).toBeVisible();
  await expect(page.getByText("Anulado: Se cargó en el equipo equivocado")).toBeVisible();

  // En el celular (375 px) el formulario de carga no se desborda.
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`/t/${slug}/instruments/${fichaUrl.split("/").pop()}/records/new`);
  await expect(page.getByRole("button", { name: "Agregar un punto de H₂S" })).toBeVisible({ timeout: 30_000 });
  const overflowing = await page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 6)
      .map((el) => `${el.tagName}.${String(el.className).slice(0, 60)} ${Math.round(el.getBoundingClientRect().right)}`),
  );
  expect(overflowing).toEqual([]);
  expect(warnings).toEqual([]);
});
