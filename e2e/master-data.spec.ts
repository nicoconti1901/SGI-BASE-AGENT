import { test, expect, type Page } from "@playwright/test";

/** Requiere `npm run db:seed` y `npm run db:seed:demo`. */
async function quickLogin(page: Page, account: RegExp) {
  await page.goto("/");
  await page.getByRole("button", { name: account }).click();
  await expect(page).toHaveURL(/\/t\/tisico$/, { timeout: 30_000 });
}

test("el administrador da de alta, edita, da de baja y reactiva una sede", async ({ page }) => {
  const name = `Obrador e2e ${Date.now()}`;
  const renamed = `${name} norte`;
  await quickLogin(page, /Ana Administración/);

  await page.getByRole("link", { name: "Datos maestros" }).click();
  await expect(page).toHaveURL(/\/t\/tisico\/master-data\/people$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Datos maestros", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Sedes", exact: true }).click();
  await expect(page).toHaveURL(/\/master-data\/sites$/, { timeout: 30_000 });

  const create = page.locator("form", { has: page.getByRole("button", { name: "Registrar sede" }) });
  await create.getByLabel("Nombre").fill(name);
  await create.getByLabel("Tipo de sede").selectOption({ label: "Obrador" });
  await create.getByRole("button", { name: "Registrar sede" }).click();
  await expect(page.getByText("Alta registrada")).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("Obrador");

  // El nombre no se puede repetir (sin distinguir mayúsculas).
  await create.getByLabel("Nombre").fill(name.toUpperCase());
  await create.getByRole("button", { name: "Registrar sede" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Ya existe" })).toBeVisible();

  // Edición.
  await row.getByText(`Editar ${name}`).click();
  await row.getByLabel("Nombre").fill(renamed);
  await row.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: renamed })).toBeVisible();

  // Baja y reactivación.
  const renamedRow = page.getByRole("listitem").filter({ hasText: renamed });
  await renamedRow.getByRole("button", { name: `Dar de baja: ${renamed}` }).click();
  await expect(page.getByRole("heading", { name: /Sedes dadas de baja/ })).toBeVisible();
  await page.getByRole("button", { name: `Reactivar: ${renamed}` }).click();
  await expect(page.getByRole("heading", { name: /Sedes dadas de baja/ })).toHaveCount(0);
});

test("el administrador registra un puesto y una tarea crítica", async ({ page }) => {
  const stamp = Date.now();
  await quickLogin(page, /Ana Administración/);

  await page.goto("/t/tisico/master-data/positions");
  const position = page.locator("form", { has: page.getByRole("button", { name: "Registrar puesto" }) });
  await position.getByLabel("Nombre").fill(`Rigger e2e ${stamp}`);
  await position.getByRole("button", { name: "Registrar puesto" }).click();
  await expect(page.getByText("Alta registrada")).toBeVisible();

  await page.getByRole("link", { name: "Tareas", exact: true }).click();
  const task = page.locator("form", { has: page.getByRole("button", { name: "Registrar tarea" }) });
  await task.getByLabel("Nombre").fill(`Izaje e2e ${stamp}`);
  await task.getByLabel("Tarea crítica").check();
  await task.getByRole("button", { name: "Registrar tarea" }).click();
  await expect(page.getByText("Alta registrada")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: `Izaje e2e ${stamp}` })).toContainText("Crítica");
});

