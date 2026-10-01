import { Prisma, type PersonEmployer, type PrismaClient, type SiteKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canDeactivate, isValidDocumentId } from "@/domain/masterdata/rules";
import {
  cleanName,
  normalizeKey,
  parseRoster,
  planRosterImport,
  type RosterPlan,
} from "@/domain/masterdata/roster";
import {
  MASTER_DATA_ENTITY_LABELS,
  type MasterDataEntity,
  type RosterPersonSnapshot,
  type RosterRowError,
} from "@/domain/masterdata/types";

type Db = PrismaClient;

/** Error de negocio con un mensaje listo para mostrar en la UI. */
export class MasterDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MasterDataError";
  }
}

const dateFromIso = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const isoFromDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

async function audit(
  db: Db | Prisma.TransactionClient,
  input: {
    tenantId: string;
    entityType: string;
    entityId: string;
    action: "create" | "update" | "deactivate" | "reactivate" | "import";
    actorUserId: string | null;
    summary: string;
  },
) {
  await db.masterDataAudit.create({ data: input });
}

// ─── Catálogo: sedes, puestos y tareas ─────────────────────────────────────

function requireName(raw: string): string {
  const name = cleanName(raw);
  if (name.length < 2) throw new MasterDataError("El nombre debe tener al menos 2 caracteres");
  return name;
}

async function assertNameFree(
  db: Db,
  entity: MasterDataEntity,
  tenantId: string,
  name: string,
  exceptId?: string,
) {
  const where = { tenantId, name: { equals: name, mode: "insensitive" as const }, id: { not: exceptId } };
  const found =
    entity === "site"
      ? await db.site.findFirst({ where })
      : entity === "position"
        ? await db.jobPosition.findFirst({ where })
        : await db.jobTask.findFirst({ where });
  if (found) {
    throw new MasterDataError(`Ya existe una ${MASTER_DATA_ENTITY_LABELS[entity]} llamada «${found.name}»`);
  }
}

export async function listSites(tenantId: string, opts: { includeInactive?: boolean } = {}, db: Db = prisma) {
  return db.site.findMany({
    where: { tenantId, ...(opts.includeInactive ? {} : { active: true }) },
    orderBy: { name: "asc" },
  });
}

export async function listJobPositions(tenantId: string, opts: { includeInactive?: boolean } = {}, db: Db = prisma) {
  return db.jobPosition.findMany({
    where: { tenantId, ...(opts.includeInactive ? {} : { active: true }) },
    orderBy: { name: "asc" },
  });
}

export async function listJobTasks(tenantId: string, opts: { includeInactive?: boolean } = {}, db: Db = prisma) {
  return db.jobTask.findMany({
    where: { tenantId, ...(opts.includeInactive ? {} : { active: true }) },
    orderBy: { name: "asc" },
  });
}

export async function createSite(
  input: { tenantId: string; actorUserId: string; name: string; kind?: SiteKind; address?: string | null },
  db: Db = prisma,
) {
  const name = requireName(input.name);
  await assertNameFree(db, "site", input.tenantId, name);
  const site = await db.site.create({
    data: { tenantId: input.tenantId, name, kind: input.kind ?? "office", address: input.address?.trim() || null },
  });
  await audit(db, { tenantId: input.tenantId, entityType: "site", entityId: site.id, action: "create", actorUserId: input.actorUserId, summary: `Alta de sede «${name}»` });
  return site;
}

export async function updateSite(
  input: { tenantId: string; actorUserId: string; id: string; name?: string; kind?: SiteKind; address?: string | null },
  db: Db = prisma,
) {
  const current = await db.site.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
  if (!current) throw new MasterDataError("Sede no encontrada");
  const name = input.name === undefined ? current.name : requireName(input.name);
  if (name !== current.name) await assertNameFree(db, "site", input.tenantId, name, current.id);
  const site = await db.site.update({
    where: { id: current.id },
    data: {
      name,
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
    },
  });
  await audit(db, { tenantId: input.tenantId, entityType: "site", entityId: site.id, action: "update", actorUserId: input.actorUserId, summary: `Edición de sede «${site.name}»` });
  return site;
}

export async function createJobPosition(
  input: { tenantId: string; actorUserId: string; name: string },
  db: Db = prisma,
) {
  const name = requireName(input.name);
  await assertNameFree(db, "position", input.tenantId, name);
  const position = await db.jobPosition.create({ data: { tenantId: input.tenantId, name } });
  await audit(db, { tenantId: input.tenantId, entityType: "position", entityId: position.id, action: "create", actorUserId: input.actorUserId, summary: `Alta de puesto «${name}»` });
  return position;
}

