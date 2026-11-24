/**
 * Seed complementario de demo: completa lo que el seed base (index.ts) deja vacío en las empresas
 * demo-patagonia y demo-sur. No borra nada; cada sección se salta si ya tiene datos.
 *   npm run db:seed:complemento
 */
import "dotenv/config";
import type { AuditItemResult, GapStatus, DocumentFate, IndicatorDirection, IndicatorFrequency, IndicatorKind, IsoStandard, ObjectiveStatus } from "@prisma/client";
import { MemoryEmailSender, setEmailSenderForTests } from "../../src/lib/mail";
import { uploadTenantDocument } from "../../src/lib/documents";
import { getObjectStorage } from "../../src/lib/storage";
import { measurementStatus, periodOf } from "../../src/domain/indicators/rules";
import { DEMO_DOMAIN, db, demoPdf, pick, step, stepReport } from "./kit";

const NOW = new Date();
const day = (offset: number) => new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate() + offset));
const monthStart = (offset: number) => new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + offset, 1));
const iso = (d: Date) => d.toISOString().slice(0, 10);

type Ctx = {
  id: string;
  slug: string;
  admin: string;
  userIds: string[];
  personIds: string[];
  siteIds: string[];
  vehicleIds: { id: string; code: string }[];
};

async function loadCtx(slug: string): Promise<Ctx | null> {
  const t = await db.tenant.findUnique({ where: { slug } });
  if (!t) return null;
  const members = await db.membership.findMany({ where: { tenantId: t.id }, include: { user: true }, orderBy: { createdAt: "asc" } });
  const admin = members.find((m) => m.role === "tenant_admin") ?? members[0];
  const people = await db.person.findMany({ where: { tenantId: t.id, status: "active" }, select: { id: true } });
  const sites = await db.site.findMany({ where: { tenantId: t.id }, select: { id: true } });
  const vehicles = await db.asset.findMany({ where: { tenantId: t.id, typeKey: { in: ["light_vehicle", "heavy_equipment"] } }, select: { id: true, code: true }, orderBy: { code: "asc" } });
  return {
    id: t.id,
    slug,
    admin: admin.userId,
    userIds: members.map((m) => m.userId),
    personIds: people.map((p) => p.id),
    siteIds: sites.map((s) => s.id),
    vehicleIds: vehicles,
  };
}

/* ------------------------------------------------------------------ Brechas ISO */

const GAP_NOTES: Record<GapStatus, string[]> = {
  pending: [],
  compliant: [
    "Procedimiento vigente y difundido; evidencia en el repositorio documental.",
    "Verificado en la última auditoría interna sin desvíos.",
    "Cubierto por el módulo correspondiente de la plataforma.",
    "Registro al día; revisado por la Dirección en la última revisión.",
  ],
  partial: [
    "Existe el procedimiento pero falta evidencia de aplicación en la Obra Loma Campana.",
    "Se cumple en la planta; falta extender el control a la base de Añelo.",
    "Documentado, pendiente de la firma de la Dirección.",
    "Registros incompletos en el último trimestre; plan de acción abierto.",
  ],
  missing: [
    "No existe procedimiento; se incluyó en el plan de documentación del próximo trimestre.",
    "Sin evidencia al momento del relevamiento; responsable asignado.",
    "Requisito nuevo por ampliación del alcance; se redactará el instructivo.",
  ],
  not_applicable: [
    "No aplica: la empresa no diseña ni desarrolla productos (exclusión justificada en el Manual).",
    "No aplica al alcance del SGI declarado.",
  ],
  automated: [
    "Lo resuelve la plataforma: vencimientos y avisos automáticos.",
    "Cubierto por el módulo de capacitaciones con trazabilidad de registros.",
    "Cubierto por el módulo de calibraciones con certificados adjuntos.",
  ],
};

async function seedGap(ctx: Ctx) {
  const reqs = await db.tenantRequirement.findMany({ where: { tenantId: ctx.id }, orderBy: { id: "asc" } });
  if (reqs.length === 0) return;
  if (reqs.filter((r) => r.status !== "pending").length > 5) return;
  const order: GapStatus[] = ["compliant", "compliant", "partial", "automated", "missing", "compliant", "not_applicable", "partial", "compliant", "pending", "automated", "missing"];
  const fates: DocumentFate[] = ["keep", "replace", "create", "undecided"];
  let i = 0;
  for (const r of reqs) {
    const status = pick(order, i);
    const notes = status === "pending" ? null : pick(GAP_NOTES[status], i);
    const hasDoc = status === "compliant" || status === "partial";
    const fate: DocumentFate = status === "not_applicable" || status === "pending" ? "undecided" : hasDoc ? pick(["keep", "replace", "keep"] as DocumentFate[], i) : "create";
    const assessedAt = day(-120 + i * 2);
    const actor = pick(ctx.userIds, i);
    await db.tenantRequirement.update({
      where: { id: r.id },
      data: { status, notes, hasClientDocument: hasDoc, documentFate: fate, assessedAt: status === "pending" ? null : assessedAt, assessedByUserId: status === "pending" ? null : actor },
    });
    if (status !== "pending") {
      // Historial: primero se marcó faltante o parcial y luego el estado final.
      if (status === "compliant" || status === "automated") {
        await db.gapAssessmentAudit.create({
          data: { tenantId: ctx.id, tenantRequirementId: r.id, userId: actor, previousStatus: "pending", newStatus: "missing", previousNotes: null, newNotes: "Relevamiento inicial: sin evidencia.", previousHasDocument: false, newHasDocument: false, previousDocumentFate: "undecided", newDocumentFate: "create", createdAt: new Date(assessedAt.getTime() - 40 * 86400000) },
        });
        await db.gapAssessmentAudit.create({
          data: { tenantId: ctx.id, tenantRequirementId: r.id, userId: actor, previousStatus: "missing", newStatus: status, previousNotes: "Relevamiento inicial: sin evidencia.", newNotes: notes, previousHasDocument: false, newHasDocument: hasDoc, previousDocumentFate: "create", newDocumentFate: fate, createdAt: assessedAt },
        });
      } else {
        await db.gapAssessmentAudit.create({
          data: { tenantId: ctx.id, tenantRequirementId: r.id, userId: actor, previousStatus: "pending", newStatus: status, previousNotes: null, newNotes: notes, previousHasDocument: false, newHasDocument: hasDoc, previousDocumentFate: "undecided", newDocumentFate: fate, createdAt: assessedAt },
        });
      }
    }
    i++;
  }
  void fates;
}

/* ------------------------------------------------------------------ Documentos */

