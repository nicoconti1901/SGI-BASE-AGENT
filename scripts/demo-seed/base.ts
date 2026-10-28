import type { TenantRole } from "@prisma/client";
import { createTenantWithTemplate } from "../../src/lib/tenant-provisioning";
import { inviteTenantMember } from "../../src/lib/identity";
import { createJobPosition, createJobTask, createPerson, createSite } from "../../src/lib/masterdata";
import { DEMO_DOMAIN, DEMO_PASSWORD, db, step, type DemoTenant, type Member } from "./kit";

type UserDef = { key: string; name: string; role: TenantRole };

const MODULE_KEYS = ["inspections", "instruments", "safety_stats", "suppliers", "training"] as const;

async function createMembers(tenantId: string, tag: string, defs: UserDef[]) {
  const users: Record<string, Member> = {};
  for (const def of defs) {
    const email = `${def.key}.${tag}@${DEMO_DOMAIN}`;
    const m = await inviteTenantMember({ tenantId, name: def.name, email, password: DEMO_PASSWORD, role: def.role });
    users[def.key] = { userId: m.user.id, name: def.name, email };
  }
  return users;
}

async function enableModules(tenantId: string, actorUserId: string) {
  for (const moduleKey of MODULE_KEYS) {
    await db.tenantModuleActivation.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
      create: { tenantId, moduleKey, enabled: true, updatedByUserId: actorUserId },
      update: { enabled: true, updatedByUserId: actorUserId },
    });
  }
}

type PersonDef = {
  code: string;
  name: string;
  dni: string;
  site: string;
  position: string;
  tasks?: string[];
  employer?: "own" | "contractor";
  contractor?: string;
  user?: string;
  hired: string;
  extraSites?: string[];
};

export const PEOPLE_A: PersonDef[] = [
  { code: "L-001", name: "Ana Paredes", dni: "27345128", site: "Oficina Neuquén", position: "Gerente de operaciones", user: "admin", hired: "2018-03-12" },
  { code: "L-002", name: "Bruno Sosa", dni: "30221457", site: "Base Añelo", position: "Técnico de HSE", user: "hse", tasks: ["Izaje de cargas"], hired: "2019-06-03", extraSites: ["Obra Loma Campana"] },
  { code: "L-003", name: "Marcela Ledesma", dni: "28990314", site: "Oficina Neuquén", position: "Responsable de calidad", user: "calidad", hired: "2017-09-18" },
  { code: "L-004", name: "Diego Quiroga", dni: "33410982", site: "Base Añelo", position: "Supervisor de obra", user: "inspector", tasks: ["Trabajo en altura", "Espacios confinados"], hired: "2020-02-10" },
  { code: "L-005", name: "Lucía Herrera", dni: "35118774", site: "Planta Centenario", position: "Operario de planta", user: "operaciones", hired: "2021-05-24" },
  { code: "L-006", name: "Elena Fuentes", dni: "31877205", site: "Oficina Neuquén", position: "Administrativo", user: "consulta", hired: "2022-01-17" },
  { code: "L-007", name: "Tomás Ibarra", dni: "36502119", site: "Obra Loma Campana", position: "Soldador", user: "colaborador", tasks: ["Trabajo en caliente", "Trabajo en altura"], hired: "2021-11-08" },
  { code: "L-008", name: "Gabriela Montenegro", dni: "29554310", site: "Obra Loma Campana", position: "Capataz", tasks: ["Trabajo en altura", "Izaje de cargas"], hired: "2016-04-25" },
  { code: "L-009", name: "Julián Cabrera", dni: "34120786", site: "Obra Loma Campana", position: "Soldador", tasks: ["Trabajo en caliente"], hired: "2022-03-14" },
  { code: "L-010", name: "Rosa Villalba", dni: "26778431", site: "Planta Centenario", position: "Operario de planta", tasks: ["Manejo de sustancias químicas"], hired: "2015-08-31" },
  { code: "L-011", name: "Matías Aguirre", dni: "37445092", site: "Base Añelo", position: "Chofer", tasks: ["Conducción de vehículos"], hired: "2023-02-06" },
  { code: "L-012", name: "Florencia Suárez", dni: "38210657", site: "Base Añelo", position: "Chofer", tasks: ["Conducción de vehículos"], hired: "2023-07-19" },
  { code: "L-013", name: "Hernán Domínguez", dni: "32089544", site: "Obra Loma Campana", position: "Operador de grúa", tasks: ["Izaje de cargas", "Conducción de vehículos"], hired: "2019-10-07" },
  { code: "L-014", name: "Patricia Roldán", dni: "30765218", site: "Planta Centenario", position: "Supervisor de obra", tasks: ["Espacios confinados", "Manejo de sustancias químicas"], hired: "2018-12-03" },
  { code: "L-015", name: "Sergio Medina", dni: "25331870", site: "Obra Loma Campana", position: "Operario de obra", tasks: ["Trabajo en altura"], hired: "2014-06-16" },
  { code: "L-016", name: "Valeria Benítez", dni: "39004276", site: "Planta Centenario", position: "Operario de planta", hired: "2024-01-22" },
  { code: "L-017", name: "Cristian Peralta", dni: "36129845", site: "Obra Loma Campana", position: "Operario de obra", tasks: ["Trabajo en altura"], hired: "2023-09-11" },
  { code: "L-018", name: "Noelia Giménez", dni: "40118662", site: "Base Añelo", position: "Administrativo", hired: "2024-05-06" },
  { code: "L-019", name: "Facundo Ortiz", dni: "33887401", site: "Obra Loma Campana", position: "Operario de obra", tasks: ["Trabajo en altura", "Espacios confinados"], hired: "2022-08-29" },
  { code: "L-020", name: "Andrea Molina", dni: "31449920", site: "Oficina Neuquén", position: "Administrativo", hired: "2020-10-19" },
  { code: "C-101", name: "Walter Rivas", dni: "28330145", site: "Obra Loma Campana", position: "Soldador", tasks: ["Trabajo en caliente"], employer: "contractor", contractor: "Montajes Industriales del Comahue SRL", hired: "2025-02-03" },
  { code: "C-102", name: "Néstor Acuña", dni: "27118953", site: "Obra Loma Campana", position: "Operario de obra", tasks: ["Trabajo en altura"], employer: "contractor", contractor: "Montajes Industriales del Comahue SRL", hired: "2025-02-03" },
  { code: "C-103", name: "Ismael Torres", dni: "35660287", site: "Obra Loma Campana", position: "Operador de grúa", tasks: ["Izaje de cargas"], employer: "contractor", contractor: "Izajes Patagonia SA", hired: "2025-04-14" },
  { code: "C-104", name: "Camila Sandoval", dni: "37992014", site: "Planta Centenario", position: "Operario de planta", tasks: ["Manejo de sustancias químicas"], employer: "contractor", contractor: "Limpieza Industrial Austral SRL", hired: "2025-06-02" },
  { code: "C-105", name: "Ramón Escobar", dni: "24557186", site: "Base Añelo", position: "Chofer", tasks: ["Conducción de vehículos"], employer: "contractor", contractor: "Transportes Cuyo SA", hired: "2025-03-17" },
];