export async function renameJobPosition(
  input: { tenantId: string; actorUserId: string; id: string; name: string },
  db: Db = prisma,
) {
  const current = await db.jobPosition.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
  if (!current) throw new MasterDataError("Puesto no encontrado");
  const name = requireName(input.name);
  if (name !== current.name) await assertNameFree(db, "position", input.tenantId, name, current.id);
  const position = await db.jobPosition.update({ where: { id: current.id }, data: { name } });
  await audit(db, { tenantId: input.tenantId, entityType: "position", entityId: position.id, action: "update", actorUserId: input.actorUserId, summary: `Edición de puesto «${name}»` });
  return position;
}

export async function createJobTask(
  input: { tenantId: string; actorUserId: string; name: string; critical?: boolean },
  db: Db = prisma,
) {
  const name = requireName(input.name);
  await assertNameFree(db, "task", input.tenantId, name);
  const task = await db.jobTask.create({ data: { tenantId: input.tenantId, name, critical: input.critical ?? false } });
  await audit(db, { tenantId: input.tenantId, entityType: "task", entityId: task.id, action: "create", actorUserId: input.actorUserId, summary: `Alta de tarea «${name}»${task.critical ? " (crítica)" : ""}` });
  return task;
}

export async function updateJobTask(
  input: { tenantId: string; actorUserId: string; id: string; name?: string; critical?: boolean },
  db: Db = prisma,
) {
  const current = await db.jobTask.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
  if (!current) throw new MasterDataError("Tarea no encontrada");
  const name = input.name === undefined ? current.name : requireName(input.name);
  if (name !== current.name) await assertNameFree(db, "task", input.tenantId, name, current.id);
  const task = await db.jobTask.update({
    where: { id: current.id },
    data: { name, ...(input.critical !== undefined ? { critical: input.critical } : {}) },
  });
  await audit(db, { tenantId: input.tenantId, entityType: "task", entityId: task.id, action: "update", actorUserId: input.actorUserId, summary: `Edición de tarea «${name}»` });
  return task;
}

/** Personas activas que dependen de una sede, puesto o tarea. */
export async function listCatalogDependents(
  entity: MasterDataEntity,
  tenantId: string,
  id: string,
  db: Db = prisma,
): Promise<string[]> {
  const active = { tenantId, status: "active" as const };
  const where: Prisma.PersonWhereInput =
    entity === "site"
      ? { ...active, OR: [{ siteId: id }, { extraSites: { some: { siteId: id } } }] }
      : entity === "position"
        ? { ...active, positionId: id }
        : { ...active, jobTasks: { some: { jobTaskId: id } } };
  const people = await db.person.findMany({ where, select: { name: true, employeeCode: true }, orderBy: { name: "asc" } });
  return people.map((p) => `${p.name} (${p.employeeCode})`);
}

export async function deactivateCatalogItem(
  input: { entity: MasterDataEntity; tenantId: string; actorUserId: string; id: string },
  db: Db = prisma,
) {
  const { entity, tenantId, id } = input;
  const exists =
    entity === "site"
      ? await db.site.findFirst({ where: { id, tenantId } })
      : entity === "position"
        ? await db.jobPosition.findFirst({ where: { id, tenantId } })
        : await db.jobTask.findFirst({ where: { id, tenantId } });
  if (!exists) throw new MasterDataError(`${MASTER_DATA_ENTITY_LABELS[entity]} no encontrada`);

  const check = canDeactivate(entity, await listCatalogDependents(entity, tenantId, id, db));
  if (!check.allowed) throw new MasterDataError(check.message);

  const data = { active: false, inactiveAt: new Date() };
  if (entity === "site") await db.site.update({ where: { id }, data });
  else if (entity === "position") await db.jobPosition.update({ where: { id }, data });
  else await db.jobTask.update({ where: { id }, data });
  await audit(db, { tenantId, entityType: entity, entityId: id, action: "deactivate", actorUserId: input.actorUserId, summary: `Baja de ${MASTER_DATA_ENTITY_LABELS[entity]} «${exists.name}»` });
}

