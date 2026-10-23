import { Prisma, type PersonEmployer, type PrismaClient, type TenantRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { closeDueItemsForEntity, upsertOpenDueItemForEntity } from "@/lib/automation";
import { canManageHealthData, canReportIncident, canViewHealthData, type SafetyActor } from "@/domain/safety-stats/access";
import type { EventAggregate, ExposureRow, OpenCaseAggregate } from "@/domain/safety-stats/indices";
import { deriveEventPeriod, localDay } from "@/domain/safety-stats/period";
import {
  CLASSIFICATION_LABELS,
  DEFAULT_SAFETY_SETTINGS,
  INJURY_CLASSIFICATIONS,
  isClassification,
  type EmployerKind,
  type IncidentClassification,
  type IsoDay,
  type MonthKey,
  type SafetySettings,
} from "@/domain/safety-stats/types";
import {
  resolveSeverity,
  validateHealth,
  validateIncident,
  type FieldErrors,
} from "@/domain/safety-stats/validation";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

/** Error de negocio con un mensaje listo para mostrar en la UI. */
export class SafetyStatsError extends Error {
  readonly fieldErrors: FieldErrors;
  constructor(message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = "SafetyStatsError";
    this.fieldErrors = fieldErrors;
  }
}

export type SafetyUser = SafetyActor & { userId: string };

/** Entidades que se registran en `MasterDataAudit` (mismo mecanismo que los datos maestros). */
const AUDIT_INCIDENT = "incident";
export const FOLLOW_UP_DUE_ENTITY_TYPE = "incident_followup";
const FOLLOW_UP_DUE_DAYS = 15;
const FOLLOW_UP_LEAD_DAYS = 3;

const dateFromIso = (iso: IsoDay) => new Date(`${iso}T00:00:00.000Z`);
const isoFromDate = (d: Date | null | undefined): IsoDay | null => (d ? d.toISOString().slice(0, 10) : null);
const monthKey = (d: Date): MonthKey => d.toISOString().slice(0, 7);

async function audit(
  db: Db | Tx,
  input: {
    tenantId: string;
    entityId: string;
    entityType?: string;
    action: "create" | "update" | "view";
    actorUserId: string;
    summary: string;
  },
) {
  await db.masterDataAudit.create({
    data: {
      tenantId: input.tenantId,
      entityType: input.entityType ?? AUDIT_INCIDENT,
      entityId: input.entityId,
      action: input.action,
      actorUserId: input.actorUserId,
      // Nunca nombres, lesiones ni diagnósticos: el registro dice qué se hizo, no qué contiene la ficha.
      summary: input.summary,
    },
  });
}

function firstError(errors: FieldErrors): never {
  const [message] = Object.values(errors);
  throw new SafetyStatsError(message, errors);
}

// ─── Ajustes ────────────────────────────────────────────────────────────────

export async function getSafetySettings(tenantId: string, db: Db = prisma): Promise<SafetySettings> {
  const row = await db.safetyStatsSettings.findUnique({ where: { tenantId } });
  if (!row) return { ...DEFAULT_SAFETY_SETTINGS };
  return {
    fatalChargeDays: row.fatalChargeDays,
    severityBase: row.severityBase === 1_000_000 ? 1_000_000 : 1000,
    lostDaysCap: row.lostDaysCap,
    exposureDueDay: row.exposureDueDay,
    showOptionalIndices: row.showOptionalIndices,
    exposureOwnerUserId: row.exposureOwnerUserId,
  };
}

export async function updateSafetySettings(
  input: { tenantId: string; actor: SafetyUser; settings: Partial<SafetySettings> },
  db: Db = prisma,
): Promise<SafetySettings> {
  if (!canManageHealthData(input.actor)) throw new SafetyStatsError("Sin permiso para cambiar los ajustes");
  const s = { ...(await getSafetySettings(input.tenantId, db)), ...input.settings };
  if (s.severityBase !== 1000 && s.severityBase !== 1_000_000) throw new SafetyStatsError("La base del IG es 1.000 o 1.000.000");
  if (!Number.isInteger(s.fatalChargeDays) || s.fatalChargeDays < 0) throw new SafetyStatsError("El cargo por fatal es 0 o más días");
  if (!Number.isInteger(s.lostDaysCap) || s.lostDaysCap < 1 || s.lostDaysCap > 3650) throw new SafetyStatsError("El tope de días va entre 1 y 3.650");
  if (!Number.isInteger(s.exposureDueDay) || s.exposureDueDay < 1 || s.exposureDueDay > 28) throw new SafetyStatsError("El día de vencimiento va entre 1 y 28");
  if (s.exposureOwnerUserId) {
    const member = await db.membership.findFirst({ where: { tenantId: input.tenantId, userId: s.exposureOwnerUserId }, select: { userId: true } });
    if (!member) throw new SafetyStatsError("El responsable de la carga no pertenece a la empresa");
  }
  const data = {
    fatalChargeDays: s.fatalChargeDays,
    severityBase: s.severityBase,
    lostDaysCap: s.lostDaysCap,
    exposureDueDay: s.exposureDueDay,
    showOptionalIndices: s.showOptionalIndices,
    exposureOwnerUserId: s.exposureOwnerUserId,
  };
  await db.safetyStatsSettings.upsert({
    where: { tenantId: input.tenantId },
    create: { tenantId: input.tenantId, ...data },
    update: data,
  });
  await audit(db, {
    tenantId: input.tenantId,
    entityType: "safety_settings",
    entityId: input.tenantId,
    action: "update",
    actorUserId: input.actor.userId,
    summary: "Cambio de ajustes de accidentabilidad",
  });
  return s;
}

// ─── Alta del hecho (junto con el Hallazgo) ─────────────────────────────────

export type IncidentFactInput = {
  siteId: string;
  occurredAt: Date;
  classification: IncidentClassification;
  inItinere: boolean;
  isRoad: boolean;
  employerKind: EmployerKind;
  restrictedWork: boolean;
  accidentForm: string;
  materialAgent: string;
  returnToWorkDate?: IsoDay | null;
  chargePct?: number | null;
};

export type IncidentHealthInput = {
  affectedPersonId: string | null;
  natureOfInjury: string | null;
  bodyPart: string | null;
  artClaimNumber: string | null;
  deathDate: IsoDay | null;
};

async function requireActiveSite(db: Db | Tx, tenantId: string, siteId: string) {
  const site = await db.site.findFirst({ where: { id: siteId, tenantId, active: true }, select: { id: true, name: true } });
  if (!site) throw new SafetyStatsError("Elegí una sede de la empresa", { siteId: "Elegí una sede de la empresa" });
  return site;
}

async function requirePerson(db: Db | Tx, tenantId: string, personId: string) {
  const person = await db.person.findFirst({
    where: { id: personId, tenantId },
    select: { id: true, name: true, employer: true, status: true },
  });
  if (!person) throw new SafetyStatsError("Elegí a una persona de la empresa", { affectedPersonId: "Elegí a una persona de la empresa" });
  return person;
}

function validateFact(input: IncidentFactInput, now: Date, cap: number) {
  const result = validateIncident({ ...input, now, lostDaysCap: cap });
  if (Object.keys(result.errors).length > 0) firstError(result.errors);
  return result.warnings;
}

/**
 * Crea el Hallazgo borrador de tipo incidente y su ficha en una sola transacción. Cualquier colaborador
 * puede dar de alta el hecho; la ficha de salud (persona, lesión) la completan solo quienes pueden gestionarla.
 */
export async function createIncidentWithFinding(
  input: {
    tenantId: string;
    actor: SafetyUser;
    title: string;
    description: string;
    fact: IncidentFactInput;
    health?: IncidentHealthInput | null;
    now?: Date;
  },
  db: Db = prisma,
) {
  const { tenantId, actor, fact } = input;
  if (!canReportIncident(actor)) throw new SafetyStatsError("Sin permiso para registrar accidentes");
  if (input.health && !canManageHealthData(actor)) throw new SafetyStatsError("Sin permiso para completar la ficha de salud");

  const now = input.now ?? new Date();
  const title = input.title.trim();
  if (title.length < 2) throw new SafetyStatsError("Escribí un título", { title: "Escribí un título" });

  const settings = await getSafetySettings(tenantId, db);
  const warnings = validateFact(fact, now, settings.lostDaysCap);
  const site = await requireActiveSite(db, tenantId, fact.siteId);
  const period = deriveEventPeriod(fact.occurredAt);
  const severity = resolveSeverity({
    classification: fact.classification,
    occurredOn: period.occurredOn,
    returnToWorkDate: fact.returnToWorkDate ?? null,
    asOf: localDay(now),
    cap: settings.lostDaysCap,
    chargePct: fact.chargePct,
  });

  let personWarning: string | null = null;
  if (input.health) {
    const health = validateHealth({
      classification: fact.classification,
      affectedPersonId: input.health.affectedPersonId,
      natureOfInjury: input.health.natureOfInjury,
      bodyPart: input.health.bodyPart,
      occurredOn: period.occurredOn,
      deathDate: input.health.deathDate,
    });
    if (Object.keys(health.errors).length > 0) firstError(health.errors);
    warnings.push(...health.warnings);
    if (input.health.affectedPersonId) {
      const person = await requirePerson(db, tenantId, input.health.affectedPersonId);
      if (person.employer !== fact.employerKind) {
        personWarning = "La persona figura con otro tipo de empleador que el elegido para el hecho. Se conservó el del hecho.";
      }
    }
  }

  const created = await db.$transaction(async (tx) => {
    const finding = await tx.finding.create({
      data: {
        tenantId,
        type: "incident",
        origin: "incident",
        status: "draft",
        title,
        description: input.description.trim() || "Completar",
        detectedAt: fact.occurredAt,
        source: "Accidentabilidad",
        location: site.name,
        createdByUserId: actor.userId,
      },
    });
    const record = await tx.incidentRecord.create({
      data: {
        tenantId,
        findingId: finding.id,
        siteId: site.id,
        occurredAt: fact.occurredAt,
        occurredOn: dateFromIso(period.occurredOn),
        periodMonth: dateFromIso(period.periodMonth),
        weekday: period.weekday,
        hourOfDay: period.hourOfDay,
        classification: fact.classification,
        inItinere: fact.inItinere,
        isRoad: fact.isRoad,
        employerKind: fact.employerKind,
        restrictedWork: fact.classification === "no_lost_time" && fact.restrictedWork,
        accidentForm: fact.accidentForm,
        materialAgent: fact.materialAgent,
        lostDays: severity.lostDays,
        returnToWorkDate: fact.returnToWorkDate ? dateFromIso(fact.returnToWorkDate) : null,
        chargePct: severity.chargePct,
        createdByUserId: actor.userId,
      },
    });
    await tx.incidentFollowUp.create({
      data: {
        tenantId,
        incidentRecordId: record.id,
        authorUserId: actor.userId,
        classification: fact.classification,
        lostDays: severity.lostDays,
        returnToWorkDate: record.returnToWorkDate,
        chargePct: severity.chargePct,
        note: "Alta de la ficha",
      },
    });
    await audit(tx, {
      tenantId,
      entityId: record.id,
      action: "create",
      actorUserId: actor.userId,
      summary: `Alta de ficha de accidente (${CLASSIFICATION_LABELS[fact.classification]})`,
    });
    if (input.health) {
      await tx.incidentHealth.create({
        data: { tenantId, incidentRecordId: record.id, ...cleanHealth(input.health) },
      });
      await audit(tx, {
        tenantId,
        entityId: record.id,
        action: "create",
        actorUserId: actor.userId,
        summary: "Alta de la ficha de salud",
      });
    }
    return { finding, record };
  });

  await syncFollowUpDueItem(tenantId, created.record.id, db);
  return { ...created, warnings: personWarning ? [...warnings, personWarning] : warnings };
}

/** Agrega la ficha a un Hallazgo de tipo incidente que todavía no la tiene. */
export async function addIncidentRecordToFinding(
  input: { tenantId: string; actor: SafetyUser; findingId: string; fact: IncidentFactInput; now?: Date },
  db: Db = prisma,
) {
  const { tenantId, actor, fact } = input;
  if (!canReportIncident(actor)) throw new SafetyStatsError("Sin permiso para registrar accidentes");
  const finding = await db.finding.findFirst({
    where: { id: input.findingId, tenantId },
    select: { id: true, type: true, incidentRecord: { select: { id: true } } },
  });
  if (!finding) throw new SafetyStatsError("Hallazgo no encontrado");
  if (finding.type !== "incident") throw new SafetyStatsError("Solo un hallazgo de tipo incidente lleva ficha de accidente");
  if (finding.incidentRecord) throw new SafetyStatsError("Este hallazgo ya tiene ficha de accidente");

  const now = input.now ?? new Date();
  const settings = await getSafetySettings(tenantId, db);
  const warnings = validateFact(fact, now, settings.lostDaysCap);
  const site = await requireActiveSite(db, tenantId, fact.siteId);
  const period = deriveEventPeriod(fact.occurredAt);
  const severity = resolveSeverity({
    classification: fact.classification,
    occurredOn: period.occurredOn,
    returnToWorkDate: fact.returnToWorkDate ?? null,
    asOf: localDay(now),
    cap: settings.lostDaysCap,
    chargePct: fact.chargePct,
  });

  const record = await db.$transaction(async (tx) => {
    const created = await tx.incidentRecord.create({
      data: {
        tenantId,
        findingId: finding.id,
        siteId: site.id,
        occurredAt: fact.occurredAt,
        occurredOn: dateFromIso(period.occurredOn),
        periodMonth: dateFromIso(period.periodMonth),
        weekday: period.weekday,
        hourOfDay: period.hourOfDay,
        classification: fact.classification,
        inItinere: fact.inItinere,
        isRoad: fact.isRoad,
        employerKind: fact.employerKind,
        restrictedWork: fact.classification === "no_lost_time" && fact.restrictedWork,
        accidentForm: fact.accidentForm,
        materialAgent: fact.materialAgent,
        lostDays: severity.lostDays,
        returnToWorkDate: fact.returnToWorkDate ? dateFromIso(fact.returnToWorkDate) : null,
        chargePct: severity.chargePct,
        createdByUserId: actor.userId,
      },
    });
    await tx.incidentFollowUp.create({
      data: {
        tenantId,
        incidentRecordId: created.id,
        authorUserId: actor.userId,
        classification: fact.classification,
        lostDays: severity.lostDays,
        returnToWorkDate: created.returnToWorkDate,
        chargePct: severity.chargePct,
        note: "Alta de la ficha",
      },
    });
    await audit(tx, {
      tenantId,
      entityId: created.id,
      action: "create",
      actorUserId: actor.userId,
      summary: `Alta de ficha de accidente (${CLASSIFICATION_LABELS[fact.classification]})`,
    });
    return created;
  });
  await syncFollowUpDueItem(tenantId, record.id, db);
  return { record, warnings };
}

function cleanHealth(h: IncidentHealthInput) {
  return {
    affectedPersonId: h.affectedPersonId || null,
    natureOfInjury: h.natureOfInjury || null,
    bodyPart: h.bodyPart || null,
    artClaimNumber: h.artClaimNumber?.trim().slice(0, 60) || null,
    deathDate: h.deathDate ? dateFromIso(h.deathDate) : null,
  };
}

// ─── Lectura de la ficha ────────────────────────────────────────────────────

const FACT_SELECT = {
  id: true,
  findingId: true,
  siteId: true,
  occurredAt: true,
  occurredOn: true,
  classification: true,
  inItinere: true,
  isRoad: true,
  employerKind: true,
  restrictedWork: true,
  accidentForm: true,
  materialAgent: true,
  lostDays: true,
  returnToWorkDate: true,
  chargePct: true,
  createdByUserId: true,
  site: { select: { id: true, name: true } },
} satisfies Prisma.IncidentRecordSelect;

export type IncidentFact = Prisma.IncidentRecordGetPayload<{ select: typeof FACT_SELECT }>;

export type IncidentFicha = {
  fact: IncidentFact;
  /** false cuando el actor no puede recibir datos de salud (personal de plataforma): no se consulta ni se registra. */
  healthVisible: boolean;
  health: {
    affectedPerson: { id: string; name: string; employeeCode: string } | null;
    natureOfInjury: string | null;
    bodyPart: string | null;
    artClaimNumber: string | null;
    deathDate: Date | null;
  } | null;
  followUps: {
    id: string;
    at: Date;
    classification: IncidentClassification;
    lostDays: number;
    returnToWorkDate: Date | null;
    chargePct: number;
    note: string | null;
  }[];
};

/**
 * Única puerta de lectura de la ficha de salud. Cada consulta deja registro (quién, cuándo) y el
 * personal de plataforma no recibe los datos de salud (D10, D13).
 */
export async function getIncidentFicha(
  input: { tenantId: string; findingId: string; actor: SafetyUser },
  db: Db = prisma,
): Promise<IncidentFicha | null> {
  const { tenantId, actor } = input;
  const fact = await db.incidentRecord.findFirst({
    where: { findingId: input.findingId, tenantId },
    select: FACT_SELECT,
  });
  if (!fact) return null;
  if (!canViewHealthData(actor)) return { fact, healthVisible: false, health: null, followUps: [] };

  const [health, followUps] = await Promise.all([
    db.incidentHealth.findFirst({
      where: { incidentRecordId: fact.id, tenantId },
      select: {
        natureOfInjury: true,
        bodyPart: true,
        artClaimNumber: true,
        deathDate: true,
        affectedPerson: { select: { id: true, name: true, employeeCode: true } },
      },
    }),
    db.incidentFollowUp.findMany({
      where: { incidentRecordId: fact.id, tenantId },
      orderBy: { at: "desc" },
      take: 50,
      select: { id: true, at: true, classification: true, lostDays: true, returnToWorkDate: true, chargePct: true, note: true },
    }),
  ]);
  await audit(db, {
    tenantId,
    entityId: fact.id,
    action: "view",
    actorUserId: actor.userId,
    summary: "Consulta de la ficha de accidente",
  });
  return {
    fact,
    healthVisible: true,
    health,
    followUps: followUps.map((f) => ({ ...f, chargePct: Number(f.chargePct) })),
  };
}

/** Sin datos de salud: para saber si un Hallazgo tiene ficha (p. ej. bloquear el cambio de tipo). */
export async function hasIncidentRecord(tenantId: string, findingId: string, db: Db = prisma): Promise<boolean> {
  return (await db.incidentRecord.count({ where: { tenantId, findingId } })) > 0;
}

// ─── Edición del hecho, ficha de salud y seguimientos ───────────────────────

async function loadRecordForUpdate(db: Db | Tx, tenantId: string, findingId: string) {
  const record = await db.incidentRecord.findFirst({
    where: { findingId, tenantId },
    include: { finding: { select: { title: true, status: true } } },
  });
  if (!record) throw new SafetyStatsError("Este hallazgo no tiene ficha de accidente");
  return record;
}

/** Corrige el hecho (fecha, sede, forma, agente…). La clasificación y los días cambian por seguimiento. */
export async function updateIncidentFact(
  input: {
    tenantId: string;
    actor: SafetyUser;
    findingId: string;
    fact: Pick<IncidentFactInput, "siteId" | "occurredAt" | "inItinere" | "isRoad" | "employerKind" | "restrictedWork" | "accidentForm" | "materialAgent">;
    now?: Date;
  },
  db: Db = prisma,
) {
  const { tenantId, actor } = input;
  if (!canManageHealthData(actor)) throw new SafetyStatsError("Sin permiso para editar la ficha");
  const record = await loadRecordForUpdate(db, tenantId, input.findingId);
  const now = input.now ?? new Date();
  const settings = await getSafetySettings(tenantId, db);
  const next: IncidentFactInput = {
    ...input.fact,
    classification: record.classification,
    returnToWorkDate: isoFromDate(record.returnToWorkDate),
    chargePct: Number(record.chargePct),
  };
  const warnings = validateFact(next, now, settings.lostDaysCap);
  const site = await requireActiveSite(db, tenantId, next.siteId);
  const period = deriveEventPeriod(next.occurredAt);
  const severity = resolveSeverity({
    classification: record.classification,
    occurredOn: period.occurredOn,
    returnToWorkDate: next.returnToWorkDate ?? null,
    asOf: localDay(now),
    cap: settings.lostDaysCap,
    chargePct: next.chargePct,
  });

  await db.$transaction(async (tx) => {
    await tx.incidentRecord.update({
      where: { id: record.id },
      data: {
        siteId: site.id,
        occurredAt: next.occurredAt,
        occurredOn: dateFromIso(period.occurredOn),
        periodMonth: dateFromIso(period.periodMonth),
        weekday: period.weekday,
        hourOfDay: period.hourOfDay,
        inItinere: next.inItinere,
        isRoad: next.isRoad,
        employerKind: next.employerKind,
        restrictedWork: record.classification === "no_lost_time" && next.restrictedWork,
        accidentForm: next.accidentForm,
        materialAgent: next.materialAgent,
        lostDays: severity.lostDays,
      },
    });
    await tx.finding.update({ where: { id: record.findingId }, data: { detectedAt: next.occurredAt, location: site.name } });
    await audit(tx, {
      tenantId,
      entityId: record.id,
      action: "update",
      actorUserId: actor.userId,
      summary: "Edición del hecho de la ficha de accidente",
    });
  });
  await syncFollowUpDueItem(tenantId, record.id, db);
  return { warnings };
}

/** Completa o corrige la ficha de salud (persona afectada, lesión, parte del cuerpo, n.° de ART). */
export async function saveIncidentHealth(
  input: { tenantId: string; actor: SafetyUser; findingId: string; health: IncidentHealthInput },
  db: Db = prisma,
) {
  const { tenantId, actor } = input;
  if (!canManageHealthData(actor)) throw new SafetyStatsError("Sin permiso para completar la ficha de salud");
  const record = await loadRecordForUpdate(db, tenantId, input.findingId);
  const result = validateHealth({
    classification: record.classification,
    affectedPersonId: input.health.affectedPersonId,
    natureOfInjury: input.health.natureOfInjury,
    bodyPart: input.health.bodyPart,
    occurredOn: record.occurredOn.toISOString().slice(0, 10),
    deathDate: input.health.deathDate,
  });
  if (Object.keys(result.errors).length > 0) firstError(result.errors);
  const warnings = [...result.warnings];
  if (input.health.affectedPersonId) {
    const person = await requirePerson(db, tenantId, input.health.affectedPersonId);
    if (person.employer !== record.employerKind) {
      warnings.push("La persona figura con otro tipo de empleador que el elegido para el hecho. Se conservó el del hecho.");
    }
  }
  const data = cleanHealth(input.health);
  const existing = await db.incidentHealth.findFirst({ where: { incidentRecordId: record.id, tenantId }, select: { id: true } });
  await db.$transaction(async (tx) => {
    if (existing) await tx.incidentHealth.update({ where: { id: existing.id }, data });
    else await tx.incidentHealth.create({ data: { tenantId, incidentRecordId: record.id, ...data } });
    await audit(tx, {
      tenantId,
      entityId: record.id,
      action: existing ? "update" : "create",
      actorUserId: actor.userId,
      summary: existing ? "Edición de la ficha de salud" : "Alta de la ficha de salud",
    });
  });
  return { warnings };
}

export type FollowUpInput = {
  classification: IncidentClassification;
  restrictedWork?: boolean;
  returnToWorkDate?: IsoDay | null;
  chargePct?: number | null;
  note?: string | null;
};

/**
 * Seguimiento: actualiza días perdidos o reclasifica. Agrega una fila al historial (nunca la edita),
 * mueve el caso dentro del mes del accidente y renueva o cierra el vencimiento de seguimiento.
 */
export async function addIncidentFollowUp(
  input: { tenantId: string; actor: SafetyUser; findingId: string; followUp: FollowUpInput; now?: Date },
  db: Db = prisma,
) {
  const { tenantId, actor } = input;
  if (!canManageHealthData(actor)) throw new SafetyStatsError("Sin permiso para actualizar el seguimiento");
  if (!isClassification(input.followUp.classification)) throw new SafetyStatsError("Clasificación no válida");

  const record = await loadRecordForUpdate(db, tenantId, input.findingId);
  const now = input.now ?? new Date();
  const settings = await getSafetySettings(tenantId, db);
  const occurredOn = record.occurredOn.toISOString().slice(0, 10);
  const next: IncidentFactInput = {
    siteId: record.siteId,
    occurredAt: record.occurredAt,
    classification: input.followUp.classification,
    inItinere: record.inItinere,
    isRoad: record.isRoad,
    employerKind: record.employerKind,
    restrictedWork: input.followUp.restrictedWork ?? false,
    accidentForm: record.accidentForm,
    materialAgent: record.materialAgent,
    returnToWorkDate: input.followUp.returnToWorkDate || null,
    chargePct: input.followUp.chargePct ?? 0,
  };
  const warnings = validateFact(next, now, settings.lostDaysCap);
  const severity = resolveSeverity({
    classification: next.classification,
    occurredOn,
    returnToWorkDate: next.returnToWorkDate ?? null,
    asOf: localDay(now),
    cap: settings.lostDaysCap,
    chargePct: next.chargePct,
  });

  if (INJURY_CLASSIFICATIONS.includes(next.classification) && next.classification !== record.classification) {
    const health = await db.incidentHealth.findFirst({ where: { incidentRecordId: record.id, tenantId }, select: { id: true } });
    if (!health) warnings.push("Falta completar la ficha de salud: indicá a la persona afectada.");
  }

  const note = input.followUp.note?.trim().slice(0, 500) || null;
  const returnDate = next.returnToWorkDate ? dateFromIso(next.returnToWorkDate) : null;
  await db.$transaction(async (tx) => {
    await tx.incidentRecord.update({
      where: { id: record.id },
      data: {
        classification: next.classification,
        restrictedWork: next.classification === "no_lost_time" && next.restrictedWork,
        lostDays: severity.lostDays,
        returnToWorkDate: next.classification === "lost_time" ? returnDate : null,
        chargePct: severity.chargePct,
      },
    });
    await tx.incidentFollowUp.create({
      data: {
        tenantId,
        incidentRecordId: record.id,
        authorUserId: actor.userId,
        classification: next.classification,
        lostDays: severity.lostDays,
        returnToWorkDate: next.classification === "lost_time" ? returnDate : null,
        chargePct: severity.chargePct,
        note,
      },
    });
    const changed =
      record.classification !== next.classification
        ? `${CLASSIFICATION_LABELS[record.classification]} → ${CLASSIFICATION_LABELS[next.classification]}`
        : CLASSIFICATION_LABELS[next.classification];
    await audit(tx, {
      tenantId,
      entityId: record.id,
      action: "update",
      actorUserId: actor.userId,
      summary: `Seguimiento de la ficha de accidente: ${changed}, ${severity.lostDays} día(s) perdidos`,
    });
  });
  await syncFollowUpDueItem(tenantId, record.id, db);
  return { warnings, lostDays: severity.lostDays, open: severity.open };
}

// ─── Vencimiento de seguimiento ─────────────────────────────────────────────

async function pickFollowUpOwner(db: Db, tenantId: string, createdByUserId: string | null): Promise<string | null> {
  const managers: TenantRole[] = ["tenant_admin", "process_owner"];
  if (createdByUserId) {
    const own = await db.membership.findFirst({ where: { tenantId, userId: createdByUserId, role: { in: managers } }, select: { userId: true } });
    if (own) return own.userId;
  }
  const admin = await db.membership.findFirst({ where: { tenantId, role: "tenant_admin" }, orderBy: { createdAt: "asc" }, select: { userId: true } });
  return admin?.userId ?? null;
}

/**
 * Mientras el caso con baja está abierto hay un solo vencimiento «Actualizar días perdidos» (15 días),
 * que se renueva en cada seguimiento y se cierra con la fecha de reintegro, al cambiar de clasificación
 * o si el Hallazgo se anula. `entityId` es el Hallazgo: así el Panel enlaza a su ficha.
 */
export async function syncFollowUpDueItem(tenantId: string, incidentRecordId: string, db: Db = prisma, now: Date = new Date()) {
  const record = await db.incidentRecord.findFirst({
    where: { id: incidentRecordId, tenantId },
    select: {
      findingId: true,
      siteId: true,
      classification: true,
      returnToWorkDate: true,
      inItinere: true,
      createdByUserId: true,
      finding: { select: { title: true, status: true } },
    },
  });
  if (!record) return;
  const open = record.classification === "lost_time" && !record.returnToWorkDate && record.finding.status !== "cancelled";
  if (!open) {
    await closeDueItemsForEntity({ tenantId, entityType: FOLLOW_UP_DUE_ENTITY_TYPE, entityId: record.findingId }, db);
    return;
  }
  await upsertOpenDueItemForEntity(
    {
      tenantId,
      title: `Actualizar días perdidos: ${record.finding.title}`.slice(0, 200),
      entityType: FOLLOW_UP_DUE_ENTITY_TYPE,
      entityId: record.findingId,
      dueAt: new Date(now.getTime() + FOLLOW_UP_DUE_DAYS * 86_400_000),
      leadDays: FOLLOW_UP_LEAD_DAYS,
      ownerUserId: await pickFollowUpOwner(db, tenantId, record.createdByUserId),
      siteId: record.siteId,
    },
    db,
  );
}

// ─── Listados y agregaciones (todo en la base, siempre con tenantId) ────────

export const INCIDENT_PAGE_SIZE = 25;

export async function listIncidents(
  input: {
    tenantId: string;
    page?: number;
    classification?: IncidentClassification;
    siteId?: string;
    includeCancelled?: boolean;
    /** Solo los casos con baja que siguen sin fecha de reintegro. */
    open?: boolean;
    /** Solo los casos con lesión a los que les falta la ficha de salud. */
    incomplete?: boolean;
  },
  db: Db = prisma,
) {
  const page = Math.max(input.page ?? 1, 1);
  const where: Prisma.IncidentRecordWhereInput = {
    tenantId: input.tenantId,
    ...(input.classification ? { classification: input.classification } : {}),
    ...(input.siteId ? { siteId: input.siteId } : {}),
    ...(input.open ? { classification: "lost_time", returnToWorkDate: null } : {}),
    ...(input.incomplete ? { classification: { in: [...INJURY_CLASSIFICATIONS] }, health: { is: null } } : {}),
    ...(input.includeCancelled ? {} : { finding: { status: { not: "cancelled" } } }),
  };
  const [total, rows] = await Promise.all([
    db.incidentRecord.count({ where }),
    db.incidentRecord.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * INCIDENT_PAGE_SIZE,
      take: INCIDENT_PAGE_SIZE,
      select: {
        id: true,
        findingId: true,
        occurredAt: true,
        classification: true,
        inItinere: true,
        lostDays: true,
        returnToWorkDate: true,
        site: { select: { name: true } },
        finding: { select: { title: true, status: true } },
        health: { select: { id: true } },
      },
    }),
  ]);
  return {
    total,
    page,
    pageSize: INCIDENT_PAGE_SIZE,
    items: rows.map((r) => ({
      id: r.id,
      findingId: r.findingId,
      occurredAt: r.occurredAt,
      classification: r.classification,
      inItinere: r.inItinere,
      lostDays: r.lostDays,
      open: r.classification === "lost_time" && !r.returnToWorkDate,
      siteName: r.site.name,
      title: r.finding.title,
      findingStatus: r.finding.status,
      /** Con lesión y sin ficha de salud: falta completarla. */
      healthMissing: INJURY_CLASSIFICATIONS.includes(r.classification) && !r.health,
    })),
  };
}

