import { test, expect, type Page } from "@playwright/test";

/**
 * Recorre los accesos rápidos del home (solo `next dev`).
 * Requiere `npm run db:seed` y `npm run db:seed:demo`.
 */
async function quickLogin(page: Page, account: RegExp) {
  await page.goto("/");
  await page.getByRole("button", { name: account }).click();
}

test("superusuario entra a plataforma y ve su marca", async ({ page }) => {
  await quickLogin(page, /Superusuario SGI/);
  await expect(page).toHaveURL(/\/platform$/);
  await expect(page.getByRole("banner").getByText("Superusuario", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
});

test("administrador de empresa va directo a su empresa", async ({ page }) => {
  await quickLogin(page, /Ana Administración/);
  await expect(page).toHaveURL(/\/t\/tisico$/);
  await expect(page.getByRole("banner").getByText("Administrador de la empresa")).toBeVisible();
  // La plataforma es solo del superusuario: vuelve a su empresa.
  await page.goto("/platform");
  await expect(page).toHaveURL(/\/t\/tisico$/);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("integrante de consulta ve 'Solo lectura'", async ({ page }) => {
  await quickLogin(page, /Elena Consulta/);
  await expect(page).toHaveURL(/\/t\/tisico$/);
  await expect(page.getByRole("banner").getByText("Solo lectura")).toBeVisible();
  await page.goto("/t/tisico/risks");
  await expect(page.getByRole("link", { name: "Explorar contexto" })).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/);
});
