import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getObjectStorage } from "@/lib/storage";
import type { ObjectStorage } from "@/lib/storage/types";
import { InspectionError, writeAudit, type Db, type Tx } from "@/lib/inspection-support";
import { checkInstrumentForUse, parseChannels, recomputeInstrumentControl } from "@/lib/instruments";
import { isAllowedUploadContentType, resolveUploadContentType } from "@/domain/documents/versioning";
import { dateFromIso, isIsoDate, isoFromDate, todayIso } from "@/domain/inspections/dates";
import {
  INSTRUMENT_TYPE_KEY,
  RECORD_KINDS,
  TRACEABILITIES,
  closeIssues,
  computeRecordOutcome,
  evaluateStoredPoints,
  formatDecimal,
  parseDecimal,
  recordFieldIssues,
  type PointInput,
  type RecordKind,
  type Traceability,
} from "@/domain/calibration";

const MAX_CERTIFICATE_BYTES = 15 * 1024 * 1024;
const MAX_CERTIFICATES = 5;

/** Un punto como lo tipea la persona: texto, con coma o punto decimal. */
export type PointDraft = { channelKey: string; nominal: string; measured: string; uncertainty?: string | null };

export type RecordDraftInput = {
  tenantId: string;
  actorUserId: string;
  assetId: string;
  /** Borrador que se edita; nulo para uno nuevo. */
  recordId?: string | null;
  kind: string;
  performedAt: string;
  certificateNumber?: string | null;
  certificateIssuedAt?: string | null;
  labName: string;
  traceability: string;
  accreditationBody?: string | null;
  accreditationNumber?: string | null;
  accreditationScopeCovers?: boolean | null;
  traceabilityBasis?: string | null;
  referenceStandardAssetId?: string | null;
  conditions?: string | null;
  adjusted: boolean;
  basis: "points" | "certificate_statement";
  labStatement?: "conforme" | "no_conforme" | null;
  labStatementSpec?: string | null;
  labDecisionRule?: string | null;
  /** Factor de cobertura de las incertidumbres informadas (2 si no se indica). */
  coverageK?: string | null;
  notes?: string | null;
  asFoundPoints: PointDraft[];
  asLeftPoints: PointDraft[];
};

const clean = (v: string | null | undefined) => (v && v.trim() !== "" ? v.trim() : null);
const isKind = (v: string): v is RecordKind => (RECORD_KINDS as readonly string[]).includes(v);
const isTraceability = (v: string): v is Traceability => (TRACEABILITIES as readonly string[]).includes(v);

function issuesError(issues: { field: string; message: string }[]): InspectionError {
  return new InspectionError(issues.map((i) => i.message).join(" · "), "invalid_record", issues);
}

async function loadInstrument(db: Db | Tx, tenantId: string, assetId: string) {
  const asset = await db.asset.findFirst({
    where: { id: assetId, tenantId, typeKey: INSTRUMENT_TYPE_KEY },
    include: { instrControl: true },
  });
  if (!asset || !asset.instrControl) throw new InspectionError("Equipo no encontrado");
  return { asset, control: asset.instrControl };
}

/** Lee los puntos tipeados: descarta las filas vacías y exige números en las que tienen algo. */
function readPoints(drafts: PointDraft[], channelKeys: Set<string>, label: string) {
  const rows: { channelKey: string; nominal: string; measured: string; uncertainty: string | null }[] = [];
  for (const [index, p] of drafts.entries()) {
    const nominal = p.nominal.trim();
    const measured = p.measured.trim();
    const uncertainty = (p.uncertainty ?? "").trim();
    if (nominal === "" && measured === "" && uncertainty === "") continue;
    const where = `${label}, fila ${index + 1}`;
    if (!channelKeys.has(p.channelKey)) throw new InspectionError(`${where}: el canal no existe en este equipo`);
    const n = parseDecimal(nominal);
    const m = parseDecimal(measured);
    if (n === null || m === null) throw new InspectionError(`${where}: completá el valor del patrón (nominal) y el medido con números`);
    let u: string | null = null;
    if (uncertainty !== "") {
      const parsed = parseDecimal(uncertainty);
      if (parsed === null || parsed < BigInt(0)) throw new InspectionError(`${where}: la incertidumbre debe ser un número no negativo`);
      u = formatDecimal(parsed);
    }
    rows.push({ channelKey: p.channelKey, nominal: formatDecimal(n), measured: formatDecimal(m), uncertainty: u });
  }
  return rows;
}