/**
 * Filas agregadas por la base (`groupBy`) para los índices: nunca se cargan eventos. Excluye los
 * Hallazgos anulados (D4) y filtra siempre por empresa.
 */
export async function aggregateIncidentEvents(
  input: { tenantId: string; fromMonth: MonthKey; toMonth: MonthKey; siteIds?: string[] },
  db: Db = prisma,
): Promise<{ events: EventAggregate[]; openCases: OpenCaseAggregate[] }> {
  const where: Prisma.IncidentRecordWhereInput = {
    tenantId: input.tenantId,
    periodMonth: { gte: dateFromIso(`${input.fromMonth}-01`), lte: dateFromIso(`${input.toMonth}-01`) },
    finding: { status: { not: "cancelled" } },
    ...(input.siteIds ? { siteId: { in: input.siteIds } } : {}),
  };
  const [grouped, open] = await Promise.all([
    db.incidentRecord.groupBy({
      by: ["siteId", "periodMonth", "employerKind", "classification", "inItinere", "restrictedWork"],
      where,
      _count: { _all: true },
      _sum: { lostDays: true, chargePct: true },
    }),
    db.incidentRecord.groupBy({
      by: ["siteId", "periodMonth", "employerKind"],
      where: { ...where, classification: "lost_time", returnToWorkDate: null, inItinere: false },
      _count: { _all: true },
    }),
  ]);
  return {
    events: grouped.map((g) => ({
      siteId: g.siteId,
      month: monthKey(g.periodMonth),
      employerKind: g.employerKind,
      classification: g.classification,
      inItinere: g.inItinere,
      restrictedWork: g.restrictedWork,
      count: g._count._all,
      lostDays: g._sum.lostDays ?? 0,
      chargePct: Number(g._sum.chargePct ?? 0),
    })),
    openCases: open.map((o) => ({
      siteId: o.siteId,
      month: monthKey(o.periodMonth),
      employerKind: o.employerKind,
      count: o._count._all,
    })),
  };
}

export async function listExposurePeriods(
  input: { tenantId: string; fromMonth: MonthKey; toMonth: MonthKey; siteIds?: string[] },
  db: Db = prisma,
): Promise<ExposureRow[]> {
  const rows = await db.exposurePeriod.findMany({
    where: {
      tenantId: input.tenantId,
      periodMonth: { gte: dateFromIso(`${input.fromMonth}-01`), lte: dateFromIso(`${input.toMonth}-01`) },
      ...(input.siteIds ? { siteId: { in: input.siteIds } } : {}),
    },
    select: { siteId: true, periodMonth: true, employerKind: true, hours: true, headcountAvg: true },
  });
  return rows.map((r) => ({
    siteId: r.siteId,
    month: monthKey(r.periodMonth),
    employerKind: r.employerKind as PersonEmployer,
    hours: r.hours,
    headcountAvg: Number(r.headcountAvg),
  }));
}