export async function reactivateCatalogItem(
  input: { entity: MasterDataEntity; tenantId: string; actorUserId: string; id: string },
  db: Db = prisma,
) {
  const { entity, tenantId, id } = input;
  const data = { active: true, inactiveAt: null };
  const where = { id, tenantId };
  const result =
    entity === "site"
      ? await db.site.updateMany({ where, data })
      : entity === "position"
        ? await db.jobPosition.updateMany({ where, data })
        : await db.jobTask.updateMany({ where, data });
  if (result.count === 0) throw new MasterDataError(`${MASTER_DATA_ENTITY_LABELS[entity]} no encontrada`);
  await audit(db, { tenantId, entityType: entity, entityId: id, action: "reactivate", actorUserId: input.actorUserId, summary: `Reactivación de ${MASTER_DATA_ENTITY_LABELS[entity]}` });
}

// ─── Personas ──────────────────────────────────────────────────────────────

export type PersonInput = {
  employeeCode: string;
  name: string;
  documentId?: string | null;
  userId?: string | null;
  employer?: PersonEmployer;
  contractorName?: string | null;
  siteId: string;
  extraSiteIds?: string[];
  positionId: string;
  hiredAt?: Date | null;
  jobTaskIds?: string[];
};

const personInclude = {
  site: true,
  position: true,
  extraSites: { include: { site: true } },
  jobTasks: { include: { jobTask: true } },
} satisfies Prisma.PersonInclude;

async function validatePersonRefs(tenantId: string, input: PersonInput, db: Db | Prisma.TransactionClient) {
  const siteIds = [...new Set([input.siteId, ...(input.extraSiteIds ?? [])])];
  const sites = await db.site.count({ where: { tenantId, active: true, id: { in: siteIds } } });
  if (sites !== siteIds.length) throw new MasterDataError("Alguna sede no existe o está dada de baja");
  const position = await db.jobPosition.count({ where: { tenantId, active: true, id: input.positionId } });
  if (!position) throw new MasterDataError("El puesto no existe o está dado de baja");
  const taskIds = [...new Set(input.jobTaskIds ?? [])];
  if (taskIds.length) {
    const tasks = await db.jobTask.count({ where: { tenantId, active: true, id: { in: taskIds } } });
    if (tasks !== taskIds.length) throw new MasterDataError("Alguna tarea no existe o está dada de baja");
  }
  if (input.userId) {
    const member = await db.membership.count({ where: { tenantId, userId: input.userId } });
    if (!member) throw new MasterDataError("El usuario vinculado no es integrante de la empresa");
  }
  if (!isValidDocumentId(input.documentId)) throw new MasterDataError("El DNI debe tener entre 7 y 9 dígitos");
}

function personData(input: PersonInput) {
  const employer = input.employer ?? "own";
  return {
    employeeCode: cleanName(input.employeeCode),
    name: requireName(input.name),
    documentId: input.documentId ? input.documentId.replace(/[.\s]/g, "") : null,
    userId: input.userId || null,
    employer,
    contractorName: employer === "contractor" ? cleanName(input.contractorName ?? "") || null : null,
    siteId: input.siteId,
    positionId: input.positionId,
    hiredAt: input.hiredAt ?? null,
  };
}

function translateUnique(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = String(error.meta?.target ?? "");
    if (target.includes("userId")) throw new MasterDataError("Ese usuario ya está vinculado a otra persona");
    throw new MasterDataError("Ya existe una persona con ese legajo");
  }
  throw error;
}

export async function createPerson(input: PersonInput & { tenantId: string; actorUserId: string }, db: Db = prisma) {
  if (!cleanName(input.employeeCode)) throw new MasterDataError("El legajo es obligatorio");
  await validatePersonRefs(input.tenantId, input, db);
  const extra = [...new Set(input.extraSiteIds ?? [])].filter((id) => id !== input.siteId);
  try {
    const person = await db.person.create({
      data: {
        ...personData(input),
        tenantId: input.tenantId,
        extraSites: { create: extra.map((siteId) => ({ siteId, tenantId: input.tenantId })) },
        jobTasks: { create: [...new Set(input.jobTaskIds ?? [])].map((jobTaskId) => ({ jobTaskId, tenantId: input.tenantId })) },
      },
      include: personInclude,
    });
    await audit(db, { tenantId: input.tenantId, entityType: "person", entityId: person.id, action: "create", actorUserId: input.actorUserId, summary: `Alta de persona ${person.name} (${person.employeeCode})` });
    return person;
  } catch (error) {
    return translateUnique(error);
  }
}

