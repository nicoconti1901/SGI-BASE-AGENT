import { createCourse, importSuggestedCourses, applyRequirementChanges, recordMatrixReview } from "../../src/lib/training-config";
import { addIndividualRecord, registerSession, uploadTrainingAttachment, voidRecord } from "../../src/lib/training-records";
import { planSession } from "../../src/lib/training-plan";
import { evaluateEffectiveness, reconcileSafely, setTrainingOwner } from "../../src/lib/training-followup";
import type { MatrixChange } from "../../src/domain/training/matrix";
import { addDays } from "../../src/domain/training/dates";
import { trainingToday } from "../../src/lib/training";
import { DEMO_PNG, db, demoPdf, step, type DemoTenant } from "./kit";

const TODAY = trainingToday();
const ago = (days: number) => addDays(TODAY, -days);
const ahead = (days: number) => addDays(TODAY, days);

const SUGGESTED = [
  "induccion", "conciencia", "epp", "evacuacion", "incendio", "altura", "espacios-confinados", "izaje",
  "manejo-defensivo", "primeros-auxilios", "quimicos", "residuos-peligrosos", "auditor-interno",
];

async function courses(t: DemoTenant, actorUserId: string) {
  await importSuggestedCourses({ tenantId: t.id, actorUserId, keys: SUGGESTED });
  const custom = await createCourse({
    tenantId: t.id,
    actorUserId,
    draft: {
      name: "Permiso y procedimiento de trabajos en caliente",
      code: "CAL-01",
      category: "safety",
      modality: "in_person",
      standards: ["ISO45001"],
      defaultHours: 4,
      validityMonths: 12,
      reminderDays: 30,
      requiresEffectiveness: true,
      effectivenessDays: 60,
      legalBasis: "Decreto 351/79 (Anexo VII) y procedimiento interno PRO-HSE-014.",
      defaultProvider: "Capacitación interna HSE",
    },
  });
  const rows = await db.course.findMany({ where: { tenantId: t.id }, select: { id: true, suggestedKey: true, name: true } });
  const byKey: Record<string, string> = { caliente: custom.id };
  for (const r of rows) if (r.suggestedKey) byKey[r.suggestedKey] = r.id;
  return byKey;
}

async function matrix(t: DemoTenant, actorUserId: string, c: Record<string, string>) {
  const pos = (name: string) => t.positionIds[name];
  const task = (name: string) => t.taskIds[name];
  const cell = (targetKind: MatrixChange["targetKind"], targetId: string | null, key: string, state: MatrixChange["state"], graceDays: number): MatrixChange => ({ targetKind, targetId, courseId: c[key], state, graceDays });
  const changes: MatrixChange[] = [
    cell("all", null, "induccion", "mandatory", 30),
    cell("all", null, "conciencia", "mandatory", 60),
    cell("all", null, "epp", "mandatory", 30),
    cell("all", null, "evacuacion", "mandatory", 60),
    cell("all", null, "incendio", "recommended", 90),
    cell("position", pos("Soldador"), "caliente", "mandatory", 15),
    cell("position", pos("Operario de obra"), "altura", "mandatory", 30),
    cell("position", pos("Chofer"), "manejo-defensivo", "mandatory", 30),
    cell("position", pos("Operador de grúa"), "izaje", "mandatory", 15),
    cell("position", pos("Técnico de HSE"), "primeros-auxilios", "mandatory", 30),
    cell("position", pos("Técnico de HSE"), "auditor-interno", "recommended", 0),
    cell("task", task("Trabajo en altura"), "altura", "mandatory", 15),
    cell("task", task("Espacios confinados"), "espacios-confinados", "mandatory", 15),
    cell("task", task("Izaje de cargas"), "izaje", "mandatory", 15),
    cell("task", task("Trabajo en caliente"), "caliente", "mandatory", 15),
    cell("task", task("Manejo de sustancias químicas"), "quimicos", "mandatory", 30),
    cell("task", task("Manejo de sustancias químicas"), "residuos-peligrosos", "recommended", 30),
    cell("task", task("Conducción de vehículos"), "manejo-defensivo", "mandatory", 30),
  ];
  await applyRequirementChanges({ tenantId: t.id, actorUserId, changes });
  await recordMatrixReview({ tenantId: t.id, actorUserId, note: "Revisión anual de la matriz con HSE y las jefaturas de obra." });
}

