/**
 * Exposición mensual por sede y grupo (SPEC-accident-stats.md, slice 17.3): carga de horas trabajadas y
 * dotación, importación por CSV con vista previa, correcciones con motivo (`ExposureRevision`) y un aviso
 * (`DueItem`) por sede y mes hasta que se cargan los dos grupos.
 * Todo está acotado por `tenantId`; cada carga o corrección deja registro en `MasterDataAudit`.
 */
import type { PersonEmployer, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { reminderStartsAt } from "@/domain/automation/due";
import { closeDueItemsForEntity, createDueItem } from "@/lib/automation";
import { SafetyStatsError, getSafetySettings, type SafetyUser } from "@/lib/safety-stats";
import { canManageHealthData } from "@/domain/safety-stats/access";
import {
  EXPOSURE_IMPORT_MAX_ROWS,
  exposureDueDay,
  exposureMonthsToTrack,
  monthLabel,
  parseExposureCsv,
  planExposureImport,
  type ExposureImportPlan,
  type ExposureImportRowError,
} from "@/domain/safety-stats/exposure-import";
import { localDay } from "@/domain/safety-stats/period";
import { EMPLOYER_KINDS, type EmployerKind, type IsoDay, type MonthKey } from "@/domain/safety-stats/types";
import { validateExposure } from "@/domain/safety-stats/validation";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export const EXPOSURE_DUE_ENTITY_TYPE = "exposure_period";
const EXPOSURE_LEAD_DAYS = 5;
const MIN_REASON = 10;
const IMPORT_BATCH = 500;
/** Tope de sedes por grilla: una empresa con más sedes carga por importación. */
export const EXPOSURE_GRID_MAX_SITES = 200;

const monthDate = (month: MonthKey) => new Date(`${month}-01T00:00:00.000Z`);
const dayDate = (day: IsoDay) => new Date(`${day}T00:00:00.000Z`);
const monthOfDate = (d: Date): MonthKey => d.toISOString().slice(0, 7);

function requireManager(actor: SafetyUser) {
  if (!canManageHealthData(actor)) throw new SafetyStatsError("Tu rol no permite cargar la exposición");
}

function assertMonth(month: string, today: IsoDay): MonthKey {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new SafetyStatsError("Mes inválido");
  if (month > today.slice(0, 7)) throw new SafetyStatsError("No se puede cargar la exposición de un mes futuro");
  return month;
}

function checkReason(reason: string | null | undefined): string {
  const text = (reason ?? "").trim();
  if (text.length < MIN_REASON) throw new SafetyStatsError(`Contá el motivo de la corrección (al menos ${MIN_REASON} caracteres)`);
  return text;
}

async function audit(db: Db | Tx, input: { tenantId: string; entityId: string; action: "create" | "update"; actorUserId: string; summary: string }) {
  await db.masterDataAudit.create({
    data: { tenantId: input.tenantId, entityType: "exposure", entityId: input.entityId, action: input.action, actorUserId: input.actorUserId, summary: input.summary },
  });
}

// ─── Grilla del mes ────────────────────────────────────────────────────────

export type ExposureCell = { hours: number; headcountAvg: number };
export type ExposureGridRow = { siteId: string; siteName: string; own: ExposureCell | null; contractor: ExposureCell | null };

/** Sedes activas × (propio, contratista) del mes, con lo ya cargado. Acotado a `EXPOSURE_GRID_MAX_SITES`. */
export async function getExposureGrid(tenantId: string, month: MonthKey, db: Db = prisma): Promise<ExposureGridRow[]> {
  const sites = await db.site.findMany({
    where: { tenantId, active: true },
    orderBy: { name: "asc" },
    take: EXPOSURE_GRID_MAX_SITES,
    select: { id: true, name: true },
  });
  const rows = await db.exposurePeriod.findMany({
    where: { tenantId, periodMonth: monthDate(month), siteId: { in: sites.map((s) => s.id) } },
    select: { siteId: true, employerKind: true, hours: true, headcountAvg: true },
  });
  const by = new Map(rows.map((r) => [`${r.siteId}|${r.employerKind}`, { hours: r.hours, headcountAvg: Number(r.headcountAvg) }]));
  return sites.map((s) => ({
    siteId: s.id,
    siteName: s.name,
    own: by.get(`${s.id}|own`) ?? null,
    contractor: by.get(`${s.id}|contractor`) ?? null,
  }));
}

/** Meses con exposición cargada o pendiente de revisar, para el selector (el actual y los 11 anteriores). */
export function exposureMonthOptions(today: IsoDay, count = 12): MonthKey[] {
  const out: MonthKey[] = [];
  let [y, m] = today.slice(0, 7).split("-").map(Number);
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) [y, m] = [y - 1, 12];
  }
  return out;
}

