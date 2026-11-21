// Datos de la demo que el seed de revisión no trae (documentos, riesgos y oportunidades, objetivos, auditorías y choferes)
// para la empresa ficticia demo-patagonia. Se corre desde la raíz: npx tsx tools/demo-video/entorno/datos-extra.mts
// Solo usa funciones de src/lib; es idempotente (si el dato ya existe, lo saltea); cada módulo es un paso aislado.
import "dotenv/config";
import { db, demoPdf, step, stepReport } from "../../../scripts/demo-seed/kit";
import { uploadTenantDocument } from "../../../src/lib/documents";
import { createRisk, addRiskAssessment, setRiskResponseDecision } from "../../../src/lib/risks";
import { createOpportunity, addOpportunityAssessment, setOpportunityPursuitDecision } from "../../../src/lib/opportunities";
import { createIndicator, createObjective } from "../../../src/lib/objectives";
import { recordMeasurement } from "../../../src/lib/measurements";
import { approveProgram, createAudit, saveAuditPlan, saveAuditReport, saveProgram, transitionAudit } from "../../../src/lib/audits";
import { getChecklist, listChecklistCandidates, recordItemResult, setRequirementItems } from "../../../src/lib/audit-checklist";
import { addDriver, saveDriverLicense, setDriverTask } from "../../../src/lib/road-drivers";

const SLUG = "demo-patagonia";
const DAY = 86_400_000;
const hoy = new Date();
const dias = (n: number) => new Date(hoy.getTime() + n * DAY);
const isoDay = (n: number) => dias(n).toISOString().slice(0, 10);

const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: SLUG }, select: { id: true } });
const tenantId = tenant.id;
const userId = async (clave: string) => (await db.user.findUniqueOrThrow({ where: { email: `${clave}.patagonia@demo.sgi.test` }, select: { id: true } })).id;
const ana = await userId("admin");
const bruno = await userId("hse");
const marcela = await userId("calidad");
const lucia = await userId("operaciones");

/* ---------- Documentos: el código va en el título y la revisión en la versión (la pantalla muestra título, versión y archivo) ---------- */
const DOCUMENTOS: { codigo: string; titulo: string; tipo: string; revisiones: number; por: string }[] = [
  { codigo: "MS 01", titulo: "Manual del Sistema de Gestión Integrado", tipo: "manual", revisiones: 2, por: ana },
  { codigo: "POL 01", titulo: "Política de calidad, ambiente, seguridad y salud", tipo: "policy", revisiones: 1, por: ana },
  { codigo: "PG 01", titulo: "Control de documentos y registros", tipo: "procedure", revisiones: 3, por: marcela },
  { codigo: "PG 05", titulo: "Auditorías internas", tipo: "procedure", revisiones: 1, por: marcela },
  { codigo: "PE 02", titulo: "Trabajo en altura", tipo: "procedure", revisiones: 4, por: bruno },
  { codigo: "IT 01 PE 02", titulo: "Armado e inspección de andamios", tipo: "instruction", revisiones: 2, por: bruno },
  { codigo: "RE 01 PE 02", titulo: "Permiso de trabajo en altura", tipo: "record", revisiones: 1, por: bruno },
  { codigo: "PE 05", titulo: "Izaje de cargas", tipo: "procedure", revisiones: 1, por: bruno },
];

await step("Documentos controlados", async () => {
  for (const d of DOCUMENTOS) {
    const titulo = `${d.codigo} · ${d.titulo}`;
    if (await db.document.findFirst({ where: { tenantId, title: titulo } })) continue;
    let documentId: string | undefined;
    for (let rev = 1; rev <= d.revisiones; rev++) {
      const doc = await uploadTenantDocument({
        tenantId,
        title: titulo,
        kind: d.tipo,
        fate: "create",
        fileName: `${d.codigo.replaceAll(" ", "-")}_rev${rev}.pdf`,
        contentType: "application/pdf",
        body: demoPdf(`${d.codigo} ${d.titulo} rev ${rev}`),
        uploadedById: d.por,
        notes: rev === 1 ? "Emisión inicial" : `Revisión ${rev}`,
        isPlatformSuperuser: true,
        documentId,
      });
      documentId = doc.id;
    }
  }
});