export const SITES_A = [
  { name: "Oficina Neuquén", kind: "office" as const, address: "Av. Argentina 1450, Neuquén Capital" },
  { name: "Base Añelo", kind: "base" as const, address: "Ruta Provincial 7 km 3, Añelo" },
  { name: "Obra Loma Campana", kind: "worksite" as const, address: "Yacimiento Loma Campana, Añelo" },
  { name: "Planta Centenario", kind: "plant" as const, address: "Parque Industrial, Centenario" },
  { name: "Campamento Sauzal", kind: "camp" as const, address: "Ruta 17 km 42, Sauzal Bonito" },
];

export const POSITIONS_A = [
  "Gerente de operaciones",
  "Técnico de HSE",
  "Responsable de calidad",
  "Supervisor de obra",
  "Capataz",
  "Soldador",
  "Operador de grúa",
  "Chofer",
  "Operario de obra",
  "Operario de planta",
  "Administrativo",
];

export const TASKS_A: { name: string; critical: boolean }[] = [
  { name: "Trabajo en altura", critical: true },
  { name: "Espacios confinados", critical: true },
  { name: "Trabajo en caliente", critical: true },
  { name: "Izaje de cargas", critical: true },
  { name: "Conducción de vehículos", critical: false },
  { name: "Manejo de sustancias químicas", critical: false },
];

