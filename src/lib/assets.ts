import { Prisma, type AssetOwnership, type AssetStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensureDefaultTemplates, getTemplateByKey } from "@/lib/inspection-templates";
import {
  InspectionError,
  closeOpenDueItems,
  ownerOfPerson,
  syncOpenDueItem,
  writeAudit,
  dueItemRow,
  type Db,
  type Tx,
} from "@/lib/inspection-support";
import { cleanName, normalizeKey } from "@/domain/masterdata/roster";
import { getAssetType, isAssetTypeKey, type AssetTypeDef } from "@/domain/inspections/asset-types";
import { parseAssetCsv, type AssetCsvIssue, type AssetCsvRow } from "@/domain/inspections/asset-types/csv";
import { normalizeAssetCode, resolveDueDates, type DueInput, type ResolvedDueDate } from "@/domain/inspections/asset-types/resolve";
import { addInterval, assetCompliance, type Interval } from "@/domain/inspections/schedule";
import { addMonths, dateFromIso, endOfDayInstant, isIsoDate, isoFromDate, todayIso } from "@/domain/inspections/dates";

export const ASSETS_PAGE_SIZE = 25;

// ─── Utilidades ────────────────────────────────────────────────────────────

type PlanTemplate = { id: string; intervalUnit: "days" | "months" | null; intervalValue: number | null; leadDays: number };

function intervalOf(t: Pick<PlanTemplate, "intervalUnit" | "intervalValue">): Interval | null {
  return t.intervalUnit && t.intervalValue ? { unit: t.intervalUnit, value: t.intervalValue } : null;
}

function dueKindLabel(type: AssetTypeDef, attributes: Record<string, unknown>, kind: string): string {
  return type.dueKinds(attributes).find((d) => d.kind === kind)?.label ?? kind;
}

const planTitle = (type: AssetTypeDef, code: string) => `Inspección de ${type.label.toLowerCase()} ${code}`;
const dueTitle = (type: AssetTypeDef, attributes: Record<string, unknown>, kind: string, code: string) =>
  `${dueKindLabel(type, attributes, kind)} · ${type.label} ${code}`;

async function requireSite(db: Db | Tx, tenantId: string, siteId: string) {
  const site = await db.site.findFirst({ where: { id: siteId, tenantId, active: true }, select: { id: true } });
  if (!site) throw new InspectionError("La sede no existe o está dada de baja");
}

async function requirePerson(db: Db | Tx, tenantId: string, personId: string | null | undefined) {
  if (!personId) return;
  const person = await db.person.findFirst({ where: { id: personId, tenantId, status: "active" }, select: { id: true } });
  if (!person) throw new InspectionError("La persona asignada no existe o está dada de baja");
}

function parseAttributes(type: AssetTypeDef, raw: unknown): Record<string, unknown> {
  const parsed = type.attributesSchema.safeParse(raw);
  if (!parsed.success) {
    throw new InspectionError(parsed.error.issues.map((i) => i.message).join(" · "), "invalid_attributes", parsed.error.issues);
  }
  return parsed.data;
}

function translateUnique(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new InspectionError("Ya existe un activo con ese código");
  }
  throw error;
}

function ownershipData(ownership: AssetOwnership | undefined, contractorName: string | null | undefined) {
  const o = ownership ?? "own";
  const name = cleanName(contractorName ?? "") || null;
  if (o === "contractor" && !name) throw new InspectionError("Indicá el nombre del contratista");
  return { ownership: o, contractorName: o === "own" ? null : name };
}

// ─── Alta ──────────────────────────────────────────────────────────────────

export type AssetInput = {
  tenantId: string;
  actorUserId: string;
  typeKey: string;
  code: string;
  description: string;
  siteId: string;
  sector?: string | null;
  ownership?: AssetOwnership;
  contractorName?: string | null;
  assignedPersonId?: string | null;
  attributes: unknown;
  dueDates: DueInput[];
};