async function requireReferenceStandard(db: Db | Tx, tenantId: string, assetId: string, standardId: string | null) {
  if (!standardId) return;
  if (standardId === assetId) throw new InspectionError("Un equipo no puede ser su propio patrón");
  const standard = await db.asset.findFirst({ where: { id: standardId, tenantId, typeKey: INSTRUMENT_TYPE_KEY }, select: { id: true } });
  if (!standard) throw new InspectionError("El patrón no existe o no es un equipo de medición");
}

/**
 * Guarda (o crea) el borrador de una calibración o verificación. Un borrador admite que falten datos:
 * el certificado a veces llega después. Cerrar exige todo (`closeCalibrationRecord`).
 */
export async function saveCalibrationDraft(input: RecordDraftInput, db: PrismaClient = prisma) {
  const { asset, control } = await loadInstrument(db, input.tenantId, input.assetId);
  if (asset.status === "retired") throw new InspectionError("El equipo está dado de baja: no admite nuevos registros");
  if (!control.requiresCalibration && !control.requiresVerification) {
    throw new InspectionError("Este equipo no lleva calibración ni verificación: cambiá su configuración si corresponde");
  }
  if (!isKind(input.kind)) throw new InspectionError("Elegí si es una calibración o una verificación");
  if (!isTraceability(input.traceability)) throw new InspectionError("Elegí la ruta de trazabilidad");
  const kind = input.kind;
  const traceability = input.traceability;
  if (kind === "calibration" && !control.requiresCalibration) throw new InspectionError("Este equipo no exige calibración: cargá una verificación");
  if (kind === "verification" && !control.requiresVerification) throw new InspectionError("Este equipo no exige verificación: cargá una calibración");
  const today = todayIso();
  const basicIssues = recordFieldIssues(
    { kind, performedAt: input.performedAt, labName: input.labName, traceability, basis: input.basis },
    today,
  ).filter((i) => i.field === "performedAt" || i.field === "labName");
  if (basicIssues.length > 0) throw issuesError(basicIssues);
  const certificateIssuedAt = clean(input.certificateIssuedAt);
  if (certificateIssuedAt && !isIsoDate(certificateIssuedAt)) throw new InspectionError("La fecha del certificado no es válida");
  const standardId = traceability === "in_house" ? clean(input.referenceStandardAssetId) : null;
  await requireReferenceStandard(db, input.tenantId, input.assetId, standardId);

  const statement = input.basis === "certificate_statement";
  if (statement && !input.labStatement) throw new InspectionError("Indicá si el certificado declara el equipo conforme o no conforme");
  const channelKeys = new Set(parseChannels(control.channels).map((c) => c.key));
  const adjusted = input.adjusted && !statement;
  const asFound = statement ? [] : readPoints(input.asFoundPoints, channelKeys, adjusted ? "Antes del ajuste" : "Puntos medidos");
  const asLeft = adjusted ? readPoints(input.asLeftPoints, channelKeys, "Después del ajuste") : [];
  const k = clean(input.coverageK);
  const coverage = k === null ? "2" : parseDecimal(k) !== null ? formatDecimal(parseDecimal(k)!) : null;
  if (coverage === null) throw new InspectionError("El factor de cobertura k debe ser un número");

  const data = {
    kind,
    performedAt: dateFromIso(input.performedAt),
    certificateNumber: clean(input.certificateNumber),
    certificateIssuedAt: certificateIssuedAt ? dateFromIso(certificateIssuedAt) : null,
    labName: input.labName.trim(),
    traceability,
    accreditationBody: traceability === "accredited_lab" ? clean(input.accreditationBody) : null,
    accreditationNumber: traceability === "accredited_lab" ? clean(input.accreditationNumber) : null,
    accreditationScopeCovers: traceability === "accredited_lab" ? (input.accreditationScopeCovers ?? false) : null,
    traceabilityBasis: traceability === "other_lab" ? clean(input.traceabilityBasis) : null,
    referenceStandardAssetId: standardId,
    conditions: clean(input.conditions),
    adjusted,
    basis: input.basis,
    labStatement: statement ? (input.labStatement ?? null) : null,
    labStatementSpec: statement ? clean(input.labStatementSpec) : null,
    labDecisionRule: statement ? clean(input.labDecisionRule) : null,
    notes: clean(input.notes),
  };
  const pointRows = (stage: "as_found" | "as_left", rows: typeof asFound) =>
    rows.map((p, index) => ({
      tenantId: input.tenantId,
      stage,
      channelKey: p.channelKey,
      nominal: p.nominal,
      measured: p.measured,
      uncertainty: p.uncertainty,
      coverageK: p.uncertainty === null ? null : coverage,
      sortOrder: index,
    }));

  return db.$transaction(async (tx) => {
    let recordId = input.recordId ?? null;
    if (recordId) {
      const current = await tx.calibrationRecord.findFirst({ where: { id: recordId, tenantId: input.tenantId, assetId: input.assetId }, select: { status: true } });
      if (!current) throw new InspectionError("Registro no encontrado");
      if (current.status !== "draft") throw new InspectionError("El registro ya está cerrado: no se edita. Anulalo con un motivo y cargá uno nuevo");
      await tx.calibrationRecord.update({ where: { id: recordId }, data });
      await tx.calibrationPoint.deleteMany({ where: { recordId, tenantId: input.tenantId } });
    } else {
      const created = await tx.calibrationRecord.create({
        data: { ...data, tenantId: input.tenantId, assetId: input.assetId, status: "draft", ruleApplied: control.decisionRule, loadedByUserId: input.actorUserId },
        select: { id: true },
      });
      recordId = created.id;
      await writeAudit(tx, { tenantId: input.tenantId, entityType: "calibration_record", entityId: recordId, action: "create", actorUserId: input.actorUserId, summary: `Borrador de ${kind === "calibration" ? "calibración" : "verificación"} de ${asset.code}` });
    }
    const points = [...pointRows("as_found", asFound), ...pointRows("as_left", asLeft)];
    if (points.length > 0) await tx.calibrationPoint.createMany({ data: points.map((p) => ({ ...p, recordId: recordId as string })) });
    return { id: recordId };
  });
}

