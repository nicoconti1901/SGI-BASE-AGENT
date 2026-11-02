import { test, expect, type Page } from "@playwright/test";

/** Requiere `npm run db:seed` y `npm run db:seed:demo`. */
async function quickLogin(page: Page, account: RegExp) {
  await page.goto("/");
  await page.getByRole("button", { name: account }).click();
  await expect(page).toHaveURL(/\/t\/tisico$/);
}

test("un archivo adjunto se quita con confirmación y deja de figurar", async ({ page }) => {
  await quickLogin(page, /Ana Administración/);

  await page.goto("/t/tisico/findings/new");
  await page.getByLabel("Título preliminar").fill(`Adjuntos e2e ${Date.now()}`);
  await page.getByLabel("Descripción preliminar").fill("Prueba de adjuntos: se carga un archivo y después se quita.");
  await page.getByRole("button", { name: "Continuar al análisis de causa" }).click();
  await expect(page.getByRole("heading", { name: "Completar y publicar" })).toBeVisible({ timeout: 20_000 });

  // Al elegir el archivo se adjunta solo.
  await page.locator('input[type="file"][name="file"]').first().setInputFiles({
    name: "foto-escena.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  await expect(page.getByText("foto-escena.png").first()).toBeVisible({ timeout: 20_000 });

  // «Quitar» pregunta primero; cancelar no borra nada.
  await page.getByRole("button", { name: "Quitar el archivo foto-escena.png" }).click();
  await expect(page.getByText("¿Quitar este archivo? No se puede deshacer.")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByText("foto-escena.png").first()).toBeVisible();

  await page.getByRole("button", { name: "Quitar el archivo foto-escena.png" }).click();
  await page.getByRole("button", { name: "Sí, quitar" }).click();
  await expect(page.getByText("foto-escena.png")).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByText("Todavía no hay documentación adjunta.")).toBeVisible();
});