const DOC_DEFS: { title: string; kind: string; fate: DocumentFate; validMonths: number | null; versions: number }[] = [
  { title: "Política Integrada de Gestión", kind: "policy", fate: "keep", validMonths: 12, versions: 3 },
  { title: "Manual del Sistema de Gestión Integrado", kind: "manual", fate: "replace", validMonths: 24, versions: 2 },
  { title: "Procedimiento de Control de Documentos y Registros", kind: "procedure", fate: "keep", validMonths: 18, versions: 2 },
  { title: "Procedimiento de Auditorías Internas", kind: "procedure", fate: "keep", validMonths: 18, versions: 1 },
  { title: "Procedimiento de Acciones Correctivas y Preventivas", kind: "procedure", fate: "replace", validMonths: 6, versions: 2 },
  { title: "Procedimiento de Identificación de Peligros y Evaluación de Riesgos", kind: "procedure", fate: "create", validMonths: 12, versions: 1 },
  { title: "Procedimiento de Trabajo en Altura", kind: "procedure", fate: "keep", validMonths: 3, versions: 3 },
  { title: "Procedimiento de Espacios Confinados", kind: "procedure", fate: "keep", validMonths: -2, versions: 2 },
  { title: "Instructivo de Izaje de Cargas", kind: "instruction", fate: "keep", validMonths: 1, versions: 1 },
  { title: "Instructivo de Manejo de Sustancias Químicas", kind: "instruction", fate: "replace", validMonths: 9, versions: 1 },
  { title: "Plan de Respuesta ante Emergencias", kind: "plan", fate: "keep", validMonths: 12, versions: 2 },
  { title: "Plan de Gestión de Residuos Peligrosos", kind: "plan", fate: "create", validMonths: -1, versions: 1 },
  { title: "Matriz de Aspectos e Impactos Ambientales", kind: "matrix", fate: "keep", validMonths: 12, versions: 2 },
  { title: "Registro de Entrega de EPP", kind: "record", fate: "keep", validMonths: null, versions: 1 },
  { title: "Formulario de Reporte de Incidentes", kind: "form", fate: "keep", validMonths: null, versions: 2 },
  { title: "Acta de Revisión por la Dirección 2025", kind: "record", fate: "keep", validMonths: null, versions: 1 },
  { title: "Procedimiento de Evaluación de Proveedores", kind: "procedure", fate: "replace", validMonths: 14, versions: 1 },
  { title: "Procedimiento de Gestión Vial y Conducción Segura", kind: "procedure", fate: "create", validMonths: 11, versions: 1 },
  { title: "Programa Anual de Capacitación", kind: "plan", fate: "keep", validMonths: 7, versions: 2 },
  { title: "Procedimiento de Calibración de Instrumentos", kind: "procedure", fate: "keep", validMonths: 20, versions: 1 },
];

/** Los tipos de la demo (instructivo, plan, matriz…) se guardan con los tipos de documento de la plataforma. */
const DOC_KIND: Record<string, "manual" | "policy" | "record_blank" | "record_managed" | "procedure"> = {
  manual: "manual",
  policy: "policy",
  procedure: "procedure",
  instruction: "procedure",
  plan: "procedure",
  matrix: "record_managed",
  record: "record_managed",
  form: "record_blank",
};

async function seedDocuments(ctx: Ctx, defs: typeof DOC_DEFS) {
  if ((await db.document.count({ where: { tenantId: ctx.id } })) > 0) return;
  const reqs = await db.tenantRequirement.findMany({ where: { tenantId: ctx.id }, select: { id: true }, orderBy: { id: "asc" }, take: defs.length });
  let i = 0;
  for (const d of defs) {
    const validUntil = d.validMonths === null ? null : day(Math.round(d.validMonths * 30));
    const uploaderId = pick(ctx.userIds, i);
    const first = await uploadTenantDocument({
      tenantId: ctx.id,
      title: d.title,
      kind: DOC_KIND[d.kind] ?? "procedure",
      fate: d.fate,
      tenantRequirementId: reqs[i]?.id ?? null,
      validFrom: day(-400 + i * 5),
      validUntil,
      fileName: `${d.title.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 50)}-v1.pdf`,
      contentType: "application/pdf",
      body: demoPdf(`${d.title} v1`),
      uploadedById: uploaderId,
      notes: "Versión inicial aprobada por la Dirección.",
      isPlatformSuperuser: true,
    });
    for (let v = 2; v <= d.versions; v++) {
      await uploadTenantDocument({
        tenantId: ctx.id,
        title: d.title,
        documentId: first.id,
        forceOverwriteKeep: true,
        fileName: `${d.title.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 50)}-v${v}.pdf`,
        contentType: "application/pdf",
        body: demoPdf(`${d.title} v${v}`),
        uploadedById: pick(ctx.userIds, i + v),
        notes: pick(["Actualización por cambio de alcance.", "Revisión anual: se ajustan responsables.", "Se incorporan hallazgos de la auditoría interna."], i + v),
        isPlatformSuperuser: true,
        validFrom: day(-200 + v * 10),
        validUntil,
        fate: d.fate,
        kind: DOC_KIND[d.kind] ?? "procedure",
      });
    }
    i++;
  }
}

/* ------------------------------------------------------------------ Objetivos, indicadores y mediciones */

type IndDef = {
  name: string;
  formula: string;
  unit: string;
  direction: IndicatorDirection;
  target: number;
  frequency: IndicatorFrequency;
  kind: IndicatorKind;
  /** valores de los últimos períodos, del más viejo al más nuevo */
  values: number[];
  safetyMetric?: "if" | "ig" | "ii" | "id";
};
type ObjDef = {
  title: string;
  description: string;
  standards: IsoStandard[];
  status: ObjectiveStatus;
  dueMonths: number;
  steps: { what: string; months: number }[];
  resources: string;
  evaluation: string;
  closingNote?: string;
  indicators: IndDef[];
};