/** Descarta un borrador (y sus certificados). Un registro cerrado no se borra: se anula. */
export async function discardCalibrationDraft(input: { tenantId: string; actorUserId: string; recordId: string }, db: PrismaClient = prisma, storage: ObjectStorage = getObjectStorage()) {
  const record = await db.calibrationRecord.findFirst({
    where: { id: input.recordId, tenantId: input.tenantId },
    include: { attachments: { select: { storageKey: true } }, asset: { select: { code: true } } },
  });
  if (!record) throw new InspectionError("Registro no encontrado");
  if (record.status !== "draft") throw new InspectionError("Solo se descartan borradores: un registro cerrado se anula con un motivo");
  await db.$transaction(async (tx) => {
    await tx.calibrationRecord.delete({ where: { id: record.id } });
    await writeAudit(tx, { tenantId: input.tenantId, entityType: "calibration_record", entityId: record.id, action: "discard", actorUserId: input.actorUserId, summary: `Borrador descartado de ${record.asset.code}` });
  });
  await Promise.all(record.attachments.map((a) => storage.deleteObject(a.storageKey).catch(() => undefined)));
}

// ─── Cierre ────────────────────────────────────────────────────────────────

/**
 * Cierra el borrador: calcula el resultado de los puntos (nadie lo tipea), guarda error, EMP y motivo por punto,
 * la regla aplicada y la vigencia, y recalcula el estado del equipo. Un registro cerrado ya no se edita.
 */
