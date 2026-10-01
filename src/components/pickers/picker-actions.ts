"use server";

import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { searchPeople } from "@/lib/masterdata";

export type PersonOption = { id: string; name: string; employeeCode: string; siteName: string };

/**
 * Búsqueda para `PersonPicker`. Cualquier integrante de la empresa puede leer la nómina activa
 * (el DNI no se devuelve: los selectores muestran nombre, legajo y sede).
 */
export async function searchPeopleAction(
  slug: string,
  query: { q?: string; siteId?: string },
): Promise<PersonOption[]> {
  const ctx = await getAppSessionContext();
  if (!ctx) return [];
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return [];
  const membership = await getMembership(ctx.userId, tenant.id);
  if (!membership && !ctx.isPlatformSuperuser) return [];

  const people = await searchPeople(tenant.id, {
    q: (query.q ?? "").slice(0, 80),
    siteId: query.siteId || undefined,
    take: 20,
  });
  return people.map((p) => ({ id: p.id, name: p.name, employeeCode: p.employeeCode, siteName: p.site.name }));
}