const OBJECTIVES_A: ObjDef[] = [
  {
    title: "Reducir la accidentabilidad con baja",
    description: "Bajar el índice de frecuencia por debajo de 8 en las tres sedes operativas.",
    standards: ["ISO45001"],
    status: "active",
    dueMonths: 6,
    steps: [
      { what: "Inspecciones de seguridad semanales en obra", months: 1 },
      { what: "Capacitación en trabajo en altura al 100 % del personal expuesto", months: 3 },
      { what: "Revisar y relanzar el programa de reporte de casi accidentes", months: 4 },
    ],
    resources: "Horas del equipo HSE, presupuesto de capacitación, equipamiento",
    evaluation: "Con los indicadores del objetivo y la revisión mensual del responsable",
    indicators: [
      { name: "Índice de frecuencia (IF)", formula: "Accidentes con baja × 1.000.000 / horas trabajadas", unit: "índice", direction: "lower_better", target: 8, frequency: "monthly", kind: "lagging", values: [14.2, 12.8, 11.1, 9.6, 9.9, 8.7, 7.4, 7.9, 8.2, 6.8], safetyMetric: "if" },
      { name: "Inspecciones de seguridad realizadas", formula: "Inspecciones hechas / planificadas × 100", unit: "%", direction: "higher_better", target: 90, frequency: "monthly", kind: "leading", values: [72, 78, 81, 85, 88, 91, 93, 89, 94, 96] },
      { name: "Casi accidentes reportados", formula: "Cantidad de reportes del mes", unit: "reportes", direction: "higher_better", target: 12, frequency: "monthly", kind: "leading", values: [3, 4, 6, 8, 9, 11, 12, 14, 10, 13] },
    ],
  },
  {
    title: "Mejorar la satisfacción de los clientes",
    description: "Alcanzar un 90 % de satisfacción en las encuestas y reducir los reclamos.",
    standards: ["ISO9001"],
    status: "active",
    dueMonths: 8,
    steps: [
      { what: "Encuesta de satisfacción trimestral", months: 2 },
      { what: "Tablero de reclamos con responsables y plazo", months: 3 },
    ],
    resources: "Horas del equipo, software o sistema",
    evaluation: "En la revisión por la dirección",
    indicators: [
      { name: "Satisfacción del cliente", formula: "Promedio de encuestas / máximo × 100", unit: "%", direction: "higher_better", target: 90, frequency: "quarterly", kind: "lagging", values: [82, 85, 88, 91] },
      { name: "Reclamos de clientes", formula: "Cantidad de reclamos recibidos en el trimestre", unit: "reclamos", direction: "lower_better", target: 5, frequency: "quarterly", kind: "lagging", values: [11, 9, 7, 6] },
    ],
  },
  {
    title: "Reducir el consumo de combustible y residuos",
    description: "Reducir 10 % el consumo de combustible por hora-máquina y segregar el 80 % de los residuos.",
    standards: ["ISO14001"],
    status: "active",
    dueMonths: 10,
    steps: [
      { what: "Medición mensual del consumo por equipo", months: 1 },
      { what: "Instalar puntos de segregación en las tres sedes", months: 4 },
      { what: "Capacitar a los operadores en conducción eficiente", months: 6 },
    ],
    resources: "Presupuesto, capacitación, equipamiento",
    evaluation: "Con auditoría interna",
    indicators: [
      { name: "Consumo de combustible por hora-máquina", formula: "Litros consumidos / horas de uso", unit: "l/h", direction: "lower_better", target: 14, frequency: "monthly", kind: "lagging", values: [17.2, 16.8, 16.1, 15.9, 15.2, 14.8, 14.1, 13.7, 14.6, 15.4] },
      { name: "Residuos segregados", formula: "Residuos segregados / totales × 100", unit: "%", direction: "higher_better", target: 80, frequency: "monthly", kind: "leading", values: [40, 48, 55, 61, 66, 70, 74, 79, 82, 84] },
    ],
  },
  {
    title: "Cumplir el plan de capacitación anual",
    description: "Cumplir el 95 % del plan de capacitación y evaluar la eficacia de cada curso crítico.",
    standards: ["ISO9001", "ISO45001"],
    status: "active",
    dueMonths: 5,
    steps: [
      { what: "Programar las sesiones del año con anticipación", months: 1 },
      { what: "Evaluar la eficacia a los 60 días de cada curso", months: 4 },
    ],
    resources: "Horas del equipo, asesoramiento externo",
    evaluation: "Revisión mensual del responsable",
    indicators: [
      { name: "Cumplimiento del plan de capacitación", formula: "Sesiones realizadas / planificadas × 100", unit: "%", direction: "higher_better", target: 95, frequency: "quarterly", kind: "leading", values: [88, 92, 90, 96] },
      { name: "Horas de capacitación por persona", formula: "Horas totales / dotación", unit: "h", direction: "higher_better", target: 6, frequency: "quarterly", kind: "leading", values: [3.1, 4.2, 5.8, 6.4] },
    ],
  },
  {
    title: "Asegurar proveedores críticos evaluados",
    description: "Todos los proveedores críticos con evaluación vigente y documentación al día.",
    standards: ["ISO9001"],
    status: "active",
    dueMonths: 4,
    steps: [{ what: "Evaluar a los proveedores críticos sin evaluación vigente", months: 2 }],
    resources: "Horas del equipo",
    evaluation: "Con los indicadores del objetivo",
    indicators: [
      { name: "Proveedores críticos con evaluación vigente", formula: "Críticos evaluados / críticos totales × 100", unit: "%", direction: "higher_better", target: 100, frequency: "quarterly", kind: "leading", values: [60, 75, 88, 92] },
    ],
  },
  {
    title: "Reducir el tiempo de cierre de hallazgos",
    description: "Cerrar los hallazgos en menos de 45 días en promedio.",
    standards: ["ISO9001", "ISO14001", "ISO45001"],
    status: "achieved",
    dueMonths: -2,
    steps: [
      { what: "Fijar plazos por severidad", months: -10 },
      { what: "Seguimiento semanal de hallazgos vencidos", months: -8 },
    ],
    resources: "Horas del equipo",
    evaluation: "En la revisión por la dirección",
    closingNote: "Se alcanzó la meta en el segundo semestre: promedio de cierre de 38 días.",
    indicators: [
      { name: "Días promedio de cierre de hallazgos", formula: "Promedio de días entre detección y cierre", unit: "días", direction: "lower_better", target: 45, frequency: "semiannual", kind: "lagging", values: [71, 52, 38] },
    ],
  },
  {
    title: "Implantar el sistema de gestión de la seguridad vial",
    description: "Reducir los eventos viales con la flota propia y controlar los excesos de velocidad.",
    standards: ["ISO39001"],
    status: "not_achieved",
    dueMonths: -1,
    steps: [{ what: "Instalar telemetría en toda la flota liviana", months: -9 }],
    resources: "Presupuesto, equipamiento, software o sistema",
    evaluation: "Con auditoría interna",
    closingNote: "No se alcanzó: la telemetría se completó solo en el 60 % de la flota. Se reprograma para el próximo año.",
    indicators: [
      { name: "Eventos viales por millón de km", formula: "Eventos × 1.000.000 / km recorridos", unit: "eventos", direction: "lower_better", target: 2, frequency: "quarterly", kind: "lagging", values: [4.1, 3.6, 3.2, 3.4] },
    ],
  },
  {
    title: "Digitalizar los registros de calidad",
    description: "Pasar a la plataforma el 100 % de los registros en papel.",
    standards: ["ISO9001"],
    status: "cancelled",
    dueMonths: -3,
    steps: [{ what: "Relevar registros en papel", months: -8 }],
    resources: "Horas del equipo",
    evaluation: "Revisión mensual del responsable",
    closingNote: "Cancelado: se integró al objetivo de implantación de la plataforma del año siguiente.",
    indicators: [
      { name: "Registros digitalizados", formula: "Registros digitales / totales × 100", unit: "%", direction: "higher_better", target: 100, frequency: "quarterly", kind: "leading", values: [20, 35] },
    ],
  },
];

