import { test, expect, type Page } from "@playwright/test";

/**
 * Carga de calibraciones (Task 16.3): un detector de H₂S con tres puntos, el resultado calculado en vivo, el
 * certificado adjunto, el cierre y el equipo vigente; después un envío al laboratorio. Usa una empresa propia y activa
 * el módulo desde la plataforma. Requiere `npm run db:seed`.
 */
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/** `tag` distingue las empresas de pruebas que corren en paralelo (el reloj puede dar el mismo milisegundo). */
async function setup(page: Page, tag: string, opts: { inspections?: boolean } = {}) {
  const stamp = Date.now();
  const slug = `e2e-carga-${stamp}-${tag}`;
  const code = `DET-${tag.toUpperCase()}${String(stamp).slice(-4)}`;
  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/, { timeout: 30_000 });
  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(`E2E Carga ${stamp} ${tag}`);
  await page.getByLabel(/^Slug/).fill(slug);
  await page.getByRole("button", { name: "Crear tenant y aplicar plantilla" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`), { timeout: 30_000 });
  const modules = page.getByRole("region", { name: "Módulos de la empresa" }).or(page.locator("section", { hasText: "Módulos de la empresa" }));
  await modules.getByRole("button", { name: "Activar Equipos de medición", exact: true }).click();
  await expect(modules.getByRole("button", { name: "Desactivar Equipos de medición" })).toBeVisible({ timeout: 20_000 });
  if (opts.inspections) {
    await modules.getByRole("button", { name: "Activar Inspecciones", exact: true }).click();
    await expect(modules.getByRole("button", { name: "Desactivar Inspecciones" })).toBeVisible({ timeout: 20_000 });
  }

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

/** Carga y cierra una calibración de un solo punto (patrón 50 ppm) con el certificado adjunto. */
async function loadAndClose(page: Page, fichaUrl: string, measured: string) {
  await page.goto(fichaUrl);
  await page.getByRole("link", { name: "Cargar calibración" }).click();
  await expect(page).toHaveURL(/\/records\/new$/, { timeout: 30_000 });
  await page.getByRole("textbox", { name: /^Laboratorio/ }).fill("INTI");
  await page.getByLabel("Trazabilidad").selectOption("nmi");
  await fillRow(page, "Puntos medidos", 0, ["50", measured, "0,5"]);
  await page.getByLabel(/Adjuntar el certificado/).setInputFiles({ name: "certificado.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 e2e") });
  await page.getByRole("button", { name: "Cerrar y guardar resultado" }).click();
  await expect(page).toHaveURL(fichaUrl, { timeout: 30_000 });
}

test("un detector fuera de tolerancia queda en «No usar» hasta completar la evaluación de impacto, con hallazgo y acción", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const warnings: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /controlled|uncontrolled|hydrat/i.test(m.text())) warnings.push(m.text().slice(0, 200));
  });
  const { slug, code, fichaUrl } = await setup(page, "impacto");

  // Un punto fuera de tolerancia (58 contra 50 ppm, máximo ±5): no apto y evaluación de impacto abierta.
  await loadAndClose(page, fichaUrl, "58");
  await expect(page.getByText("NO USAR")).toBeVisible();
  await expect(page.getByText("No apto en el último control").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evaluación de impacto pendiente" })).toBeVisible();
  await expect(page.getByText("Mediciones a revisar")).toBeVisible();

  // La lista lo muestra como «No usar» con el motivo y cuenta la evaluación pendiente.
  await page.goto(`/t/${slug}/instruments`);
  const row = page.locator("tbody tr").first();
  await expect(row).toContainText(code);
  await expect(row).toContainText("No usar");
  await expect(row).toContainText("No apto en el último control");

  // Cargar una calibración apta no alcanza: falta la evaluación, y la lista la cuenta aparte.
  await loadAndClose(page, fichaUrl, "50,5");
  await expect(page.getByText("NO USAR")).toBeVisible();
  await expect(page.getByText("Falta la evaluación de impacto de la última calibración").first()).toBeVisible();
  await page.goto(`/t/${slug}/instruments`);
  await expect(page.getByRole("link", { name: /^Evaluaciones pendientes: 1/ })).toBeVisible();
  await page.goto(fichaUrl);

  // Sin acciones ni hallazgo, «no se puede determinar» se rechaza.
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Evaluación de impacto pendiente" }) });
  await panel.getByLabel("No se puede determinar el efecto").check();
  await panel.getByLabel("Qué se midió con el equipo en ese período").fill("Atmósfera de espacios confinados de la cuadrilla norte");
  await panel.getByLabel("Justificación de la decisión").fill("No hay registros que permitan reconstruir los valores");
  await panel.getByRole("button", { name: "Completar la evaluación" }).click();
  await expect(panel.getByText(/^Si hubo mediciones afectadas.*al menos una acción o un hallazgo/)).toBeVisible({ timeout: 30_000 });

  // Con mediciones afectadas el hallazgo en borrador se crea solo (las acciones de seguimiento se prueban en integración:
  // el superusuario de plataforma no es miembro de la empresa y no puede ser responsable).
  await panel.getByLabel("Hubo mediciones afectadas y se tomaron acciones").check();
  await expect(panel.getByLabel(/Registrar un hallazgo en borrador/)).toBeChecked();
  await panel.getByRole("button", { name: "Completar la evaluación" }).click();

  await expect(page.getByText("Se puede usar")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Evaluaciones de impacto realizadas" })).toBeVisible();
  await expect(page.getByText("Hubo mediciones afectadas y se tomaron acciones").first()).toBeVisible();
  const finding = page.getByRole("link", { name: /^Hallazgo: / });
  await expect(finding).toBeVisible();

  // El hallazgo existe en borrador y viene de la calibración.
  await finding.click();
  await expect(page).toHaveURL(/\/findings\//, { timeout: 30_000 });
  await expect(page.getByText("Borrador de hallazgo")).toBeVisible();

  // La lista ya no tiene nada que atender.
  await page.goto(`/t/${slug}/instruments`);
  await expect(page.locator("tbody tr").first()).not.toContainText("No usar");
  expect(warnings).toEqual([]);
});

test("la prueba funcional es opcional: sin Inspecciones no se ofrece, y una falla saca el equipo de servicio y abre la evaluación", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const warnings: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /controlled|uncontrolled|hydrat/i.test(m.text())) warnings.push(m.text().slice(0, 200));
  });
  const { code, fichaUrl } = await setup(page, "prueba", { inspections: true });
  await loadAndClose(page, fichaUrl, "50,5");
  await expect(page.getByText("Se puede usar")).toBeVisible();
  await expect(page.getByText(/Todavía no se hizo ninguna prueba funcional/)).toBeVisible();

  // Una prueba funcional apta no cambia nada: el equipo sigue vigente.
  await page.getByRole("button", { name: "Hacer la prueba funcional" }).click();
  await expect(page).toHaveURL(/\/inspections\/[a-z0-9]+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: code, level: 2 })).toBeVisible({ timeout: 30_000 });
  const conformButtons = page.getByRole("button", { name: "Conforme", exact: true });
  for (let i = 0, n = await conformButtons.count(); i < n; i++) await conformButtons.nth(i).click();
  await page.getByRole("button", { name: "Revisar y cerrar" }).click();
  await page.getByRole("button", { name: "Cerrar y firmar" }).click();
  await expect(page.getByRole("link", { name: "Ver el equipo" })).toBeVisible({ timeout: 30_000 });
  await page.goto(fichaUrl);
  await expect(page.getByText("Se puede usar")).toBeVisible();
  await expect(page.getByText(/Último control previo al uso: .* Apto/)).toBeVisible();

  // Ahora no responde al gas de prueba: no apto.
  await page.getByRole("button", { name: "Hacer la prueba funcional" }).click();
  await expect(page).toHaveURL(/\/inspections\/[a-z0-9]+$/, { timeout: 30_000 });
  for (let i = 0, n = await conformButtons.count(); i < n; i++) await conformButtons.nth(i).click();
  const response = page.getByRole("article", { name: /Responde a una referencia conocida/ });
  await response.getByRole("button", { name: "No conforme" }).click();
  await response.getByLabel(/Qué encontraste/).fill("La lectura no sube con el gas de prueba");
  await response.getByLabel("Sacar o elegir foto").setInputFiles({ name: "bump.png", mimeType: "image/png", buffer: PNG_1PX });
  await expect(response.getByRole("img", { name: /Foto de la no conformidad/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Revisar y cerrar" }).click();
  await page.getByRole("button", { name: "Cerrar y firmar" }).click();
  await expect(page.getByRole("link", { name: "Ver el equipo" })).toBeVisible({ timeout: 30_000 });

  // La ficha: fuera de servicio y con la evaluación de impacto pendiente por la prueba fallida.
  await page.goto(fichaUrl);
  await expect(page.getByText("NO USAR")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evaluación de impacto pendiente" })).toBeVisible();
  await expect(page.getByText("Falló la prueba funcional")).toBeVisible();
  expect(warnings).toEqual([]);
});

test("carga la calibración de un detector con tres puntos, ve el resultado en vivo y lo deja vigente", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const warnings: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /controlled|uncontrolled|hydrat/i.test(m.text())) warnings.push(m.text().slice(0, 200));
  });
  const { slug, code, fichaUrl } = await setup(page, "carga");

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
  // Sin el módulo Inspecciones no se ofrece la prueba funcional.
  await expect(page.getByRole("button", { name: "Hacer la prueba funcional" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "certificado-001.pdf" })).toBeVisible();

  // El tablero de la lista: cumplimiento del plan y la guía del módulo.
  await page.goto(`/t/${slug}/instruments`);
  const plan = page.getByRole("region", { name: "Plan de calibración y próximos vencimientos" });
  await expect(plan).toContainText("100 %");
  await expect(plan).toContainText("1 de 1 equipos con control se pueden usar hoy");
  await expect(plan.getByText("Ningún equipo vence en los próximos 30 días.")).toBeVisible();
  await page.getByRole("link", { name: "Guía de equipos de medición →" }).click();
  await expect(page.getByRole("heading", { name: "Guía de equipos de medición" })).toBeVisible({ timeout: 30_000 });
  await page.goto(fichaUrl);
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