export async function closeCalibrationRecord(input: { tenantId: string; actorUserId: string; recordId: string }, db: PrismaClient = prisma) {
  const record = await db.calibrationRecord.findFirst({
    where: { id: input.recordId, tenantId: input.tenantId },
    include: { points: { orderBy: [{ stage: "asc" }, { sortOrder: "asc" }] }, _count: { select: { attachments: true } } },
  });
  if (!record) throw new InspectionError("Registro no encontrado");
  if (record.status !== "draft") throw new InspectionError("El registro ya está cerrado");
  const { asset, control } = await loadInstrument(db, input.tenantId, record.assetId);
  if (asset.status === "retired") throw new InspectionError("El equipo está dado de baja");

  const performedAt = isoFromDate(record.performedAt);
  const fields = {
    kind: record.kind,
    performedAt,
    labName: record.labName,
    traceability: record.traceability,
    accreditationBody: record.accreditationBody,
    accreditationNumber: record.accreditationNumber,
    accreditationScopeCovers: record.accreditationScopeCovers,
    traceabilityBasis: record.traceabilityBasis,
    referenceStandardAssetId: record.referenceStandardAssetId,
    basis: record.basis,
  } as const;
  const issues = [...recordFieldIssues(fields, todayIso(), record.assetId), ...closeIssues({ ...fields, attachmentCount: record._count.attachments })];
  if (issues.length > 0) throw issuesError(issues);

  const channels = parseChannels(control.channels);
  const toInput = (p: (typeof record.points)[number]): PointInput => ({
    channelKey: p.channelKey,
    nominal: p.nominal.toString(),
    measured: p.measured.toString(),
    uncertainty: p.uncertainty === null ? null : p.uncertainty.toString(),
  });
  const asFound = record.points.filter((p) => p.stage === "as_found");
  const asLeft = record.points.filter((p) => p.stage === "as_left");
  const outcome = computeRecordOutcome({
    control: {
      decisionRule: control.decisionRule,
      decisionRuleReason: control.decisionRuleReason,
      criticalUse: control.criticalUse,
      channels,
      calibrationIntervalMonths: control.calibrationIntervalMonths,
      verificationIntervalMonths: control.verificationIntervalMonths,
    },
    kind: record.kind,
    performedAt,
    basis: record.basis,
    adjusted: record.adjusted,
    asFoundPoints: asFound.map(toInput),
    asLeftPoints: asLeft.map(toInput),
    labStatement: record.labStatement ? { statement: record.labStatement, spec: record.labStatementSpec, decisionRule: record.labDecisionRule } : null,
  });
  if (!outcome.complete || outcome.asLeftResult === null || outcome.asFoundResult === null) {
    const reasons = [...new Set(outcome.incompleteReasons.map((r) => r.message))];
    throw new InspectionError(reasons.length > 0 ? `Faltan datos para cerrar: ${reasons.join(" · ")}` : "Faltan datos para calcular el resultado", "incomplete", outcome.incompleteReasons);
  }
  // Una verificación interna solo vale si el patrón estaba vigente ese día (trazabilidad, SPEC decisión 17).
  if (record.traceability === "in_house" && record.referenceStandardAssetId && outcome.asLeftResult === "apt") {
    const standard = await checkInstrumentForUse(input.tenantId, record.referenceStandardAssetId, { onDate: performedAt }, db);
    if (!standard.usable) {
      throw new InspectionError(`No se puede cerrar como apta: el patrón no estaba vigente al ${performedAt.split("-").reverse().join("/")}${standard.reason ? ` (${standard.reason})` : ""}`);
    }
  }

  const stored = (rule: typeof outcome.ruleApplied, rows: typeof asFound) => evaluateStoredPoints(rule, channels, rows.map(toInput)).map((r, i) => ({ id: rows[i].id, r }));
  return db.$transaction(async (tx) => {
    const claimed = await tx.calibrationRecord.updateMany({
      where: { id: record.id, tenantId: input.tenantId, status: "draft" },
      data: {
        status: "closed",
        closedAt: new Date(),
        ruleApplied: outcome.ruleApplied,
        ruleReasonApplied: outcome.ruleReasonApplied,
        asFoundResult: outcome.asFoundResult,
        asLeftResult: outcome.asLeftResult,
        intervalMonthsApplied: outcome.intervalMonthsApplied,
        validUntil: outcome.validUntil ? dateFromIso(outcome.validUntil) : null,
      },
    });
    if (claimed.count !== 1) throw new InspectionError("El registro ya fue cerrado");
    for (const { id, r } of [...stored(outcome.ruleApplied, asFound), ...stored(outcome.ruleApplied, asLeft)]) {
      if (!r) continue;
      await tx.calibrationPoint.update({
        where: { id },
        data: { error: r.error, empApplied: r.emp, unit: r.unit, ok: r.ok, reason: r.reason },
      });
    }
    await afterRecordChange(tx, { tenantId: input.tenantId, actorUserId: input.actorUserId, assetId: record.assetId });
    await writeAudit(tx, {
      tenantId: input.tenantId,
      entityType: "calibration_record",
      entityId: record.id,
      action: "close",
      actorUserId: input.actorUserId,
      summary: `${record.kind === "calibration" ? "Calibración" : "Verificación"} de ${asset.code} cerrada: ${outcome.asLeftResult === "apt" ? "apto" : "no apto"}`,
    });
    return { id: record.id, assetId: record.assetId, outcome };
  });
}