const OBJECTIVES_B: ObjDef[] = [
  {
    title: "Reducir las mermas de producción",
    description: "Bajar la merma de la línea de envasado por debajo del 2,5 %.",
    standards: ["ISO9001"],
    status: "active",
    dueMonths: 6,
    steps: [{ what: "Calibrar las envasadoras cada mes", months: 1 }, { what: "Capacitar a los operarios en ajuste de línea", months: 3 }],
    resources: "Horas del equipo, equipamiento",
    evaluation: "Con los indicadores del objetivo",
    indicators: [{ name: "Merma de envasado", formula: "Kg descartados / kg producidos × 100", unit: "%", direction: "lower_better", target: 2.5, frequency: "monthly", kind: "lagging", values: [4.2, 3.9, 3.4, 3.1, 2.8, 2.6, 2.4, 2.7] }],
  },
  {
    title: "Cumplir el programa de limpieza y sanitización",
    description: "Cumplir el 100 % de las limpiezas programadas en planta.",
    standards: ["ISO9001", "ISO45001"],
    status: "active",
    dueMonths: 7,
    steps: [{ what: "Registrar cada limpieza en planilla digital", months: 2 }],
    resources: "Horas del equipo",
    evaluation: "Revisión mensual del responsable",
    indicators: [{ name: "Limpiezas cumplidas", formula: "Realizadas / programadas × 100", unit: "%", direction: "higher_better", target: 100, frequency: "monthly", kind: "leading", values: [90, 94, 96, 100, 98, 100] }],
  },
];

async function seedObjectives(ctx: Ctx, defs: ObjDef[], withSafetyLinks: boolean) {
  if ((await db.objective.count({ where: { tenantId: ctx.id } })) > 0) return;
  const year = NOW.getUTCFullYear();
  let seq = 1;
  let ownerI = 0;
  for (const o of defs) {
    const owner = pick(ctx.userIds, ownerI++);
    const objective = await db.objective.create({
      data: {
        tenantId: ctx.id,
        code: `OBJ-${year}-${String(seq++).padStart(2, "0")}`,
        title: o.title,
        description: o.description,
        standards: o.standards,
        ownerUserId: owner,
        dueDate: day(o.dueMonths * 30),
        planSteps: o.steps.map((s, k) => ({ what: s.what, ownerUserId: pick(ctx.userIds, ownerI + k), dueDate: iso(day(s.months * 30)) })),
        plan: o.steps.map((s) => s.what).join("; "),
        planResources: o.resources,
        planEvaluation: o.evaluation,
        status: o.status,
        closingNote: o.closingNote ?? null,
        closedAt: o.status === "active" ? null : day(o.dueMonths * 30 + 5),
        createdByUserId: ctx.admin,
        createdAt: day(-300),
      },
    });
    for (const ind of o.indicators) {
      const indicator = await db.indicator.create({
        data: {
          tenantId: ctx.id,
          objectiveId: objective.id,
          name: ind.name,
          formula: ind.formula,
          unit: ind.unit,
          direction: ind.direction,
          target: ind.target,
          alertThreshold: Math.round((ind.direction === "higher_better" ? ind.target * 1.05 : ind.target * 0.95) * 100) / 100,
          frequency: ind.frequency,
          kind: ind.kind,
          ownerUserId: pick(ctx.userIds, ownerI++),
          active: o.status === "active" || o.status === "achieved",
        },
      });
      const def = { direction: ind.direction, target: ind.target, alertThreshold: indicator.alertThreshold };
      // El último valor cae en el período anterior al actual (el actual aún no venció).
      const months = ind.frequency === "monthly" ? 1 : ind.frequency === "quarterly" ? 3 : ind.frequency === "semiannual" ? 6 : 12;
      const lastPeriod = periodOf(ind.frequency, new Date(periodOf(ind.frequency, NOW).start.getTime() - 1));
      for (let k = 0; k < ind.values.length; k++) {
        const back = ind.values.length - 1 - k;
        const start = new Date(Date.UTC(lastPeriod.start.getUTCFullYear(), lastPeriod.start.getUTCMonth() - back * months, 1));
        const p = periodOf(ind.frequency, start);
        const value = ind.values[k];
        const status = measurementStatus(def, value);
        const st = status === "no_data" ? "on_target" : status;
        const m = await db.measurement.create({
          data: {
            tenantId: ctx.id,
            indicatorId: indicator.id,
            periodKey: p.key,
            periodStart: p.start,
            value,
            status: st,
            analysis: st === "on_target" ? (k % 3 === 0 ? "Dentro de la meta; se mantienen las acciones del plan." : null) : st === "alert" ? "En alerta: se refuerza el seguimiento semanal y se revisa el plan." : "Fuera de meta: se abrió un hallazgo y se definió una acción correctiva con responsable.",
            recordedByUserId: indicator.ownerUserId,
            recordedAt: new Date(p.end.getTime() + 3 * 86400000),
          },
        });
        if (k === 2 || (ind.values.length > 6 && k === 6)) {
          await db.measurementCorrection.create({
            data: { tenantId: ctx.id, measurementId: m.id, previousValue: value + 1, newValue: value, reason: "Error de carga: se había tomado el período anterior.", byUserId: ctx.admin, createdAt: new Date(p.end.getTime() + 6 * 86400000) },
          });
        }
      }
      if (withSafetyLinks && ind.safetyMetric) {
        await db.safetyIndicatorLink.create({ data: { tenantId: ctx.id, metric: ind.safetyMetric, indicatorId: indicator.id } });
      }
    }
  }
}

/* ------------------------------------------------------------------ Riesgos y oportunidades */

