import { redirect } from "next/navigation";
import {
  getAppSessionContext,
  listUserTenantSlugs,
  resolveUserHomePath,
} from "@/lib/session";

/**
 * `/portal` y `/portal/<sección>` son atajos: llevan al usuario a su empresa
 * (la última usada) sin pedirle que elija o "active" nada.
 * Devuelve solo si el usuario no pertenece a ninguna empresa.
 */
export async function redirectToUserPortal(section?: string): Promise<void> {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");

  if (!section) {
    const home = await resolveUserHomePath(ctx);
    if (home) redirect(home);
    return;
  }

  const [slug] = await listUserTenantSlugs(ctx);
  if (slug) redirect(`/t/${slug}/${section}`);
  if (ctx.isPlatformSuperuser) redirect("/platform/tenants");
}