/** Programa del activo (plantilla periódica) con su vencimiento de calendario. */
async function createPlan(
  tx: Tx,
  input: { tenantId: string; assetId: string; code: string; siteId: string; type: AssetTypeDef; template: PlanTemplate; ownerUserId: string | null; personId: string | null; today: string },
) {
  const interval = intervalOf(input.template);
  const nextDueAt = interval ? addInterval(input.today, interval) : null;
  const plan = await tx.inspectionPlan.create({
    data: {
      tenantId: input.tenantId,
      templateId: input.template.id,
      subjectKey: `asset:${input.assetId}`,
      assetId: input.assetId,
      siteId: input.siteId,
      nextDueAt: nextDueAt ? dateFromIso(nextDueAt) : null,
    },
  });
  if (nextDueAt) {
    await syncOpenDueItem(tx, {
      tenantId: input.tenantId,
      entityType: "inspection_plan",
      entityId: plan.id,
      title: planTitle(input.type, input.code),
      dueAt: endOfDayInstant(nextDueAt),
      leadDays: input.template.leadDays,
      ownerUserId: input.ownerUserId,
      siteId: input.siteId,
      personId: input.personId,
    });
  }
  return plan;
}

export async function createAsset(input: AssetInput, db: Db = prisma) {
  if (!isAssetTypeKey(input.typeKey)) throw new InspectionError("Tipo de activo desconocido");
  const type = getAssetType(input.typeKey);
  const code = normalizeAssetCode(input.code);
  if (!code.ok) throw new InspectionError(code.message);
  const description = cleanName(input.description);
  if (description.length < 2) throw new InspectionError("La descripción debe tener al menos 2 caracteres");
  const attributes = parseAttributes(type, input.attributes);
  const resolved = resolveDueDates(type, attributes, input.dueDates);
  if (resolved.issues.length > 0) throw new InspectionError(resolved.issues.map((i) => i.message).join(" · "), "invalid_due_dates", resolved.issues);
  const own = ownershipData(input.ownership, input.contractorName);

  await requireSite(db, input.tenantId, input.siteId);
  await requirePerson(db, input.tenantId, input.assignedPersonId);
  await ensureDefaultTemplates(input.tenantId, db);
  const template = await getTemplateByKey(input.tenantId, type.periodicTemplateKey, db);
  if (!template) throw new InspectionError("No se encontró la plantilla de inspección del tipo");
  const ownerUserId = await ownerOfPerson(db, input.tenantId, input.assignedPersonId ?? null);
  const today = todayIso();

  try {
    return await db.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          tenantId: input.tenantId,
          typeKey: type.key,
          code: code.code,
          description,
          siteId: input.siteId,
          sector: cleanName(input.sector ?? "") || null,
          ...own,
          assignedPersonId: input.assignedPersonId || null,
          attributes: attributes as Prisma.InputJsonValue,
          attributesVersion: type.schemaVersion,
          createdByUserId: input.actorUserId,
        },
      });
      const dueRows = await tx.assetDueDate.createManyAndReturn({
        data: resolved.dueDates.map((d) => ({
          tenantId: input.tenantId,
          assetId: asset.id,
          kind: d.kind,
          dueAt: dateFromIso(d.dueAt),
          lastDoneAt: d.lastDoneAt ? dateFromIso(d.lastDoneAt) : null,
          reference: d.reference,
          leadDays: d.leadDays,
          blocking: d.blocking,
        })),
      });
      await tx.dueItem.createMany({
        data: dueRows.map((row) =>
          dueItemRow({
            tenantId: input.tenantId,
            entityType: "asset_due_date",
            entityId: row.id,
            title: dueTitle(type, attributes, row.kind, asset.code),
            dueAt: endOfDayInstant(isoFromDate(row.dueAt)),
            leadDays: row.leadDays,
            ownerUserId,
            siteId: asset.siteId,
            personId: asset.assignedPersonId,
          }),
        ),
      });
      await createPlan(tx, { tenantId: input.tenantId, assetId: asset.id, code: asset.code, siteId: asset.siteId, type, template, ownerUserId, personId: asset.assignedPersonId, today });
      await tx.assetStatusEvent.create({
        data: { tenantId: input.tenantId, assetId: asset.id, fromStatus: null, toStatus: "in_service", reasonCode: "created", byUserId: input.actorUserId },
      });
      await writeAudit(tx, { tenantId: input.tenantId, entityType: "asset", entityId: asset.id, action: "create", actorUserId: input.actorUserId, summary: `Alta de ${type.label.toLowerCase()} ${asset.code}` });
      return asset;
    });
  } catch (error) {
    return translateUnique(error);
  }
}