const RISKS_EXTRA = [
  { title: "Incendio en el depósito de materiales inflamables", status: "response_planned", cause: "Almacenamiento conjunto de solventes y pinturas sin separación", event: "Ignición por chispa o calor", effect: "Daño a personas, pérdida de materiales y paralización de la planta", controls: ["Matafuegos con control mensual", "Prohibición de fuego abierto"], decision: "mitigate", p: 3, i: 5, source: "process" },
  { title: "Falta de energía eléctrica en la Planta Centenario", status: "monitored", cause: "Cortes frecuentes de la red en el parque industrial", event: "Corte de más de 4 horas", effect: "Pérdida de producción y atrasos en las entregas", controls: ["Grupo electrógeno de respaldo"], decision: "mitigate", p: 4, i: 3, source: "process" },
  { title: "Rotación de personal clave en HSE", status: "evaluated", cause: "Oferta salarial de otras empresas del sector", event: "Renuncia de técnicos de seguridad", effect: "Pérdida de conocimiento y demoras en inspecciones", controls: [], decision: null, p: 3, i: 4, source: "stakeholder" },
  { title: "Vuelco de vehículos pesados en ruta de yacimiento", status: "implementing", cause: "Camino de ripio y fatiga del conductor", event: "Vuelco de camión o equipo", effect: "Lesiones graves y daño ambiental", controls: ["Límites de velocidad", "Descansos programados", "Telemetría"], decision: "mitigate", p: 3, i: 5, source: "finding" },
  { title: "Vencimiento de calibraciones de equipos de medición", status: "effectiveness_review", cause: "Falta de control centralizado de vencimientos", event: "Uso de instrumentos fuera de calibración", effect: "Mediciones no confiables y no conformidades", controls: ["Alertas automáticas de la plataforma"], decision: "mitigate", p: 2, i: 4, source: "indicator" },
  { title: "Incumplimiento de requisitos legales ambientales", status: "analyzing", cause: "Cambios de normativa provincial no relevados", event: "Inspección de la autoridad ambiental", effect: "Multas y suspensión de actividades", controls: ["Matriz legal anual"], decision: null, p: 2, i: 5, source: "change" },
  { title: "Dependencia de un único proveedor de arena", status: "response_planned", cause: "Un solo proveedor homologado en la zona", event: "Interrupción del suministro", effect: "Atraso de obras", controls: [], decision: "mitigate", p: 3, i: 3, source: "supplier" },
  { title: "Fallas de comunicación en el campamento Sauzal", status: "closed", cause: "Sin cobertura celular estable", event: "Emergencia sin comunicación", effect: "Demora en respuesta a emergencias", controls: ["Radios VHF"], decision: "mitigate", p: 2, i: 4, source: "other", close: "Se instaló un enlace satelital y se verificó con simulacro." },
  { title: "Pérdida de información por falla de servidores", status: "identified", cause: "Sin copias de seguridad verificadas", event: "Falla de disco", effect: "Pérdida de registros", controls: [], decision: null, p: null, i: null, source: "other" },
  { title: "Contaminación de suelo por pérdidas de mangueras hidráulicas", status: "monitored", cause: "Mangueras con desgaste en equipos pesados", event: "Derrame de aceite hidráulico", effect: "Pasivo ambiental", controls: ["Kit antiderrame en cada equipo", "Inspección diaria"], decision: "retain", p: 3, i: 3, source: "process" },
];

const OPPS = [
  { title: "Reutilizar el agua de lavado de equipos", status: "pursuing", cond: "El lavado de equipos descarga agua tratable", circ: "Escasez de agua en la zona", benefit: "Menor consumo y costo; mejor imagen ambiental", source: "process", decision: "pursue_now", expected: "Reducir 30 % el consumo de agua", observed: null, level: "high" },
  { title: "Certificar en ISO 39001 para licitaciones petroleras", status: "decision", cond: "Los operadores valoran la gestión vial", circ: "Nuevos pliegos con requisitos de seguridad vial", benefit: "Acceso a contratos de mayor valor", source: "stakeholder", decision: "pursue_later", expected: "Sumar 2 contratos nuevos", observed: null, level: "high" },
  { title: "Telemetría para optimizar rutas de la flota", status: "implementing", cond: "Datos de GPS sin explotar", circ: "Costo del combustible en aumento", benefit: "Ahorro de combustible y menos km", source: "indicator", decision: "pursue_now", expected: "Reducir 8 % los km", observed: null, level: "medium" },
  { title: "Programa de reciclado de chatarra metálica", status: "realized", cond: "La obra genera chatarra que se vende como residuo", circ: "Mayor precio del acero", benefit: "Ingreso extra y menos residuos", source: "process", decision: "pursue_now", expected: "Recuperar 2 toneladas por mes", observed: "Se recuperaron 2,4 toneladas por mes durante el semestre.", level: "high" },
  { title: "Capacitación cruzada de operadores de grúa", status: "benefit_review", cond: "Pocos operadores habilitados", circ: "Picos de demanda de izajes", benefit: "Cobertura de turnos y menor riesgo operativo", source: "objective", decision: "pursue_now", expected: "Duplicar la cantidad de operadores habilitados", observed: "Se habilitaron 3 operadores más.", level: "medium" },
  { title: "Energía solar en el campamento Sauzal", status: "analyzing", cond: "Alta radiación solar", circ: "Subsidios provinciales a energías renovables", benefit: "Ahorro de gasoil del generador", source: "other", decision: null, expected: null, observed: null, level: "medium" },
  { title: "Alianza con proveedor local de EPP", status: "evaluated", cond: "Demoras en la compra de EPP", circ: "Proveedor nuevo en Neuquén", benefit: "Entrega en 48 horas y menor stock", source: "supplier", decision: "investigate", expected: "Reducir el stock inmovilizado", observed: null, level: "low" },
  { title: "Tablero de indicadores para clientes", status: "discovered", cond: "Los clientes piden informes de desempeño", circ: "Auditorías de clientes más frecuentes", benefit: "Mayor confianza y fidelización", source: "stakeholder", decision: null, expected: null, observed: null, level: null },
  { title: "Reutilizar el material de excavación en rellenos", status: "closed", cond: "Se descarta material apto", circ: "Costo de transporte a disposición final", benefit: "Ahorro de transporte", source: "process", decision: "do_not_pursue", expected: null, observed: null, level: "low", close: "Se descartó: el material no cumple la compactación requerida." },
  { title: "Programa de pasantías con la escuela técnica de Añelo", status: "pursuing", cond: "Falta de técnicos locales", circ: "Convenio provincial de empleo joven", benefit: "Cantera de personal capacitado", source: "stakeholder", decision: "pursue_now", expected: "Incorporar 4 técnicos por año", observed: null, level: "medium" },
];