// ─── Guardar un mes de una sede ────────────────────────────────────────────

export type ExposureCellInput = ExposureCell;

export type SaveExposureInput = {
  tenantId: string;
  actor: SafetyUser;
  siteId: string;
  month: MonthKey;
  /** `undefined` = no se toca ese grupo. */
  own?: ExposureCellInput;
  contractor?: ExposureCellInput;
  /** Obligatorio si cambia un valor ya cargado de un mes que terminó. */
  reason?: string | null;
  today?: IsoDay;
};

/**
 * Guarda las horas y la dotación de una sede en un mes, para uno o los dos grupos. Un valor ya cargado que
 * cambia deja una `ExposureRevision` con los valores anteriores y el motivo (obligatorio si el mes ya terminó).
 */
export async function saveExposure(input: SaveExposureInput, db: Db = prisma): Promise<{ created: number; updated: number; warnings: string[] }> {
  requireManager(input.actor);
  const today = input.today ?? localDay(new Date());
  const month = assertMonth(input.month, today);
  const cells = (
    [
      ["own", input.own],
      ["contractor", input.contractor],
    ] as [EmployerKind, ExposureCellInput | undefined][]
  ).filter((c): c is [EmployerKind, ExposureCellInput] => c[1] !== undefined);
  if (cells.length === 0) throw new SafetyStatsError("No hay nada para guardar");

  const warnings: string[] = [];
  for (const [kind, cell] of cells) {
    const check = validateExposure(cell);
    const [message] = Object.values(check.errors);
    if (message) throw new SafetyStatsError(`${kind === "own" ? "Personal propio" : "Contratistas"}: ${message}`, check.errors);
    warnings.push(...check.warnings.map((w) => `${kind === "own" ? "Personal propio" : "Contratistas"}: ${w}`));
  }

  const site = await db.site.findFirst({ where: { id: input.siteId, tenantId: input.tenantId, active: true }, select: { id: true, name: true } });
  if (!site) throw new SafetyStatsError("La sede no existe o está dada de baja");

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.exposurePeriod.findMany({
      where: { tenantId: input.tenantId, siteId: site.id, periodMonth: monthDate(month) },
      select: { id: true, employerKind: true, hours: true, headcountAvg: true },
    });
    const byKind = new Map(existing.map((e) => [e.employerKind as EmployerKind, e]));
    const changes = cells.filter(([kind, cell]) => {
      const e = byKind.get(kind);
      return !e || e.hours !== cell.hours || Number(e.headcountAvg) !== cell.headcountAvg;
    });
    const correcting = changes.filter(([kind]) => byKind.has(kind));
    const monthEnded = month < today.slice(0, 7);
    const reason = correcting.length > 0 ? (monthEnded ? checkReason(input.reason) : (input.reason ?? "").trim() || "Ajuste dentro del mes") : null;

    let created = 0;
    let updated = 0;
    for (const [kind, cell] of changes) {
      const prev = byKind.get(kind);
      if (!prev) {
        await tx.exposurePeriod.create({
          data: {
            tenantId: input.tenantId,
            siteId: site.id,
            periodMonth: monthDate(month),
            employerKind: kind as PersonEmployer,
            hours: cell.hours,
            headcountAvg: cell.headcountAvg,
            recordedByUserId: input.actor.userId,
          },
        });
        created++;
      } else {
        await tx.exposurePeriod.update({ where: { id: prev.id }, data: { hours: cell.hours, headcountAvg: cell.headcountAvg, recordedByUserId: input.actor.userId } });
        await tx.exposureRevision.create({
          data: {
            tenantId: input.tenantId,
            exposurePeriodId: prev.id,
            previousHours: prev.hours,
            previousHeadcountAvg: prev.headcountAvg,
            newHours: cell.hours,
            newHeadcountAvg: cell.headcountAvg,
            reason: reason!,
            actorUserId: input.actor.userId,
          },
        });
        updated++;
      }
    }
    if (created + updated > 0) {
      await audit(tx, {
        tenantId: input.tenantId,
        entityId: site.id,
        action: updated > 0 ? "update" : "create",
        actorUserId: input.actor.userId,
        summary: `Exposición de ${monthLabel(month)}: ${created} carga(s) y ${updated} corrección(es)`,
      });
    }
    return { created, updated };
  });

  await syncExposureDueItems(input.tenantId, { siteIds: [site.id], months: [month], today }, db);
  return { ...result, warnings };
}