/** Lo que hay que recalcular cuando cambia un registro, un envío o una evaluación de impacto. */
async function afterRecordChange(tx: Tx, input: { tenantId: string; actorUserId: string; assetId: string }) {
  await recomputeInstrumentControl(input.tenantId, input.assetId, tx);
}

/** Anula un registro cerrado con un motivo. Se conserva en el historial pero no cuenta en ningún cálculo. */
export async function voidCalibrationRecord(input: { tenantId: string; actorUserId: string; recordId: string; reason: string }, db: PrismaClient = prisma) {
  const reason = input.reason.trim();
  if (reason.length < 5) throw new InspectionError("Indicá el motivo de la anulación (al menos 5 caracteres)");
  const record = await db.calibrationRecord.findFirst({ where: { id: input.recordId, tenantId: input.tenantId }, include: { asset: { select: { code: true } } } });
  if (!record) throw new InspectionError("Registro no encontrado");
  if (record.status !== "closed") throw new InspectionError(record.status === "draft" ? "Un borrador se descarta, no se anula" : "El registro ya está anulado");
  return db.$transaction(async (tx) => {
    const claimed = await tx.calibrationRecord.updateMany({
      where: { id: record.id, tenantId: input.tenantId, status: "closed" },
      data: { status: "voided", voidReason: reason, voidedByUserId: input.actorUserId, voidedAt: new Date() },
    });
    if (claimed.count !== 1) throw new InspectionError("El registro ya fue anulado");
    await afterRecordChange(tx, { tenantId: input.tenantId, actorUserId: input.actorUserId, assetId: record.assetId });
    await writeAudit(tx, { tenantId: input.tenantId, entityType: "calibration_record", entityId: record.id, action: "void", actorUserId: input.actorUserId, summary: `Registro de ${record.asset.code} anulado: ${reason}` });
    return { id: record.id, assetId: record.assetId };
  });
}