async function seedRisksAndOpps(ctx: Ctx, extraRisks: boolean) {
  if (extraRisks && (await db.risk.count({ where: { tenantId: ctx.id } })) < 6) {
    let i = 0;
    for (const r of RISKS_EXTRA) {
      const risk = await db.risk.create({
        data: {
          tenantId: ctx.id,
          title: r.title,
          status: r.status as never,
          cause: r.cause,
          event: r.event,
          effect: r.effect,
          existingControlsJson: r.controls,
          sourceKind: r.source as never,
          sourceLabel: pick(["Relevamiento de procesos", "Auditoría interna AI-2026-01", "Reunión de Dirección", "Reclamo de cliente", "Inspección de campo"], i),
          responseDecision: (r.decision ?? null) as never,
          responseRationale: r.decision ? "Se definió el tratamiento junto al responsable del proceso." : null,
          responseOwnerUserId: r.decision ? pick(ctx.userIds, i) : null,
          nextReviewAt: r.status === "closed" ? null : day(30 + i * 20),
          closeReason: r.status === "closed" ? "mitigated" : null,
          closeRationale: "close" in r ? r.close : null,
          createdByUserId: ctx.admin,
          createdAt: day(-250 + i * 12),
        },
      });
      if (r.p && r.i) {
        const score = r.p * r.i;
        await db.riskAssessment.create({
          data: { tenantId: ctx.id, riskId: risk.id, version: 1, method: "probability_impact", resultJson: { probability: r.p, impact: r.i, score }, rationale: "Valoración inicial con el responsable del proceso.", assessedById: ctx.admin, assessedAt: day(-200 + i * 10) },
        });
        if (i % 3 === 0) {
          await db.riskAssessment.create({
            data: { tenantId: ctx.id, riskId: risk.id, version: 2, method: "probability_impact", resultJson: { probability: Math.max(1, r.p - 1), impact: r.i, score: Math.max(1, r.p - 1) * r.i }, rationale: "Reevaluación tras implementar los controles.", assessedById: ctx.admin, assessedAt: day(-40 + i) },
          });
        }
      }
      i++;
    }
  }
  if ((await db.opportunity.count({ where: { tenantId: ctx.id } })) > 0) return;
  let i = 0;
  for (const o of OPPS) {
    const opp = await db.opportunity.create({
      data: {
        tenantId: ctx.id,
        title: o.title,
        status: o.status as never,
        condition: o.cond,
        circumstance: o.circ,
        benefit: o.benefit,
        sourceKind: o.source as never,
        sourceLabel: pick(["Revisión por la Dirección", "Reunión comercial", "Relevamiento de procesos", "Análisis de indicadores", "Visita a un cliente"], i),
        pursuitDecision: (o.decision ?? null) as never,
        pursuitRationale: o.decision ? "Evaluado por el comité con costo, beneficio y capacidad disponible." : null,
        pursuitOwnerUserId: o.decision ? pick(ctx.userIds, i) : null,
        benefitExpected: o.expected,
        benefitObserved: o.observed,
        nextReviewAt: o.status === "closed" || o.status === "realized" ? null : day(25 + i * 15),
        closeRationale: "close" in o ? o.close : null,
        createdByUserId: ctx.admin,
        createdAt: day(-220 + i * 14),
      },
    });
    if (o.level) {
      await db.opportunityAssessment.create({
        data: { tenantId: ctx.id, opportunityId: opp.id, version: 1, method: "qualitative", resultJson: { level: o.level }, rationale: "Valoración cualitativa según impacto en el negocio y facilidad de implementación.", assessedById: ctx.admin, assessedAt: day(-150 + i * 8) },
      });
      if (i % 2 === 0) {
        const probability = 3 + (i % 3);
        const impact = 3 + ((i + 1) % 3);
        await db.opportunityAssessment.create({
          data: { tenantId: ctx.id, opportunityId: opp.id, version: 2, method: "probability_impact", resultJson: { probability, impact, score: probability * impact }, rationale: "Reevaluación con datos del piloto.", assessedById: ctx.admin, assessedAt: day(-60 + i * 3) },
        });
      }
    }
    i++;
  }
}

/* ------------------------------------------------------------------ Auditorías */