test("consulta ve los datos maestros pero no puede modificarlos", async ({ page }) => {
  await quickLogin(page, /Elena Consulta/);
  await page.goto("/t/tisico/master-data/sites");
  await expect(page.getByText(/Solo lectura: el administrador/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar sede" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Dar de baja/ })).toHaveCount(0);
});

test.describe.serial("personas", () => {
  const stamp = Date.now();
  const site = `Planta e2e ${stamp}`;
  const position = `Soldador e2e ${stamp}`;
  const task = `Soldadura e2e ${stamp}`;
  const csv = [
    "legajo,nombre,dni,sede,sedes_adicionales,puesto,empresa,contratista,ingreso,tareas",
    `E${stamp}-1,Marta Importada,30111222,${site},,${position},,,15/01/2024,${task}`,
    `E${stamp}-2,Nico Contratista,,${site},,${position},contratista,Montajes SA,,`,
  ].join("\n");
  const upload = (page: Page) =>
    page.locator('input[type="file"]').setInputFiles({ name: "nomina.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

  test("importa la nómina con vista previa y confirmación de lo que se crea", async ({ page }) => {
    await quickLogin(page, /Ana Administración/);
    await page.goto("/t/tisico/master-data/people/import");
    await upload(page);

    await expect(page.getByText("Vista previa de nomina.csv")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Se van a crear datos que todavía no existen")).toBeVisible();
    const confirm = page.getByRole("button", { name: "Confirmar e importar 2 persona(s)" });
    await expect(confirm).toBeDisabled();
    await page.getByLabel(/Sí, crear lo que falta/).check();
    await confirm.click();
    await expect(page.getByText(/Importación lista: 2 nueva\(s\)/)).toBeVisible({ timeout: 30_000 });

    await page.goto(`/t/tisico/master-data/people?q=${stamp}`);
    await expect(page.getByRole("row", { name: /Marta Importada/ })).toContainText(site);
    await expect(page.getByRole("row", { name: /Nico Contratista/ })).toContainText("Montajes SA");
  });

  test("reimportar el mismo archivo no cambia nada", async ({ page }) => {
    await quickLogin(page, /Ana Administración/);
    await page.goto("/t/tisico/master-data/people/import");
    await upload(page);
    await expect(page.getByText("El archivo no trae cambios")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Confirmar e importar 0/ })).toBeDisabled();
  });

  test("no se puede dar de baja una sede con personas activas", async ({ page }) => {
    await quickLogin(page, /Ana Administración/);
    await page.goto("/t/tisico/master-data/sites");
    const row = page.getByRole("listitem").filter({ hasText: site });
    await row.getByRole("button", { name: `Dar de baja: ${site}` }).click();
    await expect(row.getByRole("alert")).toContainText("Marta Importada");
  });

  test("registra una persona a mano y la da de baja", async ({ page }) => {
    await quickLogin(page, /Ana Administración/);
    await page.goto("/t/tisico/master-data/people");
    await page.getByRole("link", { name: "Registrar persona" }).click();
    await expect(page.getByRole("heading", { name: "Registrar persona", level: 2 })).toBeVisible();
    // Tras la navegación del cliente, el formulario puede terminar de montarse después del primer llenado.
    await expect(async () => {
      await page.getByLabel("Legajo").fill(`M${stamp}`);
      await expect(page.getByLabel("Legajo")).toHaveValue(`M${stamp}`, { timeout: 500 });
    }).toPass({ timeout: 10_000 });
    await page.getByLabel("Nombre y apellido").fill("Rosa Rotativa");
    await page.getByLabel("Puesto").selectOption({ label: position });
    await page.getByLabel("Sede base").selectOption({ label: site });
    await page.getByRole("button", { name: "Registrar persona" }).click();
    await expect(page.getByRole("heading", { name: "Rosa Rotativa" })).toBeVisible({ timeout: 30_000 });

    await page.getByLabel("Motivo de la baja").fill("Renuncia");
    await page.getByRole("button", { name: "Dar de baja a Rosa Rotativa" }).click();
    await expect(page.getByText("Persona dada de baja")).toBeVisible();
    await expect(page.getByText(/Baja de Rosa Rotativa .*Renuncia/)).toBeVisible();
  });

  test("el responsable de proceso asigna tareas pero no edita la ficha", async ({ page }) => {
    await quickLogin(page, /Bruno Procesos/);
    await page.goto(`/t/tisico/master-data/people?q=${stamp}`);
    await expect(page.getByRole("link", { name: "Registrar persona" })).toHaveCount(0);
    await page.getByRole("link", { name: "Nico Contratista" }).click();
    await expect(page.getByRole("heading", { name: "Tareas asignadas" })).toBeVisible();
    await expect(page.getByLabel("Legajo")).toHaveCount(0);
    await page.getByLabel(task).check();
    await page.getByRole("button", { name: "Guardar tareas" }).click();
    await expect(page.getByText("Tareas actualizadas")).toBeVisible();
  });

  test("consulta ve la nómina sin acciones de edición", async ({ page }) => {
    await quickLogin(page, /Elena Consulta/);
    await page.goto(`/t/tisico/master-data/people?q=${stamp}`);
    await expect(page.getByRole("link", { name: "Importar nómina" })).toHaveCount(0);
    await page.getByRole("link", { name: "Marta Importada" }).click();
    await expect(page.getByText("30111222")).toBeVisible();
    await expect(page.getByRole("button", { name: /Dar de baja/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Guardar tareas" })).toHaveCount(0);
  });
});