/** Empresa grande con todos los módulos activos: la que se usa para recorrer los flujos. */
export async function seedTenantA(): Promise<DemoTenant> {
  const t = await createTenantWithTemplate({ name: "Constructora Patagonia Demo", slug: "demo-patagonia", size: "medium", activity: "construccion" });
  const users = await createMembers(t.id, "patagonia", [
    { key: "admin", name: "Ana Paredes", role: "tenant_admin" },
    { key: "hse", name: "Bruno Sosa", role: "process_owner" },
    { key: "calidad", name: "Marcela Ledesma", role: "process_owner" },
    { key: "inspector", name: "Diego Quiroga", role: "contributor" },
    { key: "operaciones", name: "Lucía Herrera", role: "contributor" },
    { key: "colaborador", name: "Tomás Ibarra", role: "contributor" },
    { key: "consulta", name: "Elena Fuentes", role: "viewer" },
  ]);
  const actorUserId = users.admin.userId;
  await enableModules(t.id, actorUserId);

  const siteIds: Record<string, string> = {};
  for (const s of SITES_A) siteIds[s.name] = (await createSite({ tenantId: t.id, actorUserId, ...s })).id;
  const positionIds: Record<string, string> = {};
  for (const name of POSITIONS_A) positionIds[name] = (await createJobPosition({ tenantId: t.id, actorUserId, name })).id;
  const taskIds: Record<string, string> = {};
  for (const task of TASKS_A) taskIds[task.name] = (await createJobTask({ tenantId: t.id, actorUserId, ...task })).id;

  const people: DemoTenant["people"] = [];
  for (const p of PEOPLE_A) {
    const person = await createPerson({
      tenantId: t.id,
      actorUserId,
      employeeCode: p.code,
      name: p.name,
      documentId: p.dni,
      userId: p.user ? users[p.user].userId : null,
      employer: p.employer ?? "own",
      contractorName: p.contractor ?? null,
      siteId: siteIds[p.site],
      extraSiteIds: (p.extraSites ?? []).map((s) => siteIds[s]),
      positionId: positionIds[p.position],
      hiredAt: new Date(`${p.hired}T00:00:00.000Z`),
      jobTaskIds: (p.tasks ?? []).map((n) => taskIds[n]),
    });
    if (p.user) users[p.user].personId = person.id;
    people.push({ id: person.id, name: p.name, code: p.code, site: p.site, position: p.position, employer: p.employer ?? "own" });
  }
  // Dos bajas para probar «dada de baja» en listas y asistentes.
  await db.person.updateMany({ where: { tenantId: t.id, employeeCode: { in: ["L-016", "C-104"] } }, data: { status: "inactive" } });

  return { id: t.id, slug: t.slug, name: t.name, users, siteIds, positionIds, taskIds, people };
}

/** Empresa chica: sirve para probar que nada se filtra entre empresas (otros datos, mismos nombres de sede). */
export async function seedTenantB(): Promise<DemoTenant> {
  const t = await createTenantWithTemplate({ name: "Alimentos del Sur Demo", slug: "demo-sur", size: "small", activity: "manufactura" });
  const users = await createMembers(t.id, "sur", [
    { key: "admin", name: "Raúl Benítez", role: "tenant_admin" },
    { key: "colaborador", name: "Sofía Maidana", role: "contributor" },
    { key: "consulta", name: "Gustavo Lerner", role: "viewer" },
  ]);
  const actorUserId = users.admin.userId;
  await enableModules(t.id, actorUserId);
  const siteIds: Record<string, string> = {};
  for (const s of [
    { name: "Base Añelo", kind: "base" as const, address: "Av. Costanera 200, Plottier" },
    { name: "Planta Plottier", kind: "plant" as const, address: "Parque Industrial, Plottier" },
  ]) {
    siteIds[s.name] = (await createSite({ tenantId: t.id, actorUserId, ...s })).id;
  }
  const positionIds: Record<string, string> = {};
  for (const name of ["Operario de planta", "Jefe de planta", "Chofer"]) {
    positionIds[name] = (await createJobPosition({ tenantId: t.id, actorUserId, name })).id;
  }
  const taskIds: Record<string, string> = {};
  taskIds["Manejo de sustancias químicas"] = (await createJobTask({ tenantId: t.id, actorUserId, name: "Manejo de sustancias químicas", critical: true })).id;

  const defs = [
    { code: "S-001", name: "Raúl Benítez", dni: "22105487", site: "Planta Plottier", position: "Jefe de planta", user: "admin" },
    { code: "S-002", name: "Sofía Maidana", dni: "34778102", site: "Planta Plottier", position: "Operario de planta", user: "colaborador" },
    { code: "S-003", name: "Gustavo Lerner", dni: "29330765", site: "Base Añelo", position: "Chofer", user: "consulta" },
    { code: "S-004", name: "Pablo Quintana", dni: "36448210", site: "Planta Plottier", position: "Operario de planta" },
    { code: "S-005", name: "Daniela Fernández", dni: "37001954", site: "Planta Plottier", position: "Operario de planta" },
  ];
  const people: DemoTenant["people"] = [];
  for (const p of defs) {
    const person = await createPerson({
      tenantId: t.id,
      actorUserId,
      employeeCode: p.code,
      name: p.name,
      documentId: p.dni,
      userId: p.user ? users[p.user].userId : null,
      siteId: siteIds[p.site],
      positionId: positionIds[p.position],
      hiredAt: new Date("2022-04-01T00:00:00.000Z"),
      jobTaskIds: p.position === "Operario de planta" ? [taskIds["Manejo de sustancias químicas"]] : [],
    });
    if (p.user) users[p.user].personId = person.id;
    people.push({ id: person.id, name: p.name, code: p.code, site: p.site, position: p.position, employer: "own" });
  }
  return { id: t.id, slug: t.slug, name: t.name, users, siteIds, positionIds, taskIds, people };
}

export async function seedFoundation() {
  const a = await step("Empresa A (usuarios, sedes, puestos, personas)", seedTenantA);
  const b = await step("Empresa B (aislamiento entre empresas)", seedTenantB);
  return { a, b };
}