/* ---------- Riesgos ---------- */
const RIESGOS = [
  { proceso: "Obra", titulo: "Caída de altura durante el montaje de andamios", causa: "Trabajo en altura con andamios armados a diario", evento: "Un operario cae desde el andamio", efecto: "Lesión grave y paralización de la obra", controles: ["Arnés con doble cabo", "Inspección visual del andamio"], nivel: "high" as const, decision: "mitigate" as const, justif: "Inspección diaria de andamios y reentrenamiento del personal", dueno: bruno },
  { proceso: "Compras", titulo: "Contratista que ingresa a obra sin la documentación de seguridad vigente", causa: "El legajo del contratista no se controla antes del ingreso", evento: "Ingresa personal sin seguro ni capacitación vigente", efecto: "Incumplimiento legal y exposición a un accidente", controles: ["Planilla de ingreso en portería"], nivel: "medium" as const, decision: "mitigate" as const, justif: "Control del legajo completo antes de autorizar el ingreso", dueno: marcela },
  { proceso: "Logística", titulo: "Siniestro vial en los traslados Añelo–Neuquén", causa: "Traslados largos de personal en camioneta por ruta", evento: "Choque o vuelco de un vehículo de la empresa", efecto: "Lesiones al personal y pérdida del vehículo", controles: ["Control de licencias", "Revisión técnica de las camionetas"], nivel: "high" as const, decision: "mitigate" as const, justif: "Plan de manejo defensivo y control de km por conductor", dueno: bruno },
  { proceso: "Ambiente", titulo: "Derrame de hidrocarburos en obra", causa: "Carga de combustible en el obrador", evento: "Se derrama gasoil sobre el suelo", efecto: "Contaminación del suelo y sanción ambiental", controles: ["Bandejas de contención"], nivel: "medium" as const, decision: "mitigate" as const, justif: "Kit antiderrame en cada frente y simulacro semestral", dueno: lucia },
];

await step("Riesgos evaluados con su respuesta", async () => {
  for (const r of RIESGOS) {
    if (await db.risk.findFirst({ where: { tenantId, title: r.titulo } })) continue;
    const riesgo = await createRisk({
      tenantId,
      createdByUserId: ana,
      draft: { title: r.titulo, statement: { cause: r.causa, event: r.evento, effect: r.efecto }, existingControls: r.controles, sourceKind: "process", sourceLabel: r.proceso },
    });
    await addRiskAssessment({ tenantId, riskId: riesgo.id, assessedById: ana, assessment: { method: "qualitative", level: r.nivel, rationale: `Evaluado con el responsable de ${r.proceso}` } });
    await setRiskResponseDecision({ tenantId, riskId: riesgo.id, decision: r.decision, rationale: r.justif, ownerUserId: r.dueno, nextReviewAt: dias(90) });
  }
});

/* ---------- Oportunidad ---------- */
await step("Oportunidad comercial", async () => {
  const titulo = "Calificar como contratista de una operadora que exige ISO 9001 y 45001";
  if (await db.opportunity.findFirst({ where: { tenantId, title: titulo } })) return;
  const o = await createOpportunity({
    tenantId,
    createdByUserId: ana,
    draft: {
      title: titulo,
      hypothesis: { condition: "Si el sistema de gestión demuestra los requisitos ISO con evidencia", circumstance: "cuando la operadora abra la próxima precalificación de contratistas", benefit: "entramos a su cartera y accedemos a contratos de mayor volumen" },
      sourceKind: "process",
      sourceLabel: "Comercial",
    },
  });
  await addOpportunityAssessment({ tenantId, opportunityId: o.id, assessedById: ana, assessment: { method: "qualitative", level: "high", rationale: "Hay contratos en vista y el sistema ya está en marcha" } });
  await setOpportunityPursuitDecision({ tenantId, opportunityId: o.id, decision: "pursue_now", rationale: "Hacer la auditoría interna completa antes de la auditoría del cliente", ownerUserId: ana, nextReviewAt: dias(60) });
});

/* ---------- Objetivos con seis mediciones mensuales (el indicador "nace" hace seis meses) ---------- */
const OBJETIVOS = [
  { titulo: "Mejorar la satisfacción del cliente", indicador: "Encuesta de satisfacción (1 a 5)", unidad: "puntos", meta: 4.2, alerta: 4.3, dueno: marcela, valores: [3.9, 4.0, 4.0, 4.1, 4.3, 4.4] },
  { titulo: "Cumplir el plan de capacitación", indicador: "Capacitaciones realizadas", unidad: "%", meta: 90, alerta: 92, dueno: bruno, valores: [72, 78, 81, 86, 90, 93] },
  { titulo: "Cerrar los hallazgos en término", indicador: "Acciones cerradas en plazo", unidad: "%", meta: 85, alerta: 87, dueno: marcela, valores: [60, 68, 74, 79, 84, 88] },
];

await step("Objetivos e indicadores con mediciones", async () => {
  for (const o of OBJETIVOS) {
    if (await db.objective.findFirst({ where: { tenantId, title: o.titulo } })) continue;
    const objetivo = await createObjective({
      tenantId,
      createdByUserId: ana,
      draft: { title: o.titulo, description: "", standards: ["ISO9001"], ownerUserId: o.dueno, dueDate: dias(365), plan: "" },
    });
    const indicador = await createIndicator({
      tenantId,
      objectiveId: objetivo.id,
      draft: { name: o.indicador, formula: "", unit: o.unidad, direction: "higher_better", target: o.meta, alertThreshold: o.alerta, frequency: "monthly", kind: "lagging", ownerUserId: o.dueno },
    });
    await db.indicator.update({ where: { id: indicador.id }, data: { createdAt: new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 6, 1)) } });
    for (const valor of o.valores) {
      await recordMeasurement({ tenantId, indicatorId: indicador.id, userId: o.dueno, value: valor, analysis: valor < o.alerta ? "Se refuerza el seguimiento mensual con el responsable del proceso" : null });
    }
  }
});