async function seedAudits(ctx: Ctx) {
  const existing = await db.audit.count({ where: { tenantId: ctx.id } });
  if (existing > 1) return;
  const year = NOW.getUTCFullYear();
  const prevProgram = await db.auditProgram.upsert({
    where: { tenantId_year: { tenantId: ctx.id, year: year - 1 } },
    create: { tenantId: ctx.id, year: year - 1, objectives: "Verificar el cumplimiento de ISO 9001 y 45001 en todas las sedes.", frequencyRationale: "Una auditoría por proceso crítico al año.", status: "closed", approvedByUserId: ctx.admin, approvedAt: day(-700) },
    update: {},
  });
  const program = await db.auditProgram.findFirst({ where: { tenantId: ctx.id, year } });
  const reqs = await db.tenantRequirement.findMany({ where: { tenantId: ctx.id }, select: { id: true }, orderBy: { id: "asc" }, take: 40 });
  const defs = [
    { code: `AI-${year - 1}-01`, title: "Auditoría interna de calidad y seguridad (anual)", kind: "internal", status: "closed", programId: prevProgram.id, standards: ["ISO9001", "ISO45001"], start: -420, end: -415, mode: "onsite", conclusion: "El sistema es conforme en general; se detectaron 2 no conformidades menores y 3 observaciones.", strengths: "Compromiso del personal de obra y trazabilidad de capacitaciones.", results: ["conforming", "conforming", "nc_minor", "observation", "conforming", "improvement", "nc_minor", "conforming"] },
    { code: `AI-${year}-02`, title: "Auditoría interna ambiental (ISO 14001)", kind: "internal", status: "reporting", programId: program?.id ?? null, standards: ["ISO14001"], start: -35, end: -30, mode: "hybrid", conclusion: null, strengths: null, results: ["conforming", "nc_major", "conforming", "observation", "conforming", "nc_minor"] },
    { code: `AI-${year}-03`, title: "Auditoría interna de seguridad vial y flota", kind: "internal", status: "planned", programId: program?.id ?? null, standards: ["ISO39001"], start: 20, end: 24, mode: "onsite", conclusion: null, strengths: null, results: [] },
    { code: `AE-${year}-01`, title: "Auditoría de vigilancia ISO 9001", kind: "external", status: "closed", programId: null, standards: ["ISO9001"], start: -150, end: -148, mode: "onsite", conclusion: "Se mantiene la certificación. Una no conformidad menor con plazo de respuesta de 60 días.", strengths: "Control de proveedores y gestión de indicadores.", results: ["conforming", "conforming", "nc_minor", "conforming"], ext: { body: "IRAM", type: "surveillance", auditor: "Lic. Horacio Pereyra", result: "Mantiene la certificación con una no conformidad menor" } },
    { code: `AE-${year}-02`, title: "Auditoría de cliente operadora de yacimiento", kind: "external", status: "planned", programId: null, standards: ["ISO45001"], start: 45, end: 46, mode: "onsite", conclusion: null, strengths: null, results: [], ext: { body: "Operadora Vaca Muerta SA", type: "customer", auditor: "Ing. Silvana Cortés", result: null } },
  ] as unknown as { code: string; title: string; kind: "internal" | "external"; status: "planned" | "reporting" | "closed"; programId: string | null; standards: string[]; start: number; end: number; mode: "onsite" | "remote" | "hybrid"; conclusion: string | null; strengths: string | null; results: string[]; ext?: { body: string; type: "surveillance" | "customer"; auditor: string; result: string | null } }[];
  let i = 0;
  for (const d of defs) {
    const dup = await db.audit.findFirst({ where: { tenantId: ctx.id, code: d.code } });
    if (dup) {
      i++;
      continue;
    }
    const audit = await db.audit.create({
      data: {
        tenantId: ctx.id,
        programId: d.programId,
        kind: d.kind,
        externalBody: d.ext ? d.ext.body : null,
        externalType: d.ext ? d.ext.type : null,
        externalAuditor: d.ext ? d.ext.auditor : null,
        externalResult: d.ext ? d.ext.result : null,
        responseDueAt: "ext" in d && d.status === "closed" ? day(-90) : null,
        code: d.code,
        title: d.title,
        objective: "Verificar el cumplimiento de los requisitos y la eficacia del sistema de gestión.",
        scope: "Todas las sedes, procesos operativos y de apoyo dentro del alcance del SGI.",
        standards: d.standards as unknown as IsoStandard[],
        plannedStart: day(d.start),
        plannedEnd: day(d.end),
        mode: d.mode,
        status: d.status,
        startedAt: d.status === "planned" ? null : day(d.start),
        reportConclusion: d.conclusion,
        reportStrengths: d.strengths,
        workersCommunicated: d.status === "closed",
        reportIssuedAt: d.status === "closed" ? day(d.end + 8) : null,
        closedAt: d.status === "closed" ? day(d.end + 20) : null,
        createdByUserId: ctx.admin,
        createdAt: day(d.start - 60),
      },
    });
    await db.auditTeamMember.create({ data: { auditId: audit.id, userId: pick(ctx.userIds, i), role: "lead" } });
    await db.auditTeamMember.create({ data: { auditId: audit.id, userId: pick(ctx.userIds, i + 1), role: "auditor" } }).catch(() => undefined);
    for (const [k, area] of ["Operaciones", "Calidad y HSE", "Administración"].entries()) {
      await db.auditAuditee.create({ data: { auditId: audit.id, userId: pick(ctx.userIds, i + 2 + k), area } });
    }
    const questions = [
      "¿Existe y se aplica el procedimiento de control de documentos?",
      "¿Los objetivos tienen indicadores con meta y responsable?",
      "¿Se registran y analizan los hallazgos con causa raíz?",
      "¿El personal conoce la política integrada?",
      "¿Los equipos de medición están calibrados y rotulados?",
      "¿Se evalúan los proveedores críticos periódicamente?",
      "¿Las capacitaciones críticas tienen evaluación de eficacia?",
      "¿Se realizan simulacros de emergencia según el plan?",
    ];
    for (const [k, q] of questions.slice(0, d.results.length || 5).entries()) {
      const result = d.results[k] ?? "pending";
      await db.auditChecklistItem.create({
        data: {
          tenantId: ctx.id,
          auditId: audit.id,
          tenantRequirementId: reqs[(i * 7 + k) % Math.max(1, reqs.length)]?.id ?? null,
          question: q,
          sortOrder: k + 1,
          result: result as AuditItemResult,
          evidence: result === "pending" ? null : result === "conforming" ? "Se verificó el registro y se entrevistó al responsable." : result === "not_applicable" ? "No aplica al alcance." : "Se encontró evidencia incompleta; se documentó en el informe.",
          updatedByUserId: result === "pending" ? null : ctx.admin,
        },
      });
    }
    if (d.status === "closed") {
      const key = `tenants/${ctx.id}/audits/${audit.id}/informe-${d.code}.pdf`;
      const body = demoPdf(`Informe ${d.code}`);
      await getObjectStorage().putObject(key, body, "application/pdf");
      await db.auditReportAttachment.create({ data: { tenantId: ctx.id, auditId: audit.id, storageKey: key, fileName: `informe-${d.code}.pdf`, contentType: "application/pdf", sizeBytes: body.length, uploadedById: ctx.admin } });
    }
    i++;
  }
}

/* ------------------------------------------------------------------ Seguridad vial */

async function seedRoad(ctx: Ctx) {
  if ((await db.roadSafetySettings.count({ where: { tenantId: ctx.id } })) > 0) return;
  const driverTask = await db.jobTask.findFirst({ where: { tenantId: ctx.id, name: "Conducción de vehículos" } });
  await db.roadSafetySettings.create({ data: { tenantId: ctx.id, minExposureKm: 100000, repeatThreshold: 2, repeatWindowMonths: 12, speedingPerDriver: true, driverTaskId: driverTask?.id ?? null } });

  const drivers = driverTask
    ? await db.personJobTask.findMany({ where: { jobTaskId: driverTask.id, person: { tenantId: ctx.id } }, select: { personId: true } })
    : [];
  const driverIds = drivers.map((d) => d.personId);
  for (const [i, personId] of driverIds.entries()) {
    await db.roadDriver.upsert({ where: { personId }, create: { tenantId: ctx.id, personId, licenseExpiresOn: day([-20, 15, 70, 160, 330, 500][i % 6]), actorUserId: ctx.admin }, update: {} });
  }

  const vehicles = ctx.vehicleIds.slice(0, 8);
  for (const [vi, v] of vehicles.entries()) {
    let odo = 20000 + vi * 7500;
    for (let m = -11; m <= -1; m++) {
      const km = 1800 + ((vi * 331 + (m + 12) * 457) % 4200);
      const periodMonth = monthStart(m);
      const manual = (vi + m) % 7 === 0;
      await db.vehicleKmPeriod.create({
        data: { tenantId: ctx.id, assetId: v.id, periodMonth, km, source: manual ? "manual" : "odometer", computedKm: manual ? km - 120 : km, manualReason: manual ? "Tablero del odómetro averiado; se estimó con la hoja de ruta." : null, confirmedAt: day(m * 30 + 35), actorUserId: ctx.admin },
      });
      odo += km;
      const speeding = (vi * 5 + (m + 12) * 3) % 9;
      if (speeding > 2) {
        const personId = driverIds.length ? pick(driverIds, vi + m + 20) : null;
        await db.speedingPeriod.create({
          data: { tenantId: ctx.id, assetId: v.id, personId, personKey: personId ?? "", periodMonth, count: speeding, note: speeding > 6 ? "Reiterado: se conversó con el conductor y se registró en el legajo." : null, actorUserId: ctx.admin },
        });
      }
    }
  }
  for (const [vi, v] of vehicles.slice(0, 3).entries()) {
    await db.vehicleOdometerReset.create({ data: { tenantId: ctx.id, assetId: v.id, effectiveOn: day(-140 - vi * 30), reason: pick(["Cambio de tablero por avería", "Reemplazo del cuentakilómetros", "Reinicio por reparación mayor del motor"], vi), actorUserId: ctx.admin } });
  }

  const roadIncidents = await db.incidentRecord.findMany({ where: { tenantId: ctx.id, isRoad: true }, orderBy: { occurredOn: "asc" } });
  const details = [
    { vehicleKind: "own", eventType: "rollover", roadSurface: "gravel_dirt", light: "day", weather: "clear", seatbelt: "all", speed: 62, damage: "major", injured: 1, hosp: 1, fatal: 0, cause: "road_conditions", filed: true, ref: "ACTA-NQN-2026-0412" },
    { vehicleKind: "contractor", eventType: "collision_fixed_object", roadSurface: "wet", light: "night_dark", weather: "rain", seatbelt: "some_not", speed: 48, damage: "minor", injured: 0, hosp: 0, fatal: 0, cause: "fatigue_distraction", filed: false, ref: null },
  ] as const;
  for (const [i, inc] of roadIncidents.entries()) {
    const d = details[i % details.length];
    const driver = driverIds.length ? pick(driverIds, i) : null;
    const v = vehicles[i % Math.max(1, vehicles.length)];
    await db.roadEventDetail.upsert({
      where: { incidentRecordId: inc.id },
      create: { tenantId: ctx.id, incidentRecordId: inc.id, vehicleKind: d.vehicleKind, assetId: v?.id ?? null, vehicleLabel: d.vehicleKind === "contractor" ? "Camioneta del contratista, patente AB123CD" : null, driverPersonId: driver, eventType: d.eventType, roadSurface: d.roadSurface, light: d.light, weather: d.weather, seatbelt: d.seatbelt, estimatedSpeedKmh: d.speed, propertyDamage: d.damage, injuredCount: d.injured, hospitalizedCount: d.hosp, fatalCount: d.fatal, mainCause: d.cause, reportFiled: d.filed, reportRef: d.ref, createdByUserId: ctx.admin },
      update: {},
    });
  }
}