export async function updatePerson(
  input: PersonInput & { tenantId: string; actorUserId: string; id: string },
  db: Db = prisma,
) {
  const current = await db.person.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
  if (!current) throw new MasterDataError("Persona no encontrada");
  if (!cleanName(input.employeeCode)) throw new MasterDataError("El legajo es obligatorio");
  await validatePersonRefs(input.tenantId, input, db);
  const extra = [...new Set(input.extraSiteIds ?? [])].filter((id) => id !== input.siteId);
  try {
    const person = await db.$transaction(async (tx) => {
      await tx.personSite.deleteMany({ where: { personId: current.id } });
      await tx.personJobTask.deleteMany({ where: { personId: current.id } });
      return tx.person.update({
        where: { id: current.id },
        data: {
          ...personData(input),
          extraSites: { create: extra.map((siteId) => ({ siteId, tenantId: input.tenantId })) },
          jobTasks: { create: [...new Set(input.jobTaskIds ?? [])].map((jobTaskId) => ({ jobTaskId, tenantId: input.tenantId })) },
        },
        include: personInclude,
      });
    });
    await audit(db, { tenantId: input.tenantId, entityType: "person", entityId: person.id, action: "update", actorUserId: input.actorUserId, summary: `Edición de persona ${person.name} (${person.employeeCode})` });
    return person;
  } catch (error) {
    return translateUnique(error);
  }
}

/** Para el responsable de proceso: cambia solo las tareas asignadas. */
export async function setPersonJobTasks(
  input: { tenantId: string; actorUserId: string; personId: string; jobTaskIds: string[] },
  db: Db = prisma,
) {
  const person = await db.person.findFirst({ where: { id: input.personId, tenantId: input.tenantId } });
  if (!person) throw new MasterDataError("Persona no encontrada");
  const taskIds = [...new Set(input.jobTaskIds)];
  const tasks = await db.jobTask.count({ where: { tenantId: input.tenantId, active: true, id: { in: taskIds } } });
  if (tasks !== taskIds.length) throw new MasterDataError("Alguna tarea no existe o está dada de baja");
  await db.$transaction([
    db.personJobTask.deleteMany({ where: { personId: person.id } }),
    db.personJobTask.createMany({ data: taskIds.map((jobTaskId) => ({ personId: person.id, jobTaskId, tenantId: input.tenantId })) }),
  ]);
  await audit(db, { tenantId: input.tenantId, entityType: "person", entityId: person.id, action: "update", actorUserId: input.actorUserId, summary: `Tareas de ${person.name}: ${taskIds.length} asignada(s)` });
}

export async function deactivatePerson(
  input: { tenantId: string; actorUserId: string; id: string; reason?: string },
  db: Db = prisma,
) {
  const person = await db.person.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
  if (!person) throw new MasterDataError("Persona no encontrada");
  await db.person.update({ where: { id: person.id }, data: { status: "inactive", inactiveAt: new Date() } });
  await audit(db, { tenantId: input.tenantId, entityType: "person", entityId: person.id, action: "deactivate", actorUserId: input.actorUserId, summary: `Baja de ${person.name} (${person.employeeCode})${input.reason ? `: ${input.reason}` : ""}` });
}

export async function reactivatePerson(
  input: { tenantId: string; actorUserId: string; id: string },
  db: Db = prisma,
) {
  const person = await db.person.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
  if (!person) throw new MasterDataError("Persona no encontrada");
  await db.person.update({ where: { id: person.id }, data: { status: "active", inactiveAt: null } });
  await audit(db, { tenantId: input.tenantId, entityType: "person", entityId: person.id, action: "reactivate", actorUserId: input.actorUserId, summary: `Reactivación de ${person.name} (${person.employeeCode})` });
}

export type PeopleFilter = {
  status?: "active" | "inactive" | "all";
  siteId?: string;
  positionId?: string;
  q?: string;
  take?: number;
};

function peopleWhere(tenantId: string, f: PeopleFilter): Prisma.PersonWhereInput {
  const q = f.q?.trim();
  return {
    tenantId,
    ...(f.status === "all" ? {} : { status: f.status ?? "active" }),
    ...(f.siteId ? { OR: [{ siteId: f.siteId }, { extraSites: { some: { siteId: f.siteId } } }] } : {}),
    ...(f.positionId ? { positionId: f.positionId } : {}),
    ...(q
      ? { AND: [{ OR: [{ name: { contains: q, mode: "insensitive" } }, { employeeCode: { contains: q, mode: "insensitive" } }] }] }
      : {}),
  };
}