// ─── Importación por CSV ───────────────────────────────────────────────────

export type ExposureImportPreview = { plan: ExposureImportPlan; parseErrors: ExposureImportRowError[]; needsReason: boolean };

async function buildImportPlan(tenantId: string, csv: string, today: IsoDay, db: Db) {
  const { rows, errors } = parseExposureCsv(csv, { currentMonth: today.slice(0, 7) });
  const months = [...new Set(rows.map((r) => r.month))];
  const sites = await db.site.findMany({ where: { tenantId, active: true }, select: { id: true, name: true }, take: EXPOSURE_GRID_MAX_SITES });
  const existing = months.length
    ? await db.exposurePeriod.findMany({
        where: { tenantId, periodMonth: { in: months.map(monthDate) } },
        select: { siteId: true, periodMonth: true, employerKind: true, hours: true, headcountAvg: true },
        take: EXPOSURE_IMPORT_MAX_ROWS * 2,
      })
    : [];
  const plan = planExposureImport(
    existing.map((e) => ({ siteId: e.siteId, month: monthOfDate(e.periodMonth), employerKind: e.employerKind as EmployerKind, hours: e.hours, headcountAvg: Number(e.headcountAvg) })),
    sites,
    rows,
  );
  return { plan, parseErrors: errors };
}

export async function previewExposureImport(tenantId: string, csv: string, today: IsoDay = localDay(new Date()), db: Db = prisma): Promise<ExposureImportPreview> {
  const { plan, parseErrors } = await buildImportPlan(tenantId, csv, today, db);
  return { plan, parseErrors, needsReason: plan.counts.update > 0 };
}

/**
 * Aplica el archivo: crea lo nuevo, corrige lo que cambió (con motivo, que es obligatorio si hay correcciones)
 * y deja igual el resto. Las filas con error no se aplican. Reimportar el mismo archivo no cambia nada.
 */