/* ------------------------------------------------------------------ Exposición, inspecciones y automatización */

async function seedMisc(ctx: Ctx) {
  const periods = await db.exposurePeriod.findMany({ where: { tenantId: ctx.id }, take: 12, orderBy: { id: "asc" } });
  if (periods.length > 0 && (await db.exposureRevision.count({ where: { tenantId: ctx.id } })) === 0) {
    for (const [i, p] of periods.slice(0, 6).entries()) {
      await db.exposureRevision.create({
        data: { tenantId: ctx.id, exposurePeriodId: p.id, previousHours: Math.max(0, p.hours - 240 - i * 40), previousHeadcountAvg: Math.max(1, Number(p.headcountAvg) - 2), newHours: p.hours, newHeadcountAvg: p.headcountAvg, reason: pick(["Ajuste por horas extra del cierre de mes", "Se incorporó el personal contratista omitido", "Corrección de la nómina informada por RR. HH.", "Se descontaron licencias y ausencias"], i), actorUserId: ctx.admin, createdAt: day(-80 + i * 9) },
      });
    }
  }
  const answers = await db.inspectionAnswer.findMany({ where: { inspection: { tenantId: ctx.id } }, take: 8, include: { inspection: { select: { id: true } } } });
  if (answers.length > 0 && (await db.inspectionCorrection.count({ where: { tenantId: ctx.id } })) === 0) {
    for (const [i, a] of answers.entries()) {
      await db.inspectionCorrection.create({
        data: { tenantId: ctx.id, inspectionId: a.inspection.id, answerId: a.id, previousValue: "ok", newValue: i % 2 ? "falla" : "observación", previousResult: "fit", newResult: i % 2 ? "unfit" : "fit_with_observations", reason: pick(["Se cargó mal el resultado desde el celular", "El supervisor revisó la foto y corrigió la respuesta", "Error de tipeo al completar la planilla"], i), byUserId: ctx.admin, createdAt: day(-60 + i * 5) },
      });
    }
  }
  if ((await db.automationRun.count({ where: { tenantId: ctx.id } })) === 0) {
    for (let i = 0; i < 12; i++) {
      const ok = i % 5 !== 3;
      const started = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate() - i, 7, 0, 0));
      await db.automationRun.create({
        data: { tenantId: ctx.id, offerCode: "due_reminders", status: ok ? "succeeded" : "failed", summary: ok ? { scanned: 120 + i * 3, notified: 4 + (i % 6), skipped: 20 + i } : undefined, error: ok ? null : "Tiempo de espera agotado al enviar los avisos por correo", startedAt: started, finishedAt: new Date(started.getTime() + 38000) },
      });
    }
  }
  const offer = await db.automationOffer.findFirst({ where: { code: "due_reminders" } });
  if (offer) {
    await db.tenantOfferActivation.upsert({ where: { tenantId_offerId: { tenantId: ctx.id, offerId: offer.id } }, create: { tenantId: ctx.id, offerId: offer.id, active: true, activatedAt: day(-300) }, update: {} });
  }
}

async function main() {
  setEmailSenderForTests(new MemoryEmailSender());
  const a = await loadCtx("demo-patagonia");
  const b = await loadCtx("demo-sur");
  if (!a || !b) throw new Error("Primero corré `npm run db:seed:revision` (empresas de demo).");
  void DEMO_DOMAIN;
  await step("A · brechas ISO con historial", () => seedGap(a));
  await step("A · documentos y versiones", () => seedDocuments(a, DOC_DEFS));
  await step("A · objetivos, indicadores y mediciones", () => seedObjectives(a, OBJECTIVES_A, true));
  await step("A · riesgos y oportunidades", () => seedRisksAndOpps(a, true));
  await step("A · auditorías", () => seedAudits(a));
  await step("A · seguridad vial", () => seedRoad(a));
  await step("A · exposición, correcciones y automatización", () => seedMisc(a));
  await step("B · brechas ISO con historial", () => seedGap(b));
  await step("B · documentos y versiones", () => seedDocuments(b, DOC_DEFS.slice(0, 8)));
  await step("B · objetivos, indicadores y mediciones", () => seedObjectives(b, OBJECTIVES_B, false));
  await step("B · riesgos y oportunidades", () => seedRisksAndOpps(b, true));
  await step("B · auditorías", () => seedAudits(b));
  await step("B · automatización", () => seedMisc(b));
  stepReport();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