export async function listPeople(tenantId: string, filter: PeopleFilter = {}, db: Db = prisma) {
  return db.person.findMany({
    where: peopleWhere(tenantId, filter),
    include: personInclude,
    orderBy: [{ name: "asc" }],
    ...(filter.take ? { take: filter.take } : {}),
  });
}

export async function getPerson(tenantId: string, id: string, db: Db = prisma) {
  return db.person.findFirst({ where: { id, tenantId }, include: personInclude });
}

/** Búsqueda para `PersonPicker`: solo personas activas, por nombre o legajo, filtrable por sede. */
export async function searchPeople(
  tenantId: string,
  opts: { q?: string; siteId?: string; take?: number },
  db: Db = prisma,
) {
  return db.person.findMany({
    where: peopleWhere(tenantId, { status: "active", q: opts.q, siteId: opts.siteId }),
    select: { id: true, name: true, employeeCode: true, siteId: true, site: { select: { name: true } } },
    orderBy: { name: "asc" },
    take: Math.min(opts.take ?? 20, 50),
  });
}

// ─── Importación de la nómina por CSV ──────────────────────────────────────

async function loadRosterContext(tenantId: string, db: Db | Prisma.TransactionClient) {
  const [people, sites, positions, tasks] = await Promise.all([
    db.person.findMany({ where: { tenantId }, include: personInclude }),
    db.site.findMany({ where: { tenantId } }),
    db.jobPosition.findMany({ where: { tenantId } }),
    db.jobTask.findMany({ where: { tenantId } }),
  ]);
  const snapshots: RosterPersonSnapshot[] = people.map((p) => ({
    employeeCode: p.employeeCode,
    name: p.name,
    documentId: p.documentId,
    employer: p.employer,
    contractorName: p.contractorName,
    siteName: p.site.name,
    extraSiteNames: p.extraSites.map((e) => e.site.name),
    positionName: p.position.name,
    hiredAt: isoFromDate(p.hiredAt),
    taskNames: p.jobTasks.map((t) => t.jobTask.name),
    active: p.status === "active",
  }));
  return { people, sites, positions, tasks, snapshots };
}

export type RosterPreview = {
  plan: RosterPlan;
  /** Errores de formato por fila (esas filas no se importan). */
  errors: RosterRowError[];
  /** Nombres que existen pero están dados de baja: bloquean la importación. */
  inactiveReferenced: string[];
};

export async function previewRosterImport(tenantId: string, csv: string, db: Db = prisma): Promise<RosterPreview> {
  const { rows, errors } = parseRoster(csv);
  const ctx = await loadRosterContext(tenantId, db);
  const plan = planRosterImport(
    ctx.snapshots,
    { site: ctx.sites.map((s) => s.name), position: ctx.positions.map((p) => p.name), task: ctx.tasks.map((t) => t.name) },
    rows,
  );
  const inactive = new Set(
    [...ctx.sites, ...ctx.positions, ...ctx.tasks].filter((c) => !c.active).map((c) => normalizeKey(c.name)),
  );
  const used = plan.items
    .filter((i) => i.action !== "blocked")
    .flatMap((i) => [i.row.siteName, ...i.row.extraSiteNames, i.row.positionName, ...i.row.taskNames]);
  const inactiveReferenced = [...new Set(used.filter((n) => inactive.has(normalizeKey(n))))];
  return { plan, errors, inactiveReferenced };
}

/**
 * Aplica la importación. Vuelve a calcular el plan en el servidor (no confía en la vista previa)
 * y solo crea sedes, puestos o tareas faltantes si `allowCreateCatalog` es true.
 * Las filas con error de formato no se importan; las demás sí.
 */