// ─── Certificados ──────────────────────────────────────────────────────────

export function buildCalibrationAttachmentStorageKey(input: { tenantId: string; assetId: string; recordId: string; attachmentId: string; fileName: string }): string {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `tenants/${input.tenantId}/calibration/${input.assetId}/${input.recordId}/${input.attachmentId}/${safeName}`;
}

/** Adjunta el certificado a un borrador. Mismos tipos de archivo y tope que los adjuntos de hallazgos. */
export async function uploadCalibrationCertificate(
  input: { tenantId: string; recordId: string; fileName: string; contentType: string; body: Buffer; uploadedById: string },
  options: { db?: PrismaClient; storage?: ObjectStorage } = {},
) {
  const db = options.db ?? prisma;
  const storage = options.storage ?? getObjectStorage();
  const record = await db.calibrationRecord.findFirst({
    where: { id: input.recordId, tenantId: input.tenantId },
    select: { id: true, assetId: true, status: true, _count: { select: { attachments: true } } },
  });
  if (!record) throw new InspectionError("Registro no encontrado");
  if (record.status !== "draft") throw new InspectionError("El registro está cerrado: no admite más archivos");
  if (record._count.attachments >= MAX_CERTIFICATES) throw new InspectionError(`Hasta ${MAX_CERTIFICATES} archivos por registro`);
  const contentType = resolveUploadContentType(input.contentType, input.fileName);
  if (!isAllowedUploadContentType(contentType)) throw new InspectionError(`Tipo de archivo no permitido: ${input.contentType || input.fileName}`);
  if (input.body.length === 0) throw new InspectionError("El archivo está vacío");
  if (input.body.length > MAX_CERTIFICATE_BYTES) throw new InspectionError("El archivo supera el máximo de 15 MB");

  const attachment = await db.calibrationAttachment.create({
    data: { tenantId: input.tenantId, recordId: record.id, storageKey: "pending", fileName: input.fileName, contentType, sizeBytes: input.body.length, uploadedById: input.uploadedById },
  });
  const storageKey = buildCalibrationAttachmentStorageKey({ tenantId: input.tenantId, assetId: record.assetId, recordId: record.id, attachmentId: attachment.id, fileName: input.fileName });
  try {
    await storage.putObject(storageKey, input.body, contentType);
  } catch (error) {
    await db.calibrationAttachment.delete({ where: { id: attachment.id } });
    throw error;
  }
  return db.calibrationAttachment.update({ where: { id: attachment.id }, data: { storageKey } });
}

export async function removeCalibrationCertificate(input: { tenantId: string; attachmentId: string }, db: PrismaClient = prisma, storage: ObjectStorage = getObjectStorage()) {
  const attachment = await db.calibrationAttachment.findFirst({ where: { id: input.attachmentId, tenantId: input.tenantId }, include: { record: { select: { status: true } } } });
  if (!attachment) throw new InspectionError("Archivo no encontrado");
  if (attachment.record.status !== "draft") throw new InspectionError("El registro está cerrado: no se quitan sus archivos");
  await db.calibrationAttachment.delete({ where: { id: attachment.id } });
  await storage.deleteObject(attachment.storageKey).catch(() => undefined);
  return { recordId: attachment.recordId };
}

// ─── Envío a calibrar ──────────────────────────────────────────────────────

