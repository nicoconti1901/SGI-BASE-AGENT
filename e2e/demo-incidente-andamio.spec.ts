import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * Demo en vivo: carga completa de un incidente (caída desde andamio).
 * No corre en la suite normal. Ejecutar:
 *   DEMO=1 npx playwright test e2e/demo-incidente-andamio.spec.ts --headed --workers=1
 * Requiere `npm run db:seed` y `npm run db:seed:demo`.
 */
test.skip(!process.env.DEMO, "Solo para demostración en vivo (DEMO=1)");
test.use({ launchOptions: { slowMo: 350 }, viewport: { width: 1400, height: 900 } });

const pause = (page: Page, ms = 1200) => page.waitForTimeout(ms);

async function answerLevel(page: Page, answer: string, evidence: string) {
  await page.getByPlaceholder("Respondé con un hecho verificable del proceso o sistema…").fill(answer);
  await page.getByPlaceholder("Testimonio, registro, foto, medición…").fill(evidence);
}

async function deepen(page: Page) {
  await page.getByRole("button", { name: "Profundizar esta rama (otro ¿por qué?)" }).click();
}

async function fillMeasure(
  block: Locator,
  m: { kind: string; owner: string; title: string; due: string; root: boolean },
) {
  await block.getByLabel("Tipo").selectOption({ label: m.kind });
  await block.getByLabel("Responsable").selectOption({ label: m.owner });
  await block.getByLabel("Título").fill(m.title);
  await block.getByLabel("Vence").fill(m.due);
  if (m.root) await block.getByLabel("Ataca la causa raíz").check();
}