// ─── Edición, baja y renovación ────────────────────────────────────────────

export async function updateAsset(
  input: {
    tenantId: string;
    actorUserId: string;
    assetId: string;
    description: string;
    siteId: string;
    sector?: string | null;
    ownership?: AssetOwnership;
    contractorName?: string | null;
    assignedPersonId?: string | null;
    attributes: unknown;
  },
  db: Db = prisma,
) {
  const current = await db.asset.findFirst({ where: { id: input.assetId, tenantId: input.tenantId } });
  if (!current) throw new InspectionError("Activo no encontrado");
  if (current.status === "retired") throw new InspectionError("El activo está dado de baja: no se puede editar");
  const type = getAssetType(current.typeKey);
  const description = cleanName(input.description);
  if (description.length < 2) throw new InspectionError("La descripción debe tener al menos 2 caracteres");
  const attributes = parseAttributes(type, input.attributes);
  const own = ownershipData(input.ownership ?? current.ownership, input.contractorName ?? current.contractorName);
  if (input.siteId !== current.siteId) await requireSite(db, input.tenantId, input.siteId);
  const assignedPersonId = input.assignedPersonId || null;
  if (assignedPersonId !== current.assignedPersonId) await requirePerson(db, input.tenantId, assignedPersonId);
  const ownerUserId = await ownerOfPerson(db, input.tenantId, assignedPersonId);

  return db.$transaction(async (tx) => {
    const asset = await tx.asset.update({
      where: { id: current.id },
      data: {
        description,
        siteId: input.siteId,
        sector: cleanName(input.sector ?? "") || null,
        ...own,
        assignedPersonId,
        attributes: attributes as Prisma.InputJsonValue,
        attributesVersion: type.schemaVersion,
      },
    });
    if (asset.siteId !== current.siteId || asset.assignedPersonId !== current.assignedPersonId) {
      await refreshAssetDueItems(tx, asset, type, attributes, ownerUserId);
    }
    await writeAudit(tx, { tenantId: input.tenantId, entityType: "asset", entityId: asset.id, action: "update", actorUserId: input.actorUserId, summary: `Edición de ${type.label.toLowerCase()} ${asset.code}` });
    return asset;
  });
}

/** Si cambia la sede o la persona, los avisos abiertos del activo pasan a llegarle a quien corresponde. */
async function refreshAssetDueItems(
  tx: Tx,
  asset: { id: string; tenantId: string; code: string; siteId: string; assignedPersonId: string | null },
  type: AssetTypeDef,
  attributes: Record<string, unknown>,
  ownerUserId: string | null,
) {
  await tx.inspectionPlan.updateMany({ where: { assetId: asset.id }, data: { siteId: asset.siteId } });
  const plans = await tx.inspectionPlan.findMany({ where: { assetId: asset.id, active: true, nextDueAt: { not: null } }, include: { template: { select: { leadDays: true } } } });
  for (const plan of plans) {
    await syncOpenDueItem(tx, {
      tenantId: asset.tenantId,
      entityType: "inspection_plan",
      entityId: plan.id,
      title: planTitle(type, asset.code),
      dueAt: endOfDayInstant(isoFromDate(plan.nextDueAt!)),
      leadDays: plan.template.leadDays,
      ownerUserId,
      siteId: asset.siteId,
      personId: asset.assignedPersonId,
    });
  }
  const dueDates = await tx.assetDueDate.findMany({ where: { assetId: asset.id } });
  for (const d of dueDates) {
    await syncOpenDueItem(tx, {
      tenantId: asset.tenantId,
      entityType: "asset_due_date",
      entityId: d.id,
      title: dueTitle(type, attributes, d.kind, asset.code),
      dueAt: endOfDayInstant(isoFromDate(d.dueAt)),
      leadDays: d.leadDays,
      ownerUserId,
      siteId: asset.siteId,
      personId: asset.assignedPersonId,
    });
  }
}

