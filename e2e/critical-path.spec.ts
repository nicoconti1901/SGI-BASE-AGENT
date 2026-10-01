import { test, expect, type Page } from "@playwright/test";

/**
 * Camino crítico de punta a punta, con una empresa propia (slug con sello de tiempo):
 * superusuario crea empresa → carga gap → sube documento → invita a un usuario →
 * publica una NC con medida correctiva vencida en el futuro → el usuario ve el
 * vencimiento en su panel.
 * Requiere `npm run db:seed` (superusuario) y `next dev` (accesos rápidos).
 */
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const slug = `e2e-crit-${stamp}`;
const tenantName = `E2E Crítico ${stamp}`;
const member = {
  name: "Marta Responsable",
  email: `marta.${stamp}@e2e.test`,
  password: "E2e-Password-123!",
};
const ncTitle = `NC e2e ${stamp}`;
const measureTitle = `Acción correctiva e2e ${stamp}`;

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function answerLevel(page: Page, answer: string, evidence: string) {
  await page.getByPlaceholder("Respondé con un hecho verificable del proceso o sistema…").fill(answer);
  await page.getByPlaceholder("Testimonio, registro, foto, medición…").fill(evidence);
}

test("superusuario crea la empresa, carga el gap y sube un documento", async ({ page }) => {
  test.setTimeout(2 * 60_000);
  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/);

  await page.goto("/platform/tenants");
  await page.getByLabel("Nombre").fill(tenantName);
  await page.getByLabel(/^Slug/).fill(slug);
  await page.getByRole("button", { name: "Crear tenant y aplicar plantilla" }).click();
  await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`), { timeout: 30_000 });

  // Gap: marcar el primer requisito como conforme.
  await page.getByRole("link", { name: "Cargar gap / assessment" }).click();
  await page.locator("select[name^='status_']").first().selectOption("compliant");
  await page.getByRole("button", { name: "Guardar gap" }).first().click();
  await expect(page.getByText(/Gap guardado/)).toBeVisible({ timeout: 20_000 });

  // Documento.
  await page.goto(`/platform/tenants/${slug}/documents`);
  await page.getByLabel("Título", { exact: true }).fill("Manual de calidad e2e");
  await page.getByLabel(/^Archivo/).setInputFiles({
    name: "manual.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Manual de calidad — versión de prueba e2e"),
  });
  await page.getByRole("button", { name: "Subir", exact: true }).click();
  await expect(page.getByText("Documento guardado correctamente.")).toBeVisible({ timeout: 30_000 });

  // Invitar al usuario que va a ver el panel.
  await page.goto(`/t/${slug}/users`);
  await page.getByLabel("Nombre", { exact: true }).fill(member.name);
  await page.getByLabel("Email").fill(member.email);
  await page.getByLabel("Contraseña temporal").fill(member.password);
  await page.getByLabel("Rol").selectOption("contributor");
  await page.getByRole("button", { name: "Invitar" }).click();
  await expect(page.getByText("Usuario invitado correctamente.")).toBeVisible({ timeout: 20_000 });
});

test("se publica una NC con medida correctiva y el usuario ve el vencimiento en su panel", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const due = isoDaysFromNow(5);

  await page.goto("/");
  await page.getByRole("button", { name: /Superusuario SGI/ }).click();
  await expect(page).toHaveURL(/\/platform$/);

  await page.goto(`/t/${slug}/findings/new`);
  await page.getByLabel("Tipo").selectOption({ label: "No conformidad" });
  await page.getByLabel("Título preliminar").fill(ncTitle);
  await page.getByLabel("Descripción preliminar").fill("Se detectó un registro de inspección sin firmar en el proceso de despacho.");
  await page.getByRole("button", { name: "Continuar al laboratorio" }).click();
  await expect(page.getByRole("heading", { name: "Completar y publicar" })).toBeVisible({ timeout: 20_000 });

  await page.getByLabel("Detectado el").fill(isoDaysFromNow(-1));
  await page.getByLabel("Origen").fill("Inspección interna e2e");

  // Laboratorio de 5 Porqués: hechos, una rama de 3 niveles y causa raíz.
  for (const item of [
    "Tarea que se realizaba",
    "Quiénes estaban presentes",
    "Qué ocurrió inmediatamente antes (secuencia)",
  ]) {
    await page.getByLabel(item).check();
  }
  await page
    .getByLabel("Hecho / incidente (obligatorio)")
    .fill("El 28/09 el registro de inspección de despacho N.º 88 se archivó sin la firma del responsable.");
  await page.getByRole("button", { name: "Aplicar hecho a las preguntas de nivel 1" }).click();

  await answerLevel(
    page,
    "El responsable no firmó porque el formulario se completó en otro turno.",
    "Registro de despacho N.º 88, turno noche.",
  );
  await page.getByRole("button", { name: "Profundizar esta rama (otro ¿por qué?)" }).click();
  await answerLevel(
    page,
    "El cambio de turno no incluye un paso de control de registros pendientes.",
    "Procedimiento de relevo de turno vigente, sin ese paso.",
  );
  await page.getByRole("button", { name: "Profundizar esta rama (otro ¿por qué?)" }).click();
  await answerLevel(
    page,
    "El procedimiento de despacho no define quién verifica las firmas antes de archivar.",
    "Procedimiento PR-DES-03, sección 4.",
  );
  await page.getByRole("button", { name: "Marcar como causa raíz de esta rama" }).click();
  await page.getByLabel(/el hecho no debería repetirse/).check();
  await page.getByRole("button", { name: "Confirmar causa(s) raíz" }).click();
  await expect(page.getByText(/Causa raíz confirmada/)).toBeVisible();

  // Medida correctiva con vencimiento.
  const measures = page.locator("section").filter({ has: page.getByRole("heading", { name: /3\. Medidas/ }) });
  const block = measures.locator("div.grid").first();
  if ((await block.count()) === 0) {
    await measures.getByRole("button", { name: "Agregar medida" }).click();
  }
  await block.getByLabel("Tipo").selectOption({ label: "Correctiva" });
  // El responsable queda en el único miembro de la empresa (primer valor por defecto).
  await block.getByLabel("Título").fill(measureTitle);
  await block.getByLabel("Vence").fill(due);
  await block.getByLabel("Ataca la causa raíz").check();

  await page.getByRole("checkbox", { name: new RegExp(member.email) }).check();
  await expect(page.getByText("Listo para publicar.")).toBeVisible();
  await page.getByRole("button", { name: "Publicar hallazgo" }).click();
  await expect(page).not.toHaveURL(/\/edit$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: ncTitle })).toBeVisible();

  await signOut(page);

  // El usuario invitado entra por /login y ve el vencimiento en el panel.
  await page.goto("/login");
  await page.getByLabel("Email").fill(member.email);
  await page.getByLabel("Contraseña").fill(member.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`/t/${slug}$`), { timeout: 30_000 });

  const dueList = page.locator("section").filter({ has: page.getByRole("heading", { name: "Próximos vencimientos" }) });
  await expect(dueList.getByText(measureTitle)).toBeVisible();
  await expect(dueList.getByText("Medida de hallazgo")).toBeVisible();
  await expect(dueList.getByText(due)).toBeVisible();
  await expect(page.getByRole("group", { name: "Resumen" }).getByText("Próximos a vencer")).toBeVisible();

  // Sigue el enlace al detalle del hallazgo.
  await dueList.getByRole("link", { name: new RegExp(measureTitle) }).click();
  await expect(page.getByRole("heading", { name: ncTitle })).toBeVisible();
});