test("incidente: caída de operario desde andamio", async ({ page }) => {
  test.setTimeout(10 * 60_000);

  // 1. Ingreso como responsable de SST
  await page.goto("/");
  await pause(page);
  await page.getByRole("button", { name: /Facundo SST/ }).click();
  await expect(page).toHaveURL(/\/t\/tisico$/);
  await pause(page);

  // 2. Alta del hallazgo
  await page.getByRole("link", { name: "Hallazgos" }).first().click();
  await pause(page);
  await page.getByRole("link", { name: "Crear hallazgo" }).click();
  await page.getByLabel("Tipo").selectOption({ label: "Incidente" });
  await page.getByLabel("Título preliminar").fill("Caída de operario desde andamio en nave 2");
  await page
    .getByLabel("Descripción preliminar")
    .fill(
      "Un operario de mantenimiento cayó desde el segundo cuerpo de un andamio tubular (aprox. 2,4 m) mientras pintaba la estructura del techo de la nave 2.",
    );
  await pause(page);
  await page.getByRole("button", { name: "Continuar al laboratorio" }).click();
  await expect(page.getByRole("heading", { name: "Completar y publicar" })).toBeVisible({ timeout: 20_000 });
  await pause(page);

  // 3. Datos del hecho
  await page.getByLabel("Detectado el").fill("2026-09-26");
  await page.getByLabel("Origen").fill("Reporte del supervisor de turno — parte de accidente N.º 0142");
  await pause(page);

  // 4. Laboratorio 5 Porqués — investigación previa
  for (const item of [
    "Tarea que se realizaba",
    "Quiénes estaban presentes",
    "Qué ocurrió inmediatamente antes (secuencia)",
    "Equipos / instalaciones involucrados",
    "Estado de protecciones y resguardos",
    "Procedimientos y permisos existentes",
  ]) {
    await page.getByLabel(item).check();
  }
  await page
    .getByLabel("Secuencia temporal (breve)")
    .fill(
      "07:50 armado del andamio por contratista → 08:10 se retira la baranda del lado norte para subir latas de pintura → 08:35 el operario se desplaza hacia el borde sin baranda → 08:40 caída al piso.",
    );
  await pause(page);

  const hecho =
    "El 26/09 a las 08:40, un operario de mantenimiento cayó desde 2,4 m al piso desde el lado norte de un andamio tubular en la nave 2, donde la baranda había sido retirada. Sufrió fractura de muñeca izquierda; no tenía el arnés enganchado a la línea de vida.";
  await page.getByLabel("Hecho / incidente (obligatorio)").fill(hecho);
  await page.getByRole("button", { name: "Aplicar hecho a las preguntas de nivel 1" }).click();
  await pause(page);

  // Rama A — condición del andamio
  await page.getByLabel("Nombre de la rama activa").fill("A — Condición del andamio (baranda retirada)");
  await answerLevel(
    page,
    "El lado norte del andamio quedó sin baranda porque se retiró para subir las latas de pintura a mano.",
    "Foto del andamio tomada 08:50; testimonio del ayudante.",
  );
  await deepen(page);
  await answerLevel(
    page,
    "No había un medio de izaje de materiales, así que la única forma de subir las latas era retirar la baranda.",
    "Inspección del sector: no hay roldana ni aparejo disponible en la nave 2.",
  );
  await deepen(page);
  await answerLevel(
    page,
    "El procedimiento de trabajo en altura no define cómo subir materiales ni prohíbe retirar barandas con personal arriba.",
    "Procedimiento PR-SST-07 rev. 2, sección 5.",
  );
  await pause(page);
  await page.getByRole("button", { name: "Marcar como causa raíz de esta rama" }).click();
  await pause(page);

  // Rama D — organización / supervisión
  await page.getByRole("button", { name: "+ D" }).click();
  await page.getByLabel("Nombre de la rama activa").fill("D — Permiso de trabajo en altura");
  await answerLevel(
    page,
    "El operario trabajó con el arnés puesto pero sin enganchar porque la línea de vida no estaba instalada en ese sector.",
    "Testimonio del operario; arnés sin marcas de uso de conector.",
  );
  await deepen(page);
  await answerLevel(
    page,
    "El permiso de trabajo en altura se firmó sin verificar en el lugar que la línea de vida estuviera instalada.",
    "Permiso PTA-0931 firmado a las 07:45, sin ítem de verificación en campo.",
  );
  await deepen(page);
  await answerLevel(
    page,
    "El formulario de permiso no exige verificación en el lugar por parte del supervisor antes de habilitar la tarea.",
    "Formulario FR-SST-12 vigente.",
  );
  await pause(page);
  await page.getByRole("button", { name: "Marcar como causa raíz de esta rama" }).click();
  await pause(page);

  await page.getByLabel(/el hecho no debería repetirse/).check();
  await page.getByRole("button", { name: "Confirmar causa(s) raíz" }).click();
  await expect(page.getByText(/Causa raíz confirmada/)).toBeVisible();
  await pause(page, 2000);

  // 5. Medidas
  const measures = page.locator("section").filter({ has: page.getByRole("heading", { name: /3\. Medidas/ }) });
  const plan = [
    {
      kind: "Correctiva",
      owner: "Bruno Procesos (bruno.procesos@tisico.test)",
      title: "Modificar PR-SST-07: izaje de materiales con roldana y prohibición de retirar barandas con personal arriba",
      due: "2026-10-15",
      root: true,
    },
    {
      kind: "Correctiva",
      owner: "Facundo SST (facundo.sst@tisico.test)",
      title: "Agregar al permiso FR-SST-12 la verificación en el lugar de línea de vida y barandas, firmada por el supervisor",
      due: "2026-10-10",
      root: true,
    },
    {
      kind: "Preventiva",
      owner: "Diego Operaciones (diego.ops@tisico.test)",
      title: "Instalar roldana de izaje y línea de vida fija en nave 2",
      due: "2026-10-31",
      root: false,
    },
  ];
  const blocks = measures.locator("div.grid");
  for (let i = 0; i < plan.length; i++) {
    // El editor puede traer una medida vacía de inicio: agregar solo si falta.
    if ((await blocks.count()) <= i) {
      await measures.getByRole("button", { name: "Agregar medida" }).click();
    }
    await fillMeasure(blocks.nth(i), plan[i]);
    await pause(page, 800);
  }

  // 6. Notificados
  await page.getByLabel("Ana Administración · ana.admin@tisico.test").check();
  await page.getByLabel("Facundo SST · facundo.sst@tisico.test").check();
  await pause(page);

  // 7. Revisión y publicación
  await expect(page.getByText("Listo para publicar.")).toBeVisible();
  await page.getByText("Listo para publicar.").scrollIntoViewIfNeeded();
  await pause(page, 2000);
  await page.getByRole("button", { name: "Publicar hallazgo" }).click();
  await expect(page).not.toHaveURL(/\/edit$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Caída de operario desde andamio en nave 2" })).toBeVisible();

  // Tiempo para mirar la ficha publicada
  await page.mouse.wheel(0, 600);
  await pause(page, 4000);
  await page.mouse.wheel(0, 900);
  await pause(page, 6000);
});