export async function applyExposureImport(
  input: { tenantId: string; actor: SafetyUser; csv: string; reason?: string | null; today?: IsoDay },
  db: Db = prisma,
): Promise<{ counts: ExposureImportPlan["counts"]; errors: number }> {
  requireManager(input.actor);
  const today = input.today ?? localDay(new Date());
  const { plan, parseErrors } = await buildImportPlan(input.tenantId, input.csv, today, db);
  const creates = plan.items.filter((i) => i.action === "create");
  const updates = plan.items.filter((i) => i.action === "update");
  const reason = updates.length > 0 ? checkReason(input.reason) : null;

  for (let i = 0; i < creates.length; i += IMPORT_BATCH) {
    await db.exposurePeriod.createMany({
      data: creates.slice(i, i + IMPORT_BATCH).map((item) => ({
        tenantId: input.tenantId,
        siteId: item.siteId!,
        periodMonth: monthDate(item.row!.month),
        employerKind: item.row!.employerKind as PersonEmployer,
        hours: item.row!.hours,
        headcountAvg: item.row!.headcountAvg,
        recordedByUserId: input.actor.userId,
      })),
      skipDuplicates: true, // otra importación a la vez: el índice único evita la fila doble
    });
  }
  for (const item of updates) {
    await db.$transaction(async (tx) => {
      const current = await tx.exposurePeriod.findFirst({
        where: { tenantId: input.tenantId, siteId: item.siteId!, periodMonth: monthDate(item.row!.month), employerKind: item.row!.employerKind as PersonEmployer },
        select: { id: true, hours: true, headcountAvg: true },
      });
      if (!current) return;
      await tx.exposurePeriod.update({ where: { id: current.id }, data: { hours: item.row!.hours, headcountAvg: item.row!.headcountAvg, recordedByUserId: input.actor.userId } });
      await tx.exposureRevision.create({
        data: {
          tenantId: input.tenantId,
          exposurePeriodId: current.id,
          previousHours: current.hours,
          previousHeadcountAvg: current.headcountAvg,
          newHours: item.row!.hours,
          newHeadcountAvg: item.row!.headcountAvg,
          reason: reason!,
          actorUserId: input.actor.userId,
        },
      });
    });
  }
  await audit(db, {
    tenantId: input.tenantId,
    entityId: "import",
    action: updates.length > 0 ? "update" : "create",
    actorUserId: input.actor.userId,
    summary: `Importación de exposición: ${plan.counts.create} nueva(s), ${plan.counts.update} corregida(s), ${plan.counts.unchanged} sin cambios, ${plan.counts.error + parseErrors.length} con error`,
  });

  const touched = [...creates, ...updates];
  if (touched.length > 0) {
    await syncExposureDueItems(
      input.tenantId,
      { siteIds: [...new Set(touched.map((t) => t.siteId!))], months: [...new Set(touched.map((t) => t.row!.month))], today },
      db,
    );
  }
  return { counts: plan.counts, errors: parseErrors.length };
}

// ─── Historial de correcciones ─────────────────────────────────────────────

export type ExposureRevisionRow = {
  at: Date;
  siteName: string;
  month: MonthKey;
  employerKind: EmployerKind;
  previous: ExposureCell;
  next: ExposureCell;
  reason: string;
  actorName: string | null;
};

export async function listExposureRevisions(tenantId: string, opts: { month?: MonthKey; take?: number } = {}, db: Db = prisma): Promise<ExposureRevisionRow[]> {
  const rows = await db.exposureRevision.findMany({
    where: { tenantId, ...(opts.month ? { exposurePeriod: { periodMonth: monthDate(opts.month) } } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts.take ?? 20, 100),
    select: {
      createdAt: true,
      previousHours: true,
      previousHeadcountAvg: true,
      newHours: true,
      newHeadcountAvg: true,
      reason: true,
      actorUserId: true,
      exposurePeriod: { select: { periodMonth: true, employerKind: true, site: { select: { name: true } } } },
    },
  });
  const actorIds = [...new Set(rows.flatMap((r) => (r.actorUserId ? [r.actorUserId] : [])))];
  const users = actorIds.length ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    at: r.createdAt,
    siteName: r.exposurePeriod.site.name,
    month: monthOfDate(r.exposurePeriod.periodMonth),
    employerKind: r.exposurePeriod.employerKind as EmployerKind,
    previous: { hours: r.previousHours, headcountAvg: Number(r.previousHeadcountAvg) },
    next: { hours: r.newHours, headcountAvg: Number(r.newHeadcountAvg) },
    reason: r.reason,
    actorName: r.actorUserId ? (names.get(r.actorUserId) ?? null) : null,
  }));
}

// ─── Avisos de carga (DueItem por sede y mes) ──────────────────────────────

/**
 * Deja un aviso abierto por sede y mes (de los últimos tres) mientras falte cargar alguno de los dos grupos,
 * con vencimiento el día configurado del mes siguiente y aviso 5 días antes. Se cierra cuando los dos grupos
 * están guardados (aunque sea 0 / 0). Idempotente: solo escribe diferencias y nunca duplica.
 */