/** Baja del activo: no se borra (conserva su historial). Cierra sus avisos y su programa. */
export async function retireAsset(input: { tenantId: string; actorUserId: string; assetId: string; reason: string }, db: Db = prisma) {
  const reason = cleanName(input.reason);
  if (reason.length < 5) throw new InspectionError("Contá el motivo de la baja (al menos 5 caracteres)");
  const current = await db.asset.findFirst({ where: { id: input.assetId, tenantId: input.tenantId } });
  if (!current) throw new InspectionError("Activo no encontrado");
  if (current.status === "retired") throw new InspectionError("El activo ya está dado de baja");
  return db.$transaction(async (tx) => {
    const now = new Date();
    const result = await tx.asset.updateMany({
      where: { id: current.id, tenantId: input.tenantId, status: { not: "retired" } },
      data: { status: "retired", statusReason: reason, statusChangedAt: now, retiredAt: now, retirementReason: reason },
    });
    if (result.count === 0) return current; // otra solicitud ya lo dio de baja
    await tx.assetStatusEvent.create({
      data: { tenantId: input.tenantId, assetId: current.id, fromStatus: current.status, toStatus: "retired", reasonCode: "retired_manual", byUserId: input.actorUserId, note: reason },
    });
    const plans = await tx.inspectionPlan.findMany({ where: { assetId: current.id }, select: { id: true } });
    await tx.inspectionPlan.updateMany({ where: { assetId: current.id }, data: { active: false, nextDueAt: null } });
    await closeOpenDueItems(tx, input.tenantId, "inspection_plan", plans.map((p) => p.id));
    const dueDates = await tx.assetDueDate.findMany({ where: { assetId: current.id }, select: { id: true } });
    await closeOpenDueItems(tx, input.tenantId, "asset_due_date", dueDates.map((d) => d.id));
    await writeAudit(tx, { tenantId: input.tenantId, entityType: "asset", entityId: current.id, action: "retire", actorUserId: input.actorUserId, summary: `Baja de ${current.code}: ${reason}` });
    return tx.asset.findUniqueOrThrow({ where: { id: current.id } });
  });
}

/**
 * Renueva (o registra por primera vez) un vencimiento del activo. Reemplaza el aviso abierto
 * en vez de sumar otro, aun si se renueva dos veces a la vez.
 */
