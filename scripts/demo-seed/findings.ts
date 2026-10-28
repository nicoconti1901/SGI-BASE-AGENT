import { closeFindingMeasure, createFindingDraft, publishFinding } from "../../src/lib/findings";
import { cancelFinding, startFindingMeasure, verifyFinding } from "../../src/lib/finding-lifecycle";
import { uploadFindingAttachment } from "../../src/lib/finding-attachments";
import { createAction } from "../../src/lib/actions";
import { confirmRootCause, createInitialWhyStep } from "../../src/domain/findings/five-whys";
import type { FindingType, RootCauseAnalysis, WhyStep } from "../../src/domain/findings/types";
import { db, demoPdf, step, type DemoTenant } from "./kit";

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY);

/** Árbol de 5 Porqués con la causa raíz confirmada, a partir de las respuestas en orden. */
export function rcaFor(description: string, whys: string[], confirmedBy: string): RootCauseAnalysis {
  const first = createInitialWhyStep(description);
  // El método pide al menos tres niveles en una rama: se completan con una causa de fondo genérica.
  const answers = [...whys];
  while (answers.length < 3) answers.push("El proceso no tenía un responsable ni un control periódico definido.");
  const steps: WhyStep[] = answers.map((answer, i) =>
    i === 0
      ? { ...first, answer }
      : { id: `s${i + 1}`, order: i + 1, branchId: first.branchId, branchLabel: first.branchLabel, question: "¿Por qué?", answer, isRootCause: i === answers.length - 1 },
  );
  return confirmRootCause(steps, confirmedBy, description);
}

export type MeasureSpec = { kind: "corrective" | "preventive"; title: string; owner: string; dueIn: number; linkedRootCause?: boolean; description?: string };

/** Publica un borrador de hallazgo con su causa raíz, medidas y destinatarios. */
export async function publishSpec(
  t: DemoTenant,
  finding: { id: string; title: string; description: string; detectedAt: Date; source?: string | null },
  spec: { type: FindingType; whys: string[]; measures: MeasureSpec[]; notify?: string[]; actor?: string; severity?: string; location?: string },
) {
  const actorUserId = t.users[spec.actor ?? "hse"].userId;
  return publishFinding({
    tenantId: t.id,
    findingId: finding.id,
    actorUserId,
    draft: {
      type: spec.type,
      title: finding.title,
      description: finding.description,
      detectedAt: finding.detectedAt,
      source: finding.source ?? undefined,
      severity: spec.severity,
      location: spec.location,
      rca: rcaFor(finding.description, spec.whys, actorUserId),
      measures: spec.measures.map((m, i) => ({
        kind: m.kind,
        title: m.title,
        description: m.description,
        ownerUserId: t.users[m.owner].userId,
        dueAt: new Date(Date.now() + m.dueIn * DAY),
        linkedRootCause: m.linkedRootCause ?? i === 0,
      })),
      notifyUserIds: (spec.notify ?? ["admin", "calidad"]).map((k) => t.users[k].userId),
    },
  });
}

async function measureIds(tenantId: string, findingId: string) {
  return (await db.findingMeasure.findMany({ where: { tenantId, findingId }, orderBy: { createdAt: "asc" }, select: { id: true, ownerUserId: true } }));
}

async function closeMeasure(t: DemoTenant, findingId: string, measureId: string, ownerUserId: string) {
  await uploadFindingAttachment({
    tenantId: t.id, findingId, measureId, kind: "measure_evidence", fileName: "evidencia-cierre.pdf", contentType: "application/pdf",
    body: demoPdf("Evidencia de cierre de la medida"), uploadedById: ownerUserId,
  });
  await closeFindingMeasure({ tenantId: t.id, measureId, actorUserId: ownerUserId });
}

type Plan = {
  type: FindingType;
  title: string;
  description: string;
  daysAgo: number;
  source: string;
  location?: string;
  severity?: string;
  whys: string[];
  measures: MeasureSpec[];
  /** Hasta dónde llega el hallazgo en el circuito. */
  stage: "draft" | "published" | "started" | "partly_closed" | "verification" | "closed" | "cancelled";
};

