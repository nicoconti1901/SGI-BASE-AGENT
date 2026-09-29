import { test, expect, type Page } from "@playwright/test";

/** Requiere `npm run db:seed` y `npm run db:seed:demo`. Usa 2099 para no mezclar con el año real. */
async function quickLogin(page: Page, account: RegExp) {
  await page.goto("/");
  await page.getByRole("button", { name: account }).click();
  await expect(page).toHaveURL(/\/t\/tisico$/);
}

test("el administrador planifica una auditoría externa y adjunta el informe PDF", async ({ page }) => {
  await quickLogin(page, /Ana Administración/);
  const title = `Recertificación e2e ${Date.now()}`;

  await page.goto("/t/tisico/audits/externas/new");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Entidad que audita").fill("Certificadora e2e");
  await page.getByLabel("Tipo de auditoría").selectOption({ label: "Recertificación" });
  await page.getByLabel("Inicio").fill("2099-05-10");
  await page.getByLabel("Fin").fill("2099-05-11");
  await page.getByRole("button", { name: "Crear auditoría externa" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 20_000 });

  await page.getByLabel("Informe del auditor externo").setInputFiles({
    name: "informe.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%e2e"),
  });
  await page.getByRole("button", { name: "Adjuntar informe" }).click();
  await expect(page.getByText("Informe adjuntado")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: "informe.pdf" })).toBeVisible();
  await expect(page.getByTitle(/Vista del informe informe\.pdf/)).toBeVisible();

  const findingTitle = `Hallazgo externo e2e ${Date.now()}`;
  await page.getByLabel("Título").last().fill(findingTitle);
  await page.getByLabel("Descripción y evidencia").fill("Falta evidencia de calibración");
  await page.getByRole("button", { name: "Registrar hallazgo" }).click();
  await expect(page.getByText("Hallazgo registrado como borrador")).toBeVisible({ timeout: 20_000 });

  await page.getByLabel("Resultado o recomendación").fill("Recomienda mantener la certificación");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Plan guardado")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Marcar como realizada" })).toBeVisible();

  await page.goto("/t/tisico/findings");
  await expect(page.getByText(findingTitle)).toBeVisible();
});