/** El equipo sale al laboratorio: pasa a «en calibración» hasta que se registre su regreso. */
export async function sendInstrumentToCalibration(
  input: { tenantId: string; actorUserId: string; assetId: string; sentAt: string; expectedReturnAt?: string | null; labName?: string | null },
  db: PrismaClient = prisma,
) {
  const { asset } = await loadInstrument(db, input.tenantId, input.assetId);
  if (asset.status === "retired") throw new InspectionError("El equipo está dado de baja");
  const today = todayIso();
  if (!isIsoDate(input.sentAt)) throw new InspectionError("Indicá la fecha de envío");
  if (input.sentAt > today) throw new InspectionError("La fecha de envío no puede ser futura");
  const expected = clean(input.expectedReturnAt);
  if (expected && (!isIsoDate(expected) || expected < input.sentAt)) throw new InspectionError("El regreso estimado no puede ser anterior al envío");
  return db.$transaction(async (tx) => {
    if (await tx.instrumentShipment.findFirst({ where: { tenantId: input.tenantId, assetId: input.assetId, returnedAt: null }, select: { id: true } })) {
      throw new InspectionError("El equipo ya está en el laboratorio: registrá primero su regreso");
    }
    const shipment = await tx.instrumentShipment.create({
      data: { tenantId: input.tenantId, assetId: input.assetId, sentAt: dateFromIso(input.sentAt), expectedReturnAt: expected ? dateFromIso(expected) : null, labName: clean(input.labName), createdByUserId: input.actorUserId },
    });
    await afterRecordChange(tx, { tenantId: input.tenantId, actorUserId: input.actorUserId, assetId: input.assetId });
    await writeAudit(tx, { tenantId: input.tenantId, entityType: "instrument", entityId: input.assetId, action: "ship", actorUserId: input.actorUserId, summary: `${asset.code} enviado a calibrar${clean(input.labName) ? ` (${clean(input.labName)})` : ""}` });
    return shipment;
  });
}

/** El equipo volvió. Devolverlo no cambia su estado de calibración: eso lo hace el registro cargado. */
export async function registerInstrumentReturn(input: { tenantId: string; actorUserId: string; assetId: string; returnedAt: string }, db: PrismaClient = prisma) {
  const { asset } = await loadInstrument(db, input.tenantId, input.assetId);
  if (!isIsoDate(input.returnedAt)) throw new InspectionError("Indicá la fecha de regreso");
  if (input.returnedAt > todayIso()) throw new InspectionError("La fecha de regreso no puede ser futura");
  return db.$transaction(async (tx) => {
    const open = await tx.instrumentShipment.findFirst({ where: { tenantId: input.tenantId, assetId: input.assetId, returnedAt: null }, orderBy: { sentAt: "desc" } });
    if (!open) throw new InspectionError("El equipo no figura en el laboratorio");
    if (input.returnedAt < isoFromDate(open.sentAt)) throw new InspectionError("El regreso no puede ser anterior al envío");
    const shipment = await tx.instrumentShipment.update({ where: { id: open.id }, data: { returnedAt: dateFromIso(input.returnedAt) } });
    await afterRecordChange(tx, { tenantId: input.tenantId, actorUserId: input.actorUserId, assetId: input.assetId });
    await writeAudit(tx, { tenantId: input.tenantId, entityType: "instrument", entityId: input.assetId, action: "return", actorUserId: input.actorUserId, summary: `${asset.code} regresó del laboratorio` });
    return shipment;
  });
}

// ─── Lectura para la pantalla de carga ─────────────────────────────────────

/** Un registro con sus puntos, para el formulario (borrador) o para verlo cerrado. */
export async function getCalibrationRecord(tenantId: string, assetId: string, recordId: string, db: Db = prisma) {
  const record = await db.calibrationRecord.findFirst({
    where: { id: recordId, tenantId, assetId },
    include: {
      points: { orderBy: [{ stage: "asc" }, { sortOrder: "asc" }] },
      attachments: { select: { id: true, fileName: true, contentType: true, sizeBytes: true }, orderBy: { createdAt: "asc" } },
      referenceStandard: { select: { id: true, code: true, description: true } },
    },
  });
  if (!record) return null;
  const user = await db.user.findUnique({ where: { id: record.loadedByUserId }, select: { name: true } });
  return { ...record, loadedByName: user?.name ?? "Usuario" };
}

export type CalibrationRecordDetail = NonNullable<Awaited<ReturnType<typeof getCalibrationRecord>>>;