const PLANS: Plan[] = [
  {
    type: "nonconformity", title: "Equipos de medición sin identificación de calibración", daysAgo: 25, source: "Auditoría interna", location: "Planta Centenario", severity: "Media", stage: "published",
    description: "Tres equipos de medición del laboratorio se usan sin etiqueta con la fecha de la última calibración.",
    whys: ["No se rotulan los equipos al recibirlos del laboratorio.", "El procedimiento de recepción no incluye el rotulado.", "El procedimiento de metrología no se revisó desde 2022."],
    measures: [
      { kind: "corrective", title: "Rotular los equipos con fecha de calibración y próximo vencimiento", owner: "calidad", dueIn: 20, linkedRootCause: false },
      { kind: "preventive", title: "Actualizar el procedimiento de recepción de equipos calibrados", owner: "hse", dueIn: 45, linkedRootCause: true },
    ],
  },
  {
    type: "nonconformity", title: "Registros de capacitación incompletos en obra", daysAgo: 60, source: "Revisión de la dirección", location: "Obra Loma Campana", severity: "Alta", stage: "published",
    description: "Faltan las planillas firmadas de asistencia de seis capacitaciones dictadas en obra durante el último trimestre.",
    whys: ["Las planillas quedaron en el obrador y se perdieron.", "No hay un responsable de recolectarlas.", "La obra no está incluida en el circuito de archivo."],
    measures: [{ kind: "corrective", title: "Reconstruir las planillas faltantes con los asistentes", owner: "inspector", dueIn: -12 }, { kind: "preventive", title: "Designar a un responsable de archivo en cada obra", owner: "operaciones", dueIn: 10, linkedRootCause: true }],
  },
  {
    type: "observation", title: "Orden y limpieza deficiente en el obrador principal", daysAgo: 18, source: "Inspección de área", location: "Obra Loma Campana", severity: "Baja", stage: "partly_closed",
    description: "Se observaron materiales acopiados en pasillos y residuos sin separar en el obrador principal.",
    whys: ["No hay un lugar definido para el acopio.", "El layout del obrador no se actualizó al crecer la obra."],
    measures: [{ kind: "corrective", title: "Retirar el acopio de los pasillos y señalizar los sectores", owner: "colaborador", dueIn: 5 }, { kind: "preventive", title: "Definir y demarcar las zonas de acopio", owner: "inspector", dueIn: 30 }],
  },
  {
    type: "opportunity", title: "Digitalizar los permisos de trabajo", daysAgo: 12, source: "Sugerencia del personal", severity: "Baja", stage: "published",
    description: "Los permisos de trabajo en caliente y en altura se completan en papel y se demora su archivo.",
    whys: ["El papel es lo que hay disponible en el campo.", "No se evaluó una herramienta digital para el campo."],
    measures: [{ kind: "preventive", title: "Pilotear un formulario digital en dos obras", owner: "calidad", dueIn: 60 }],
  },
  {
    type: "nonconformity", title: "Extintores de camionetas sin mantenimiento", daysAgo: 120, source: "Inspección de activos", location: "Base Añelo", severity: "Media", stage: "closed",
    description: "Dos extintores instalados en camionetas tenían el mantenimiento anual vencido.",
    whys: ["Los vehículos no figuraban en el programa de extintores.", "Los extintores móviles se cargaron como fijos."],
    measures: [{ kind: "corrective", title: "Recargar los extintores y cargar la fecha en el sistema", owner: "operaciones", dueIn: -100 }],
  },
  {
    type: "nonconformity", title: "Señalización de rutas de evacuación incompleta", daysAgo: 70, source: "Simulacro", location: "Planta Centenario", severity: "Media", stage: "verification",
    description: "Durante el simulacro se comprobó que faltaban carteles fotoluminiscentes en el sector de depósito.",
    whys: ["No se actualizó el plano de evacuación tras la ampliación.", "El proceso de gestión del cambio no incluye a HSE."],
    measures: [{ kind: "corrective", title: "Instalar la señalización faltante en el depósito", owner: "colaborador", dueIn: -30 }],
  },
  {
    type: "observation", title: "Uso inconsistente de guantes en soldadura", daysAgo: 35, source: "Recorrida de seguridad", location: "Obra Loma Campana", severity: "Media", stage: "started",
    description: "Dos soldadores trabajaban sin guantes de cuero largos en tareas de soldadura vertical.",
    whys: ["Los guantes disponibles son cortos.", "El pañol no tiene el modelo largo en stock."],
    measures: [{ kind: "corrective", title: "Reponer guantes largos de soldador y repartirlos", owner: "operaciones", dueIn: 3 }],
  },
  {
    type: "nonconformity", title: "Hallazgo duplicado cargado por error", daysAgo: 40, source: "Auditoría interna", severity: "Baja", stage: "cancelled",
    description: "Se cargó dos veces la misma no conformidad de la auditoría de abril.",
    whys: ["Doble carga por el mismo auditor."],
    measures: [{ kind: "corrective", title: "Eliminar el duplicado", owner: "calidad", dueIn: 5 }],
  },
  { type: "observation", title: "Borrador: ruido en la sala de compresores", daysAgo: 3, source: "Recorrida", stage: "draft", description: "A confirmar con el sonómetro la exposición en la sala de compresores.", whys: [], measures: [] },
  { type: "opportunity", title: "Borrador: reutilizar el agua de lavado de equipos", daysAgo: 1, source: "Sugerencia del personal", stage: "draft", description: "Evaluar la recirculación del agua del lavadero de la base.", whys: [], measures: [] },
];