export async function renewAssetDueDate(
  input: { tenantId: string; actorUserId: string; assetId: string; kind: string; dueAt?: string | null; lastDoneAt?: string | null; reference?: string | null },
  db: Db = prisma,
) {
  const asset = await db.asset.findFirst({ where: { id: input.assetId, tenantId: input.tenantId } });
  if (!asset) throw new InspectionError("Activo no encontrado");
  if (asset.status === "retired") throw new InspectionError("El activo está dado de baja");
  const type = getAssetType(asset.typeKey);
  const attributes = asset.attributes as Record<string, unknown>;
  const spec = type.dueKinds(attributes).find((d) => d.kind === input.kind);
  if (!spec) throw new InspectionError("Ese vencimiento no corresponde a este activo");
  const last = input.lastDoneAt?.trim() || null;
  let due = input.dueAt?.trim() || null;
  if ((last && !isIsoDate(last)) || (due && !isIsoDate(due))) throw new InspectionError("Fecha inválida");
  if (!due && last) due = addMonths(last, spec.intervalMonths);
  if (!due) throw new InspectionError("Indicá la fecha de la renovación o el nuevo vencimiento");
  const reference = cleanName(input.reference ?? "") || null;
  const ownerUserId = await ownerOfPerson(db, input.tenantId, asset.assignedPersonId);

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM asset WHERE id = ${asset.id} FOR UPDATE`;
    const row = await tx.assetDueDate.upsert({
      where: { assetId_kind: { assetId: asset.id, kind: spec.kind } },
      create: {
        tenantId: input.tenantId,
        assetId: asset.id,
        kind: spec.kind,
        dueAt: dateFromIso(due),
        lastDoneAt: last ? dateFromIso(last) : null,
        reference,
        leadDays: spec.leadDays,
        blocking: spec.blocking,
      },
      update: { dueAt: dateFromIso(due), lastDoneAt: last ? dateFromIso(last) : null, reference },
    });
    await syncOpenDueItem(tx, {
      tenantId: input.tenantId,
      entityType: "asset_due_date",
      entityId: row.id,
      title: dueTitle(type, attributes, spec.kind, asset.code),
      dueAt: endOfDayInstant(due),
      leadDays: row.leadDays,
      ownerUserId,
      siteId: asset.siteId,
      personId: asset.assignedPersonId,
    });
    await writeAudit(tx, { tenantId: input.tenantId, entityType: "asset", entityId: asset.id, action: "renew", actorUserId: input.actorUserId, summary: `${spec.label} de ${asset.code} renovado: vence el ${due}` });
    return row;
  });
}

// ─── Consultas ─────────────────────────────────────────────────────────────

export type AssetFilter = {
  q?: string;
  typeKey?: string;
  siteId?: string;
  status?: AssetStatus | "all";
  /** Último código de la página anterior. */
  after?: string;
  take?: number;
};

function assetWhere(tenantId: string, f: AssetFilter): Prisma.AssetWhereInput {
  const q = f.q?.trim();
  return {
    tenantId,
    ...(f.typeKey ? { typeKey: f.typeKey } : {}),
    ...(f.siteId ? { siteId: f.siteId } : {}),
    ...(f.status && f.status !== "all" ? { status: f.status } : {}),
    ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}),
  };
}

/** Página de activos por cursor (código). Constante en consultas: activos, sedes, vencimientos y programas por `IN`. */
export async function listAssets(tenantId: string, filter: AssetFilter = {}, db: Db = prisma) {
  const take = Math.min(filter.take ?? ASSETS_PAGE_SIZE, 100);
  const where = assetWhere(tenantId, filter);
  const [rows, total] = await Promise.all([
    db.asset.findMany({
      where: { ...where, ...(filter.after ? { code: { gt: filter.after } } : {}) },
      orderBy: { code: "asc" },
      take: take + 1,
      include: {
        site: { select: { name: true } },
        dueDates: { select: { kind: true, dueAt: true, leadDays: true, blocking: true } },
        plans: { select: { nextDueAt: true, lastInspectedAt: true, lastResult: true, active: true } },
      },
    }),
    db.asset.count({ where }),
  ]);
  const today = todayIso();
  const page = rows.slice(0, take);
  return {
    total,
    nextCursor: rows.length > take ? page[page.length - 1].code : null,
    items: page.map((a) => ({
      ...a,
      compliance: a.status === "retired" ? ("ok" as const) : assetCompliance(a.dueDates.map((d) => ({ dueAt: isoFromDate(d.dueAt), leadDays: d.leadDays, blocking: d.blocking })), today),
    })),
  };
}

export async function getAsset(tenantId: string, assetId: string, db: Db = prisma) {
  const asset = await db.asset.findFirst({
    where: { id: assetId, tenantId },
    include: {
      site: { select: { id: true, name: true } },
      assignedPerson: { select: { id: true, name: true, employeeCode: true } },
      dueDates: { orderBy: { dueAt: "asc" } },
      plans: { include: { template: { select: { key: true, name: true, intervalUnit: true, intervalValue: true } } } },
      statusEvents: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!asset) return null;
  const today = todayIso();
  return {
    ...asset,
    compliance: asset.status === "retired" ? ("ok" as const) : assetCompliance(asset.dueDates.map((d) => ({ dueAt: isoFromDate(d.dueAt), leadDays: d.leadDays, blocking: d.blocking })), today),
  };
}

/** Búsqueda por código o descripción para elegir qué inspeccionar. Excluye los dados de baja. */
export async function searchAssets(tenantId: string, opts: { q?: string; siteId?: string; take?: number }, db: Db = prisma) {
  return db.asset.findMany({
    where: { ...assetWhere(tenantId, { q: opts.q, siteId: opts.siteId }), status: { not: "retired" } },
    select: { id: true, code: true, description: true, typeKey: true, status: true, site: { select: { name: true } } },
    orderBy: { code: "asc" },
    take: Math.min(opts.take ?? 20, 50),
  });
}

// ─── Importación por CSV ───────────────────────────────────────────────────

export type AssetImportAction = "create" | "update" | "unchanged" | "error";

export type AssetImportItem = {
  line: number;
  code: string;
  description: string;
  action: AssetImportAction;
  /** Qué cambia (solo en actualizaciones). */
  changes: string[];
  reason?: string;
};

export type AssetImportPreview = {
  items: AssetImportItem[];
  counts: Record<AssetImportAction, number>;
  /** Errores de formato por fila (esas filas no se importan). */
  errors: AssetCsvIssue[];
  rows: AssetCsvRow[];
};

type ExistingAsset = Prisma.AssetGetPayload<{ include: { dueDates: true } }>;

function diffAsset(existing: ExistingAsset, row: AssetCsvRow, siteId: string, personId: string | null): string[] {
  const changes: string[] = [];
  if (existing.description !== row.description) changes.push("descripción");
  if (existing.siteId !== siteId) changes.push("sede");
  if ((existing.sector ?? null) !== row.sector) changes.push("sector");
  if (existing.ownership !== row.ownership || (existing.contractorName ?? null) !== row.contractorName) changes.push("propiedad");
  if ((existing.assignedPersonId ?? null) !== personId) changes.push("persona asignada");
  const a = existing.attributes as Record<string, unknown>;
  const same = Object.keys(row.attributes).every((k) => JSON.stringify(a[k] ?? null) === JSON.stringify(row.attributes[k] ?? null));
  if (!same) changes.push("atributos");
  for (const d of row.dueDates) {
    const cur = existing.dueDates.find((x) => x.kind === d.kind);
    if (!cur || isoFromDate(cur.dueAt) !== d.dueAt) changes.push(d.label.toLowerCase());
  }
  return changes;
}

export async function previewAssetImport(tenantId: string, typeKey: string, csv: string, db: Db = prisma): Promise<AssetImportPreview> {
  if (!isAssetTypeKey(typeKey)) throw new InspectionError("Tipo de activo desconocido");
  const type = getAssetType(typeKey);
  const { rows, errors } = parseAssetCsv(type, csv);
  const counts: Record<AssetImportAction, number> = { create: 0, update: 0, unchanged: 0, error: 0 };
  if (rows.length === 0) return { items: [], counts, errors, rows };

  const [sites, existing, people] = await Promise.all([
    db.site.findMany({ where: { tenantId }, select: { id: true, name: true, active: true } }),
    db.asset.findMany({ where: { tenantId, code: { in: rows.map((r) => r.code) } }, include: { dueDates: true } }),
    db.person.findMany({
      where: { tenantId, employeeCode: { in: rows.flatMap((r) => (r.assignedPersonCode ? [r.assignedPersonCode] : [])) } },
      select: { id: true, employeeCode: true, status: true },
    }),
  ]);
  const siteByName = new Map(sites.map((s) => [normalizeKey(s.name), s]));
  const existingByCode = new Map(existing.map((a) => [a.code, a]));
  const personByCode = new Map(people.map((p) => [normalizeKey(p.employeeCode), p]));

  const items: AssetImportItem[] = rows.map((row) => {
    const base = { line: row.line, code: row.code, description: row.description, changes: [] as string[] };
    const fail = (reason: string): AssetImportItem => ({ ...base, action: "error", reason });
    const site = siteByName.get(normalizeKey(row.siteName));
    if (!site) return fail(`La sede «${row.siteName}» no existe: creala antes en Datos maestros`);
    if (!site.active) return fail(`La sede «${row.siteName}» está dada de baja`);
    let personId: string | null = null;
    if (row.assignedPersonCode) {
      const person = personByCode.get(normalizeKey(row.assignedPersonCode));
      if (!person || person.status !== "active") return fail(`No hay una persona activa con legajo ${row.assignedPersonCode}`);
      personId = person.id;
    }
    const current = existingByCode.get(row.code);
    if (!current) return { ...base, action: "create" };
    if (current.typeKey !== typeKey) return fail("Ese código ya lo usa un activo de otro tipo");
    if (current.status === "retired") return fail("Ese activo está dado de baja");
    const changes = diffAsset(current, row, site.id, personId);
    return changes.length > 0 ? { ...base, action: "update", changes } : { ...base, action: "unchanged" };
  });
  for (const item of items) counts[item.action]++;
  return { items, counts, errors, rows };
}

/**
 * Aplica la importación. Vuelve a calcular el plan en el servidor (no confía en la vista previa).
 * Las filas con error no se importan; las demás sí. No crea sedes: la sede tiene que existir.
 */
export async function applyAssetImport(input: { tenantId: string; actorUserId: string; typeKey: string; csv: string }, db: Db = prisma) {
  const { tenantId } = input;
  const preview = await previewAssetImport(tenantId, input.typeKey, input.csv, db);
  const type = getAssetType(input.typeKey);
  const actionable = preview.items.filter((i) => i.action === "create" || i.action === "update");
  if (actionable.length === 0) return { counts: preview.counts, errors: preview.errors.length };

  await ensureDefaultTemplates(tenantId, db);
  const template = await getTemplateByKey(tenantId, type.periodicTemplateKey, db);
  if (!template) throw new InspectionError("No se encontró la plantilla de inspección del tipo");
  const today = todayIso();
  const rowByLine = new Map(preview.rows.map((r) => [r.line, r]));
  const [sites, people] = await Promise.all([
    db.site.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    db.person.findMany({ where: { tenantId }, select: { id: true, employeeCode: true, userId: true } }),
  ]);
  const siteId = new Map(sites.map((s) => [normalizeKey(s.name), s.id]));
  const personByCode = new Map(people.map((p) => [normalizeKey(p.employeeCode), p]));
  const interval = intervalOf(template);
  const nextDueAt = interval ? addInterval(today, interval) : null;

  await db.$transaction(
    async (tx) => {
      const creates = actionable.filter((i) => i.action === "create").map((i) => rowByLine.get(i.line)!);
      const ctx = (row: AssetCsvRow) => {
        const person = row.assignedPersonCode ? personByCode.get(normalizeKey(row.assignedPersonCode)) : undefined;
        return { siteId: siteId.get(normalizeKey(row.siteName))!, personId: person?.id ?? null, ownerUserId: person?.userId ?? null };
      };

      if (creates.length > 0) {
        const created = await tx.asset.createManyAndReturn({
          data: creates.map((row) => ({
            tenantId,
            typeKey: type.key,
            code: row.code,
            description: row.description,
            siteId: ctx(row).siteId,
            sector: row.sector,
            ownership: row.ownership,
            contractorName: row.contractorName,
            assignedPersonId: ctx(row).personId,
            attributes: row.attributes as Prisma.InputJsonValue,
            attributesVersion: type.schemaVersion,
            createdByUserId: input.actorUserId,
          })),
        });
        const rowOf = new Map(creates.map((r) => [r.code, r]));
        const dueRows = await tx.assetDueDate.createManyAndReturn({
          data: created.flatMap((a) =>
            rowOf.get(a.code)!.dueDates.map((d) => ({
              tenantId,
              assetId: a.id,
              kind: d.kind,
              dueAt: dateFromIso(d.dueAt),
              lastDoneAt: d.lastDoneAt ? dateFromIso(d.lastDoneAt) : null,
              reference: d.reference,
              leadDays: d.leadDays,
              blocking: d.blocking,
            })),
          ),
        });
        const assetById = new Map(created.map((a) => [a.id, a]));
        await tx.dueItem.createMany({
          data: dueRows.map((d) => {
            const a = assetById.get(d.assetId)!;
            const c = ctx(rowOf.get(a.code)!);
            return dueItemRow({
              tenantId,
              entityType: "asset_due_date",
              entityId: d.id,
              title: dueTitle(type, a.attributes as Record<string, unknown>, d.kind, a.code),
              dueAt: endOfDayInstant(isoFromDate(d.dueAt)),
              leadDays: d.leadDays,
              ownerUserId: c.ownerUserId,
              siteId: c.siteId,
              personId: c.personId,
            });
          }),
        });
        const plans = await tx.inspectionPlan.createManyAndReturn({
          data: created.map((a) => ({
            tenantId,
            templateId: template.id,
            subjectKey: `asset:${a.id}`,
            assetId: a.id,
            siteId: a.siteId,
            nextDueAt: nextDueAt ? dateFromIso(nextDueAt) : null,
          })),
        });
        if (nextDueAt) {
          await tx.dueItem.createMany({
            data: plans.map((p) => {
              const a = assetById.get(p.assetId!)!;
              const c = ctx(rowOf.get(a.code)!);
              return dueItemRow({
                tenantId,
                entityType: "inspection_plan",
                entityId: p.id,
                title: planTitle(type, a.code),
                dueAt: endOfDayInstant(nextDueAt),
                leadDays: template.leadDays,
                ownerUserId: c.ownerUserId,
                siteId: c.siteId,
                personId: c.personId,
              });
            }),
          });
        }
        await tx.assetStatusEvent.createMany({
          data: created.map((a) => ({ tenantId, assetId: a.id, fromStatus: null, toStatus: "in_service" as const, reasonCode: "created", byUserId: input.actorUserId })),
        });
      }

      for (const item of actionable.filter((i) => i.action === "update")) {
        const row = rowByLine.get(item.line)!;
        const current = await tx.asset.findFirstOrThrow({ where: { tenantId, code: row.code } });
        const c = ctx(row);
        const asset = await tx.asset.update({
          where: { id: current.id },
          data: {
            description: row.description,
            siteId: c.siteId,
            sector: row.sector,
            ownership: row.ownership,
            contractorName: row.contractorName,
            assignedPersonId: c.personId,
            attributes: row.attributes as Prisma.InputJsonValue,
            attributesVersion: type.schemaVersion,
          },
        });
        for (const d of row.dueDates) await upsertDueDateTx(tx, asset, d);
        const labels = new Set(row.dueDates.map((d) => d.label.toLowerCase()));
        // Solo se reprograman los avisos si cambió algo que los afecta (así no se reinician los ya enviados).
        if (item.changes.some((ch) => ch === "sede" || ch === "persona asignada" || labels.has(ch))) {
          await refreshAssetDueItems(tx, asset, type, row.attributes, c.ownerUserId);
        }
      }

      await writeAudit(tx, {
        tenantId,
        entityType: "asset",
        entityId: "import",
        action: "import",
        actorUserId: input.actorUserId,
        summary: `Importación de ${type.plural.toLowerCase()}: ${preview.counts.create} nuevos, ${preview.counts.update} actualizados, ${preview.counts.unchanged} sin cambios, ${preview.counts.error + preview.errors.length} con error`,
      });
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  return { counts: preview.counts, errors: preview.errors.length };
}

async function upsertDueDateTx(
  tx: Tx,
  asset: { id: string; tenantId: string },
  d: ResolvedDueDate,
) {
  const data = { dueAt: dateFromIso(d.dueAt), lastDoneAt: d.lastDoneAt ? dateFromIso(d.lastDoneAt) : null, reference: d.reference };
  await tx.assetDueDate.upsert({
    where: { assetId_kind: { assetId: asset.id, kind: d.kind } },
    create: { tenantId: asset.tenantId, assetId: asset.id, kind: d.kind, leadDays: d.leadDays, blocking: d.blocking, ...data },
    update: data,
  });
}