/* ---------- Auditorías: una interna cerrada con un hallazgo, otra planificada y el programa aprobado ---------- */
const NORMAS = ["ISO9001", "ISO45001"] as const;
const plan = (titulo: string, inicio: Date, fin: Date, area: string) => ({
  title: titulo,
  objective: "Verificar que el proceso cumple los requisitos de la norma y del cliente",
  scope: area,
  standards: [...NORMAS],
  plannedStart: inicio,
  plannedEnd: fin,
  mode: "onsite" as const,
  leadUserId: marcela,
  auditorUserIds: [],
  auditees: [{ userId: bruno, area }],
  impartialityException: null,
});

await step("Auditorías internas y programa", async () => {
  const anio = hoy.getUTCFullYear();
  const tituloA = "Interna – Obra Loma Campana";
  const tituloB = "Interna – Base Añelo";
  if (!(await db.audit.findFirst({ where: { tenantId, title: tituloA } }))) {
    const a = await createAudit({ tenantId, title: tituloA, plannedStart: dias(-62), plannedEnd: dias(-61), createdByUserId: marcela });
    await saveAuditPlan({ tenantId, auditId: a.id, plan: plan(tituloA, dias(-62), dias(-61), "Obra y Compras en Obra Loma Campana") });
    const candidatos = (await listChecklistCandidates(tenantId, [...NORMAS], db)).slice(0, 5);
    await setRequirementItems({ tenantId, auditId: a.id, tenantRequirementIds: candidatos.map((c) => c.tenantRequirementId) }, db);
    await transitionAudit({ tenantId, auditId: a.id, to: "prepared" }, db);
    await transitionAudit({ tenantId, auditId: a.id, to: "in_progress", reason: "Auditoría realizada en obra" }, db);
    const items = await getChecklist(tenantId, a.id, db);
    for (const [i, item] of items.entries()) {
      await recordItemResult(
        i === 0
          ? { tenantId, auditId: a.id, itemId: item.id, result: "nc_minor", evidence: "Dos órdenes de compra a contratistas sin evaluación vigente del proveedor", userId: marcela }
          : { tenantId, auditId: a.id, itemId: item.id, result: "conforming", evidence: null, userId: marcela },
        db,
      );
    }
    await transitionAudit({ tenantId, auditId: a.id, to: "reporting" }, db);
    await saveAuditReport({ tenantId, auditId: a.id, conclusion: "El proceso cumple, con una no conformidad menor en la evaluación de contratistas", strengths: "Registros de inspección completos y al día", workersCommunicated: true }, db);
    await transitionAudit({ tenantId, auditId: a.id, to: "closed" }, db);
  }
  if (!(await db.audit.findFirst({ where: { tenantId, title: tituloB } }))) {
    const b = await createAudit({ tenantId, title: tituloB, plannedStart: dias(21), plannedEnd: dias(22), createdByUserId: marcela });
    await saveAuditPlan({ tenantId, auditId: b.id, plan: plan(tituloB, dias(21), dias(22), "Base Añelo: logística y mantenimiento") });
  }
  await saveProgram({ tenantId, year: anio, objectives: "Auditar todos los procesos y sedes antes de la auditoría del cliente", frequencyRationale: "Dos auditorías por sede al año; más frecuentes donde hubo no conformidades" });
  await approveProgram({ tenantId, year: anio, userId: ana });
});

/* ---------- Seguridad vial: choferes con licencia (los vehículos ya los trae el seed de inspecciones) ---------- */
await step("Choferes y licencias", async () => {
  await db.tenantModuleActivation.upsert({
    where: { tenantId_moduleKey: { tenantId, moduleKey: "road_safety" } },
    create: { tenantId, moduleKey: "road_safety", enabled: true, updatedByUserId: ana },
    update: { enabled: true, updatedByUserId: ana },
  });
  const actor = { userId: ana, role: "tenant_admin" as const, isPlatformSuperuser: false };
  const tarea = await db.jobTask.findFirstOrThrow({ where: { tenantId, name: "Conducción de vehículos" }, select: { id: true } });
  await setDriverTask({ tenantId, actor, jobTaskId: tarea.id });
  const CHOFERES = [
    { nombre: "Matías Aguirre", vence: 240 },
    { nombre: "Florencia Suárez", vence: 20 },
    { nombre: "Ramón Escobar", vence: 400 },
  ];
  for (const c of CHOFERES) {
    const persona = await db.person.findFirstOrThrow({ where: { tenantId, name: c.nombre }, select: { id: true } });
    await addDriver({ tenantId, actor, personId: persona.id }).catch(() => undefined); // ya era chofer
    await saveDriverLicense({ tenantId, actor, personId: persona.id, expiresOn: isoDay(c.vence) as never });
  }
});

stepReport();
await db.$disconnect();