export async function seedFindingsModule(t: DemoTenant) {
  const creator = t.users.calidad.userId;
  for (const p of PLANS) {
    await step(`Hallazgo «${p.title}»`, async () => {
      const finding = await createFindingDraft({
        tenantId: t.id, type: p.type, title: p.title, description: p.description, detectedAt: daysFromNow(-p.daysAgo),
        source: p.source, location: p.location, severity: p.severity, createdByUserId: creator,
      });
      if (p.stage === "draft") return;
      await publishSpec(t, finding, { type: p.type, whys: p.whys, measures: p.measures, severity: p.severity, location: p.location });

      const measures = await measureIds(t.id, finding.id);
      if (p.stage === "cancelled") {
        await cancelFinding({ tenantId: t.id, findingId: finding.id, actorUserId: t.users.admin.userId, reason: "Duplicado de otro hallazgo de la misma auditoría." });
        return;
      }
      if (p.stage === "started" || p.stage === "partly_closed") {
        await startFindingMeasure({ tenantId: t.id, measureId: measures[0].id, actorUserId: measures[0].ownerUserId });
      }
      if (p.stage === "partly_closed") {
        await closeMeasure(t, finding.id, measures[0].id, measures[0].ownerUserId);
      }
      if (p.stage === "verification" || p.stage === "closed") {
        for (const m of measures) {
          await startFindingMeasure({ tenantId: t.id, measureId: m.id, actorUserId: m.ownerUserId });
          await closeMeasure(t, finding.id, m.id, m.ownerUserId);
        }
      }
      if (p.stage === "closed") {
        await verifyFinding({
          tenantId: t.id, findingId: finding.id, actorUserId: t.users.admin.userId, result: "effective",
          evidence: "Se inspeccionaron las camionetas: todos los extintores con mantenimiento vigente y cargados en el sistema.",
          independenceException: null, earlyReason: "Verificación anticipada para la demo: la corrección ya estaba controlada.",
        });
      }
    });
  }

  // Acciones sueltas vinculadas a hallazgos, para probar la lista de acciones (una vencida, una completada).
  await step("Acciones vinculadas a hallazgos", async () => {
    const finding = await db.finding.findFirst({ where: { tenantId: t.id, title: { startsWith: "Registros de capacitación" } }, select: { id: true } });
    if (!finding) throw new Error("No se encontró el hallazgo de registros de capacitación");
    await createAction({
      tenantId: t.id,
      createdByUserId: t.users.calidad.userId,
      draft: { title: "Auditar el archivo de planillas de las últimas cinco obras", description: "Verificar que cada capacitación tenga su planilla firmada.", ownerUserId: t.users.calidad.userId, dueAt: daysFromNow(15), links: [{ targetType: "finding", targetId: finding.id }] },
    });
    await createAction({
      tenantId: t.id,
      createdByUserId: t.users.calidad.userId,
      draft: { title: "Capacitar a los capataces en el llenado de planillas", ownerUserId: t.users.hse.userId, dueAt: daysFromNow(-4), links: [{ targetType: "finding", targetId: finding.id }] },
    });
  });
}

export async function seedFindingsTenantB(t: DemoTenant) {
  await step("B: hallazgo", async () => {
    const f = await createFindingDraft({
      tenantId: t.id, type: "nonconformity", title: "Temperatura de cámara fuera de rango", description: "La cámara 2 registró 9 °C durante cuatro horas.",
      detectedAt: daysFromNow(-10), source: "Control de proceso", createdByUserId: t.users.admin.userId,
    });
    void f;
  });
}