type SessionPlan = {
  course: string;
  daysAgo: number;
  site: string;
  who: string[];
  failed?: string[];
  instructor: string;
  external?: boolean;
  provider?: string;
  hours: number;
  attachment?: "pdf" | "png";
};

const ALL_ACTIVE = ["L-001", "L-002", "L-003", "L-004", "L-005", "L-006", "L-007", "L-008", "L-009", "L-010", "L-011", "L-012", "L-013", "L-014", "L-015", "L-017", "L-018", "L-019", "L-020"];

const SESSIONS: SessionPlan[] = [
  { course: "induccion", daysAgo: 400, site: "Oficina Neuquén", who: ALL_ACTIVE.slice(0, 12), instructor: "Bruno Sosa", hours: 3 },
  { course: "conciencia", daysAgo: 10, site: "Oficina Neuquén", who: ALL_ACTIVE, instructor: "Marcela Ledesma", hours: 2 },
  { course: "epp", daysAgo: 50, site: "Obra Loma Campana", who: ["L-007", "L-008", "L-009", "L-013", "L-015", "L-017", "L-019", "C-101", "C-102", "C-103"], failed: ["L-017"], instructor: "Bruno Sosa", hours: 2 },
  { course: "evacuacion", daysAgo: 30, site: "Planta Centenario", who: ["L-005", "L-010", "L-014", "C-104"].filter((c) => c !== "C-104"), instructor: "Defensa Civil Centenario", external: true, provider: "Defensa Civil", hours: 2, attachment: "pdf" },
  { course: "incendio", daysAgo: 500, site: "Base Añelo", who: ["L-002", "L-004", "L-011", "L-012", "L-018"], instructor: "Bomberos Voluntarios de Añelo", external: true, provider: "Bomberos Voluntarios", hours: 3, attachment: "png" },
  { course: "altura", daysAgo: 340, site: "Obra Loma Campana", who: ["L-004", "L-007", "L-008", "L-015", "L-019", "C-102"], instructor: "Alturas Patagonia SRL", external: true, provider: "Alturas Patagonia SRL", hours: 8, attachment: "pdf" },
  { course: "altura", daysAgo: 45, site: "Obra Loma Campana", who: ["L-017"], failed: ["L-017"], instructor: "Alturas Patagonia SRL", external: true, provider: "Alturas Patagonia SRL", hours: 8 },
  { course: "espacios-confinados", daysAgo: 200, site: "Planta Centenario", who: ["L-004", "L-014", "L-019"], instructor: "Seguridad Industrial del Sur", external: true, provider: "Seguridad Industrial del Sur", hours: 8, attachment: "pdf" },
  { course: "izaje", daysAgo: 380, site: "Obra Loma Campana", who: ["L-008", "L-013", "C-103"], instructor: "Izajes Patagonia SA", external: true, provider: "Izajes Patagonia SA", hours: 6, attachment: "pdf" },
  { course: "manejo-defensivo", daysAgo: 100, site: "Base Añelo", who: ["L-011", "L-012", "C-105"], failed: ["L-012"], instructor: "Escuela de Manejo Vaca Muerta", external: true, provider: "Escuela de Manejo", hours: 8 },
  { course: "primeros-auxilios", daysAgo: 700, site: "Oficina Neuquén", who: ["L-002", "L-003", "L-020"], instructor: "Cruz Roja Neuquén", external: true, provider: "Cruz Roja", hours: 8, attachment: "pdf" },
  { course: "caliente", daysAgo: 20, site: "Obra Loma Campana", who: ["L-007", "L-009", "C-101"], instructor: "Bruno Sosa", hours: 4 },
  { course: "quimicos", daysAgo: 60, site: "Planta Centenario", who: ["L-010", "L-014"], instructor: "Laboratorios Delta SA", external: true, provider: "Laboratorios Delta SA", hours: 4 },
];