export async function applyRosterImport(
  input: { tenantId: string; actorUserId: string; csv: string; allowCreateCatalog: boolean },
  db: Db = prisma,
) {
  const preview = await previewRosterImport(input.tenantId, input.csv, db);
  const { plan } = preview;
  if (preview.inactiveReferenced.length > 0) {
    throw new MasterDataError(`Hay sedes, puestos o tareas dados de baja en el archivo: ${preview.inactiveReferenced.join(", ")}`);
  }
  const missing = plan.toCreate.site.length + plan.toCreate.position.length + plan.toCreate.task.length;
  if (missing > 0 && !input.allowCreateCatalog) {
    throw new MasterDataError("El archivo usa sedes, puestos o tareas que no existen: confirmá su creación para importar");
  }

  const { tenantId } = input;
  await db.$transaction(
    async (tx) => {
      await tx.site.createMany({ data: plan.toCreate.site.map((name) => ({ tenantId, name, kind: "office" as const })) });
      await tx.jobPosition.createMany({ data: plan.toCreate.position.map((name) => ({ tenantId, name })) });
      await tx.jobTask.createMany({ data: plan.toCreate.task.map((name) => ({ tenantId, name })) });

      const [sites, positions, tasks, people] = await Promise.all([
        tx.site.findMany({ where: { tenantId } }),
        tx.jobPosition.findMany({ where: { tenantId } }),
        tx.jobTask.findMany({ where: { tenantId } }),
        tx.person.findMany({ where: { tenantId }, select: { id: true, employeeCode: true } }),
      ]);
      const siteId = new Map(sites.map((s) => [normalizeKey(s.name), s.id]));
      const positionId = new Map(positions.map((p) => [normalizeKey(p.name), p.id]));
      const taskId = new Map(tasks.map((t) => [normalizeKey(t.name), t.id]));
      const personId = new Map(people.map((p) => [normalizeKey(p.employeeCode), p.id]));
      const ids = (map: Map<string, string>, names: string[]) => names.map((n) => map.get(normalizeKey(n))!);

      const creates = plan.items.filter((i) => i.action === "create");
      const created = await tx.person.createManyAndReturn({
        data: creates.map(({ row }) => ({
          tenantId,
          employeeCode: row.employeeCode,
          name: row.name,
          documentId: row.documentId,
          employer: row.employer,
          contractorName: row.contractorName,
          siteId: siteId.get(normalizeKey(row.siteName))!,
          positionId: positionId.get(normalizeKey(row.positionName))!,
          hiredAt: row.hiredAt ? dateFromIso(row.hiredAt) : null,
        })),
        select: { id: true, employeeCode: true },
      });
      const createdId = new Map(created.map((p) => [normalizeKey(p.employeeCode), p.id]));

      const relations = (items: typeof creates, idOf: (code: string) => string) => ({
        sites: items.flatMap(({ row }) =>
          ids(siteId, row.extraSiteNames).map((sid) => ({ personId: idOf(row.employeeCode), siteId: sid, tenantId })),
        ),
        tasks: items.flatMap(({ row }) =>
          ids(taskId, row.taskNames).map((tid) => ({ personId: idOf(row.employeeCode), jobTaskId: tid, tenantId })),
        ),
      });
      const newRel = relations(creates, (code) => createdId.get(normalizeKey(code))!);
      await tx.personSite.createMany({ data: newRel.sites });
      await tx.personJobTask.createMany({ data: newRel.tasks });

      const updates = plan.items.filter((i) => i.action === "update");
      for (const { row } of updates) {
        const id = personId.get(normalizeKey(row.employeeCode))!;
        await tx.person.update({
          where: { id },
          data: {
            name: row.name,
            documentId: row.documentId,
            employer: row.employer,
            contractorName: row.contractorName,
            siteId: siteId.get(normalizeKey(row.siteName))!,
            positionId: positionId.get(normalizeKey(row.positionName))!,
            ...(row.hiredAt ? { hiredAt: dateFromIso(row.hiredAt) } : {}),
          },
        });
      }
      const updRel = relations(updates, (code) => personId.get(normalizeKey(code))!);
      const updatedIds = updates.map(({ row }) => personId.get(normalizeKey(row.employeeCode))!);
      await tx.personSite.deleteMany({ where: { personId: { in: updatedIds } } });
      await tx.personJobTask.deleteMany({ where: { personId: { in: updatedIds } } });
      await tx.personSite.createMany({ data: updRel.sites });
      await tx.personJobTask.createMany({ data: updRel.tasks });

      await audit(tx, {
        tenantId,
        entityType: "person",
        entityId: "import",
        action: "import",
        actorUserId: input.actorUserId,
        summary: `Importación de nómina: ${plan.counts.create} nuevas, ${plan.counts.update} actualizadas, ${plan.counts.unchanged} sin cambios, ${plan.counts.blocked} bloqueadas, ${preview.errors.length} con error`,
      });
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  return { counts: plan.counts, created: plan.toCreate, errors: preview.errors };
}

/** Últimos cambios registrados sobre una persona (alta, edición, baja, reactivación). */
export async function listPersonHistory(tenantId: string, personId: string, take = 15, db: Db = prisma) {
  return db.masterDataAudit.findMany({
    where: { tenantId, entityType: "person", entityId: personId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