export async function syncExposureDueItems(
  tenantId: string,
  opts: { siteIds?: string[]; months?: MonthKey[]; today?: IsoDay } = {},
  db: Db = prisma,
): Promise<{ created: number; updated: number; closed: number }> {
  const today = opts.today ?? localDay(new Date());
  const tracked = exposureMonthsToTrack(today);
  const months = opts.months ? tracked.filter((m) => opts.months!.includes(m)) : tracked;
  const settings = await getSafetySettings(tenantId, db);
  const sites = await db.site.findMany({
    where: { tenantId, active: true, ...(opts.siteIds ? { id: { in: opts.siteIds } } : {}) },
    select: { id: true, name: true },
    take: EXPOSURE_GRID_MAX_SITES,
  });
  const result = { created: 0, updated: 0, closed: 0 };
  if (months.length === 0) return result;

  const keys = sites.flatMap((s) => months.map((m) => ({ site: s, month: m, entityId: `${s.id}:${m}` })));
  const [loaded, open] = await Promise.all([
    db.exposurePeriod.groupBy({
      by: ["siteId", "periodMonth"],
      where: { tenantId, siteId: { in: sites.map((s) => s.id) }, periodMonth: { in: months.map(monthDate) } },
      _count: { _all: true },
    }),
    db.dueItem.findMany({
      where: { tenantId, entityType: EXPOSURE_DUE_ENTITY_TYPE, status: "open", entityId: { in: keys.map((k) => k.entityId) } },
      select: { id: true, entityId: true, title: true, dueAt: true, ownerUserId: true, siteId: true },
    }),
  ]);
  const groups = new Map(loaded.map((l) => [`${l.siteId}:${monthOfDate(l.periodMonth)}`, l._count._all]));
  const openBy = new Map(open.map((o) => [o.entityId!, o]));
  const owner = settings.exposureOwnerUserId;

  for (const { site, month, entityId } of keys) {
    const current = openBy.get(entityId);
    if ((groups.get(entityId) ?? 0) >= EMPLOYER_KINDS.length) {
      if (current) {
        await closeDueItemsForEntity({ tenantId, entityType: EXPOSURE_DUE_ENTITY_TYPE, entityId }, db);
        result.closed++;
      }
      continue;
    }
    const title = `Cargar las horas trabajadas de ${site.name} (${monthLabel(month)})`;
    const dueAt = dayDate(exposureDueDay(month, settings.exposureDueDay));
    if (!current) {
      await createDueItem({ tenantId, title, entityType: EXPOSURE_DUE_ENTITY_TYPE, entityId, dueAt, leadDays: EXPOSURE_LEAD_DAYS, ownerUserId: owner, siteId: site.id }, db);
      result.created++;
    } else if (current.title !== title || current.dueAt.getTime() !== dueAt.getTime() || current.ownerUserId !== owner || current.siteId !== site.id) {
      await db.dueItem.update({
        where: { id: current.id },
        data: { title, dueAt, remindAt: reminderStartsAt(dueAt, EXPOSURE_LEAD_DAYS), ownerUserId: owner, siteId: site.id },
      });
      result.updated++;
    }
  }
  // Sedes dadas de baja: sus avisos abiertos se cierran.
  const activeIds = new Set(sites.map((s) => s.id));
  if (!opts.siteIds) {
    const stale = await db.dueItem.findMany({
      where: { tenantId, entityType: EXPOSURE_DUE_ENTITY_TYPE, status: "open", siteId: { not: null, notIn: [...activeIds] } },
      select: { id: true },
      take: 1000,
    });
    if (stale.length > 0) {
      await db.dueItem.updateMany({ where: { tenantId, id: { in: stale.map((s) => s.id) } }, data: { status: "closed" } });
      result.closed += stale.length;
    }
  }
  return result;
}

/** Los avisos no son la operación principal: si fallan, se registra y la carga ya hecha sigue en pie. */
export async function syncExposureDueItemsSafely(tenantId: string, db: Db = prisma): Promise<void> {
  try {
    await syncExposureDueItems(tenantId, {}, db);
  } catch (error) {
    console.error(JSON.stringify({ event: "safety.exposure.sync.failed", tenantId, error: error instanceof Error ? error.message : String(error) }));
  }
}