async function sessions(t: DemoTenant, actorUserId: string, c: Record<string, string>) {
  const personId = (code: string) => t.people.find((p) => p.code === code)!.id;
  const created: Record<string, string> = {};
  for (const [i, s] of SESSIONS.entries()) {
    await step(`Sesión ${s.course} (hace ${s.daysAgo} días)`, async () => {
      const { sessionId } = (await registerSession({
        tenantId: t.id,
        actorUserId,
        courseId: c[s.course],
        heldAt: ago(s.daysAgo),
        siteId: t.siteIds[s.site],
        level: i % 3 === 0 ? "operational" : "middle",
        instructorKind: s.external ? "external" : "internal",
        instructorName: s.instructor,
        providerName: s.provider ?? null,
        hours: s.hours,
        evaluatorUserId: t.users.hse.userId,
        attendees: s.who.map((code, n) => ({ personId: personId(code), result: s.failed?.includes(code) ? "failed" : "passed", score: s.failed?.includes(code) ? 4 : 6 + ((n * 7) % 5) })),
      })) as unknown as { sessionId: string };
      created[`${s.course}:${s.daysAgo}`] = sessionId;
      if (s.attachment && sessionId) {
        await uploadTrainingAttachment({
          tenantId: t.id,
          actorUserId,
          target: { sessionId },
          fileName: s.attachment === "pdf" ? `planilla-asistencia-${s.course}.pdf` : `foto-sesion-${s.course}.png`,
          contentType: s.attachment === "pdf" ? "application/pdf" : "image/png",
          body: s.attachment === "pdf" ? demoPdf(`Planilla ${s.course}`) : DEMO_PNG,
        });
      }
    });
  }
  return created;
}

async function individualRecords(t: DemoTenant, actorUserId: string, c: Record<string, string>) {
  const personId = (code: string) => t.people.find((p) => p.code === code)!.id;
  const plans = [
    { code: "L-013", course: "izaje", daysAgo: 30, validUntil: ahead(335), provider: "Operadores Certificados SA", cert: "OC-2025-8812", attach: "pdf" as const },
    { code: "L-011", course: "manejo-defensivo", daysAgo: 15, validUntil: ahead(710), provider: "Escuela de Manejo Vaca Muerta", cert: "EMVM-1180", attach: "png" as const },
    { code: "L-009", course: "altura", daysAgo: 400, validUntil: ago(35), provider: "Alturas Patagonia SRL", cert: "AP-7710", attach: "pdf" as const },
    { code: "L-002", course: "auditor-interno", daysAgo: 220, validUntil: null, provider: "IRAM", cert: "IRAM-AI-0912", attach: "pdf" as const },
    { code: "L-014", course: "altura", daysAgo: 60, validUntil: ahead(305), provider: "Alturas Patagonia SRL", cert: "AP-9921", attach: null },
    { code: "L-003", course: "auditor-interno", daysAgo: 500, validUntil: null, provider: "IRAM", cert: "IRAM-AI-0433", attach: "pdf" as const },
  ];
  for (const p of plans) {
    await step(`Registro individual ${p.code} · ${p.course}`, async () => {
      const record = (await addIndividualRecord({
        tenantId: t.id,
        actorUserId,
        personId: personId(p.code),
        courseId: c[p.course],
        completedAt: ago(p.daysAgo),
        result: "passed",
        score: 8,
        validUntil: p.validUntil,
        providerName: p.provider,
        certificateNumber: p.cert,
        notes: "Cargado desde el certificado del proveedor.",
        evaluatorUserId: t.users.hse.userId,
      })) as unknown as { id?: string; recordId?: string };
      const recordId = record.id ?? record.recordId;
      if (p.attach && recordId) {
        await uploadTrainingAttachment({
          tenantId: t.id,
          actorUserId,
          target: { recordId },
          fileName: p.attach === "pdf" ? `certificado-${p.cert}.pdf` : `certificado-${p.cert}.png`,
          contentType: p.attach === "pdf" ? "application/pdf" : "image/png",
          body: p.attach === "pdf" ? demoPdf(`Certificado ${p.cert}`) : DEMO_PNG,
        });
      }
    });
  }
}

