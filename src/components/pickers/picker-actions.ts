"use server";

import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { searchPeople } from "@/lib/masterdata";
import { getEnabledModules } from "@/lib/modules";
import { getTaskQualifications } from "@/lib/training";

/** Habilitación para una tarea (módulo de Capacitaciones): solo viene si se pidió una tarea y el módulo está activo. */
export type PersonQualification = { qualified: boolean; hasRequirements: boolean; missingCourses: number };

export type PersonOption = {
  id: string;
  name: string;
  employeeCode: string;
  siteName: string;
  qualification?: PersonQualification;
};

/**
 * Búsqueda para `PersonPicker`. Cualquier integrante de la empresa puede leer la nómina activa
 * (el DNI no se devuelve: los selectores muestran nombre, legajo y sede).
 */
export async function searchPeopleAction(
  slug: string,
  query: { q?: string; siteId?: string; taskId?: string },
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
  const options: PersonOption[] = people.map((p) => ({ id: p.id, name: p.name, employeeCode: p.employeeCode, siteName: p.site.name }));
  if (!query.taskId || options.length === 0) return options;

  // Habilitación para la tarea: una consulta para todos los resultados, y solo si Capacitaciones está activo.
  if (!(await getEnabledModules(tenant.id)).has("training")) return options;
  const qualifications = await getTaskQualifications(tenant.id, options.map((o) => o.id), query.taskId);
  if (!qualifications) return options;
  return options.map((o) => {
    const q = qualifications.get(o.id);
    return q ? { ...o, qualification: { qualified: q.qualified, hasRequirements: q.hasRequirements, missingCourses: q.blockers.length } } : o;
  });
}