export async function seedTrainingModule(t: DemoTenant) {
  const actorUserId = t.users.hse.userId;
  const c = await step("Cursos (sugeridos y propio)", () => courses(t, actorUserId));
  if (!c) return;
  await step("Matriz de requisitos y revisión", () => matrix(t, actorUserId, c));
  await step("Responsable de capacitaciones", () => setTrainingOwner({ tenantId: t.id, actorUserId, ownerUserId: t.users.hse.userId }));
  await sessions(t, actorUserId, c);
  await individualRecords(t, actorUserId, c);

  await step("Plan anual (sesiones planificadas)", async () => {
    const plan: [string, number, string][] = [
      ["altura", 25, "Obra Loma Campana"], ["izaje", 18, "Obra Loma Campana"], ["manejo-defensivo", 40, "Base Añelo"],
      ["primeros-auxilios", 55, "Oficina Neuquén"], ["incendio", 70, "Planta Centenario"], ["quimicos", 90, "Planta Centenario"],
    ];
    for (const [course, days, site] of plan) {
      await planSession({ tenantId: t.id, actorUserId, courseId: c[course], plannedFor: ahead(days), siteId: t.siteIds[site], notes: "Incluida en el programa anual de capacitación." });
    }
  });

  await step("Evaluación de eficacia de la sesión de altura (eficaz)", async () => {
    const session = await db.trainingSession.findFirst({ where: { tenantId: t.id, courseId: c["altura"], voidedAt: null, heldAt: { lt: new Date(`${ago(100)}T00:00:00Z`) } }, select: { id: true } });
    if (!session) throw new Error("No se encontró la sesión de altura");
    await evaluateEffectiveness({
      tenantId: t.id, actorUserId, canManage: true, sessionId: session.id, status: "effective", method: "practical_test",
      note: "Los trabajadores armaron y usaron la línea de vida sin desvíos en la obra.", today: TODAY,
    });
  });

  await step("Evaluación de eficacia de la sesión de izaje (no eficaz, con acción)", async () => {
    const session = await db.trainingSession.findFirst({ where: { tenantId: t.id, courseId: c["izaje"], voidedAt: null }, select: { id: true } });
    if (!session) throw new Error("No se encontró la sesión de izaje");
    await evaluateEffectiveness({
      tenantId: t.id, actorUserId, canManage: true, sessionId: session.id, status: "not_effective", method: "observation",
      note: "Se observaron maniobras sin señalero en la última semana.",
      resolution: { kind: "action", ownerUserId: t.users.hse.userId, dueAt: ahead(20), title: "Reentrenar al equipo de izaje y exigir señalero" },
      today: TODAY,
    });
  });

  await step("Anulación de un registro cargado por error", async () => {
    const record = await db.trainingRecord.findFirst({ where: { tenantId: t.id, voidedAt: null, course: { suggestedKey: "incendio" } }, select: { id: true } });
    if (!record) throw new Error("No hay registro de incendio");
    await voidRecord({ tenantId: t.id, actorUserId, recordId: record.id, reason: "La persona no asistió a esa sesión." });
  });

  await step("Avisos de capacitación por persona", () => reconcileSafely(t.id, { silent: false }));
}

export async function seedTrainingTenantB(t: DemoTenant) {
  const actorUserId = t.users.admin.userId;
  const c = await step("B: curso propio", () =>
    createCourse({ tenantId: t.id, actorUserId, draft: { name: "Trabajo en altura", code: "ALT-01", category: "safety", modality: "in_person", standards: ["ISO45001"], defaultHours: 8, validityMonths: 12, reminderDays: 30, requiresEffectiveness: false } }),
  );
  if (!c) return;
  await step("B: requisito y sesión", async () => {
    await applyRequirementChanges({
      tenantId: t.id, actorUserId,
      changes: [{ targetKind: "position", targetId: t.positionIds["Operario de planta"], courseId: c.id, state: "mandatory", graceDays: 15 }],
    });
    await registerSession({
      tenantId: t.id, actorUserId, courseId: c.id, heldAt: ago(90), instructorKind: "internal", instructorName: "Raúl Benítez", hours: 8,
      attendees: t.people.filter((p) => p.position === "Operario de planta").map((p) => ({ personId: p.id, result: "passed" as const, score: 9 })),
    });
  });
}
