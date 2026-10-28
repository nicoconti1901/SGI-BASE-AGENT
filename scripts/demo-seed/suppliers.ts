import {
  createSupplier,
  deactivateSupplier,
  getSupplier,
  linkPersonToSupplier,
  type SupplierInput,
} from "../../src/lib/suppliers";
import { getPublishedTemplate, listDocumentTypes } from "../../src/lib/supplier-criteria";
import { saveEvaluation, type EvaluationAnswer } from "../../src/lib/supplier-evaluations";
import { uploadSupplierDocument } from "../../src/lib/supplier-documents";
import { createSupplierFinding, recordCommunication } from "../../src/lib/supplier-followup";
import { addDays, buenosAiresToday } from "../../src/domain/suppliers/dates";
import { criteriaForEvaluation, type EvaluationKindValue } from "../../src/domain/suppliers/evaluation";
import type { EvaluationModeValue, SupplierTypeValue } from "../../src/domain/suppliers/types";
import { DEMO_PNG, cuit, db, demoPdf, step, type DemoTenant } from "./kit";

const TODAY = buenosAiresToday(new Date());
const ago = (days: number) => addDays(TODAY, -days);
const ahead = (days: number) => addDays(TODAY, days);

type Plan = {
  name: string;
  trade?: string;
  cuit: [string, number];
  type: SupplierTypeValue;
  criticality: "critical" | "standard" | "low";
  category: string;
  contact: string;
  email: string;
  phone: string;
  sites?: string[];
  /** Evaluación inicial: hace cuántos días y qué nota (o una función por criterio). */
  evaluation?: { daysAgo: number; score: number | ((criterion: string) => number); kind?: EvaluationKindValue };
  /** Segunda evaluación (periódica), más reciente. */
  followUp?: { daysAgo: number; score: number };
  /** Documentos: índice en la lista de tipos, emisión y vencimiento relativos a hoy. */
  documents?: { type: number; issuedAgo: number; expiresIn: number | null }[];
  people?: string[];
  deactivate?: string;
};

const PLANS: Plan[] = [
  {
    name: "Montajes Industriales del Comahue SRL", trade: "Montajes del Comahue", cuit: ["30", 71234500], type: "contractor", criticality: "critical", category: "Montaje y soldadura",
    contact: "Fernando Aranda", email: "faranda@montajescomahue.test", phone: "299 4455-1020", sites: ["Obra Loma Campana"],
    evaluation: { daysAgo: 200, score: 5 }, followUp: { daysAgo: 20, score: 4 },
    documents: [{ type: 0, issuedAgo: 120, expiresIn: 245 }, { type: 1, issuedAgo: 60, expiresIn: 300 }, { type: 2, issuedAgo: 30, expiresIn: 15 }, { type: 3, issuedAgo: 200, expiresIn: 165 }],
    people: ["C-101", "C-102"],
  },
  {
    name: "Izajes Patagonia SA", cuit: ["30", 70987600], type: "contractor", criticality: "critical", category: "Izaje y transporte de cargas",
    contact: "Mabel Rojas", email: "mrojas@izajespatagonia.test", phone: "299 4455-3344", sites: ["Obra Loma Campana", "Base Añelo"],
    evaluation: { daysAgo: 100, score: 3 },
    documents: [{ type: 0, issuedAgo: 400, expiresIn: -35 }, { type: 1, issuedAgo: 100, expiresIn: 265 }, { type: 2, issuedAgo: 100, expiresIn: 10 }],
    people: ["C-103"],
  },
  {
    name: "Limpieza Industrial Austral SRL", cuit: ["30", 71555100], type: "contractor", criticality: "standard", category: "Limpieza industrial",
    contact: "Cecilia Barrios", email: "cbarrios@limpiezaaustral.test", phone: "299 4411-7788", sites: ["Planta Centenario"],
    evaluation: { daysAgo: 150, score: (n) => (n.startsWith("Calidad") || n.startsWith("Seguridad") ? 1 : 4) },
    documents: [{ type: 0, issuedAgo: 300, expiresIn: 65 }],
  },
  {
    name: "Transportes Cuyo SA", cuit: ["30", 70112200], type: "contractor", criticality: "critical", category: "Transporte de personal",
    contact: "Héctor Vallejos", email: "hvallejos@transportescuyo.test", phone: "261 4400-2201",
    evaluation: { daysAgo: 800, score: 4 },
    documents: [{ type: 0, issuedAgo: 500, expiresIn: -140 }, { type: 1, issuedAgo: 200, expiresIn: 165 }],
    people: ["C-105"],
  },
  {
    name: "Matafuegos Neuquén SRL", cuit: ["30", 71890300], type: "service", criticality: "standard", category: "Mantenimiento de extintores",
    contact: "Raquel Ñancucheo", email: "rnancucheo@matafuegosnqn.test", phone: "299 4488-9090",
    evaluation: { daysAgo: 60, score: 5 }, documents: [{ type: 0, issuedAgo: 60, expiresIn: 305 }],
  },
  {
    name: "Metrología Austral SA", cuit: ["30", 70764400], type: "service", criticality: "critical", category: "Laboratorio de calibración",
    contact: "Dr. Alberto Kessler", email: "akessler@metrologiaaustral.test", phone: "299 4433-6600",
    evaluation: { daysAgo: 130, score: 5 }, documents: [{ type: 0, issuedAgo: 130, expiresIn: 235 }, { type: 1, issuedAgo: 130, expiresIn: 235 }],
  },
  {
    name: "EPP Patagonia SA", trade: "EPP Patagonia", cuit: ["30", 71345600], type: "product", criticality: "standard", category: "Elementos de protección personal",
    contact: "Silvana Iturralde", email: "siturralde@epppatagonia.test", phone: "299 4466-1212",
    evaluation: { daysAgo: 45, score: 4 }, documents: [{ type: 0, issuedAgo: 45, expiresIn: 320 }],
  },
  {
    name: "Ferretería Industrial Alto Valle", cuit: ["30", 70623400], type: "product", criticality: "low", category: "Ferretería y repuestos",
    contact: "Oscar Tapia", email: "otapia@ferrealtovalle.test", phone: "299 4470-5544",
  },
  {
    name: "Combustibles del Sur SA", cuit: ["30", 70511000], type: "product", criticality: "critical", category: "Combustibles y lubricantes",
    contact: "Natalia Giusti", email: "ngiusti@combustiblesdelsur.test", phone: "299 4499-0033", sites: ["Base Añelo", "Obra Loma Campana"],
    documents: [{ type: 0, issuedAgo: 20, expiresIn: 345 }],
  },
  {
    name: "Repuestos Hidráulicos SRL", cuit: ["30", 71029800], type: "product", criticality: "standard", category: "Repuestos hidráulicos",
    contact: "Dante Colombo", email: "dcolombo@repuestoshidraulicos.test", phone: "299 4401-7766",
    evaluation: { daysAgo: 90, score: 3 },
  },
  {
    name: "Catering Campamentos del Sur", cuit: ["30", 71188700], type: "service", criticality: "standard", category: "Catering",
    contact: "Mónica Sepúlveda", email: "msepulveda@cateringsur.test", phone: "299 4455-8070", sites: ["Campamento Sauzal"],
    evaluation: { daysAgo: 300, score: 4 }, deactivate: "Se terminó el contrato del campamento.",
  },
  {
    name: "Servicios Eléctricos del Alto Valle SRL", cuit: ["30", 70877900], type: "contractor", criticality: "standard", category: "Instalaciones eléctricas",
    contact: "Ariel Mansilla", email: "amansilla@seav.test", phone: "299 4460-3322", sites: ["Obra Loma Campana"],
    evaluation: { daysAgo: 70, score: 4 }, documents: [{ type: 0, issuedAgo: 400, expiresIn: -30 }, { type: 1, issuedAgo: 70, expiresIn: 295 }],
  },
  {
    name: "Alturas Patagonia SRL", cuit: ["30", 71456200], type: "service", criticality: "standard", category: "Capacitación en seguridad",
    contact: "Ing. Verónica Paz", email: "vpaz@alturaspatagonia.test", phone: "299 4412-9900",
    evaluation: { daysAgo: 110, score: 5 }, documents: [{ type: 0, issuedAgo: 110, expiresIn: 255 }],
  },
  {
    name: "Laboratorios Delta SA", cuit: ["30", 70299500], type: "service", criticality: "low", category: "Análisis de laboratorio",
    contact: "Lic. Gonzalo Peña", email: "gpena@labdelta.test", phone: "299 4420-1010",
    evaluation: { daysAgo: 250, score: 4 },
  },
];

async function answers(tenantId: string, type: SupplierTypeValue, kind: EvaluationKindValue, mode: EvaluationModeValue, pick: number | ((name: string) => number)): Promise<EvaluationAnswer[]> {
  const template = await getPublishedTemplate(tenantId, type, db);
  if (!template) throw new Error(`No hay plantilla publicada para ${type}`);
  return criteriaForEvaluation(template.criteria, kind, mode).map((c) => {
    const score = typeof pick === "number" ? pick : pick(c.name);
    return { criterionId: c.id, score, comment: score <= 2 ? "Se observaron incumplimientos en la revisión de la documentación y en una visita." : "" };
  });
}

export async function seedSuppliersModule(t: DemoTenant) {
  const actorUserId = t.users.calidad.userId;
  const ownerUserId = t.users.hse.userId;
  const typesFor = async () => (await listDocumentTypes(t.id, db)).filter((d) => d.active !== false);
  const created: Record<string, string> = {};

  for (const p of PLANS) {
    const supplier = await step(`Proveedor ${p.name}`, () => {
      const input: SupplierInput & { tenantId: string; actorUserId: string } = {
        tenantId: t.id,
        actorUserId,
        legalName: p.name,
        tradeName: p.trade ?? null,
        taxId: cuit(p.cuit[0], p.cuit[1]),
        type: p.type,
        category: p.category,
        criticality: p.criticality,
        criticalityReason: p.criticality === "critical" ? "Afecta la seguridad de las personas o la continuidad de la obra." : p.criticality === "low" ? "Compras ocasionales y de bajo impacto." : null,
        ownerUserId: p.type === "contractor" ? ownerUserId : actorUserId,
        contactName: p.contact,
        contactEmail: p.email,
        contactPhone: p.phone,
        notes: `Proveedor de demo — ${p.category}.`,
        siteIds: (p.sites ?? []).map((s) => t.siteIds[s]),
      };
      return createSupplier(input);
    });
    if (!supplier) continue;
    created[p.name] = supplier.id;

    if (p.evaluation) {
      const { evaluation: ev } = p;
      await step(`Evaluación inicial de ${p.name}`, async () => {
        const score = ev.score;
        const result = await saveEvaluation({
          tenantId: t.id,
          actorUserId,
          supplierId: supplier.id,
          kind: "initial",
          mode: "full",
          evaluatedAt: ago(ev.daysAgo),
          comment: "Evaluación inicial con revisión de documentación y visita.",
          answers: await answers(t.id, p.type, "initial", "full", score),
          plan: { ownerUserId, dueAt: ahead(30) },
        });
        void result;
      });
    }
    if (p.followUp) {
      const fu = p.followUp;
      await step(`Evaluación periódica de ${p.name}`, async () => {
        await saveEvaluation({
          tenantId: t.id,
          actorUserId,
          supplierId: supplier.id,
          kind: "periodic",
          mode: "full",
          evaluatedAt: ago(fu.daysAgo),
          periodFrom: ago(fu.daysAgo + 180),
          periodTo: ago(fu.daysAgo),
          answers: await answers(t.id, p.type, "periodic", "full", fu.score),
          plan: { ownerUserId, dueAt: ahead(30) },
        });
      });
    }

    if (p.documents) {
      const types = (await typesFor()).filter((x) => (x.appliesTo as string[]).includes(p.type));
      for (const d of p.documents) {
        const type = types[d.type % Math.max(types.length, 1)];
        if (!type) continue;
        await step(`Documento «${type.name}» de ${p.name}`, () =>
          uploadSupplierDocument({
            tenantId: t.id,
            actorUserId,
            supplierId: supplier.id,
            typeId: type.id,
            issuedAt: ago(d.issuedAgo),
            expiresAt: d.expiresIn === null ? null : ahead(d.expiresIn),
            fileName: `${type.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${p.name.split(" ")[0].toLowerCase()}.pdf`,
            contentType: "application/pdf",
            body: demoPdf(`${type.name} - ${p.name}`),
          }),
        );
      }
    }

    for (const code of p.people ?? []) {
      const person = t.people.find((x) => x.code === code);
      if (person) await step(`Vincular ${person.name} con ${p.name}`, () => linkPersonToSupplier({ tenantId: t.id, actorUserId, supplierId: supplier.id, personId: person.id }));
    }
  }

  // Seguimiento: hallazgos del proveedor, comunicaciones y una baja.
  const izajes = created["Izajes Patagonia SA"];
  if (izajes) {
    await step("Hallazgo de seguridad sobre Izajes Patagonia", () =>
      createSupplierFinding({ tenantId: t.id, actorUserId, supplierId: izajes, kind: "safety", description: "La grúa hidráulica operó sin señalero en dos maniobras de izaje en Loma Campana.", detectedAt: ago(8) }),
    );
    await step("Comunicación de requisitos a Izajes Patagonia", () =>
      recordCommunication({
        tenantId: t.id, actorUserId, supplierId: izajes, kind: "requirements", channel: "email", sentAt: ago(7), recipientName: "Mabel Rojas",
        summary: "Se enviaron los requisitos de seguridad para trabajos de izaje y el pedido de renovación del seguro vencido.",
        file: { fileName: "requisitos-izaje.pdf", contentType: "application/pdf", body: demoPdf("Requisitos de seguridad para izaje") },
      }),
    );
  }
  const limpieza = created["Limpieza Industrial Austral SRL"];
  if (limpieza) {
    await step("Hallazgo de calidad sobre Limpieza Industrial", () =>
      createSupplierFinding({ tenantId: t.id, actorUserId, supplierId: limpieza, kind: "quality", description: "El servicio dejó residuos peligrosos mezclados con residuos comunes.", detectedAt: ago(15) }),
    );
  }
  const catering = created["Catering Campamentos del Sur"];
  if (catering) {
    await step("Baja del proveedor de catering", () => deactivateSupplier({ tenantId: t.id, actorUserId, id: catering, reason: PLANS.find((p) => p.deactivate)!.deactivate! }));
  }
  const metrologia = created["Metrología Austral SA"];
  if (metrologia) {
    await step("Comunicación del resultado de evaluación a Metrología Austral", async () => {
      const ev = await db.supplierEvaluation.findFirst({ where: { tenantId: t.id, supplierId: metrologia, voidedAt: null }, select: { id: true } });
      if (!ev) throw new Error("No hay evaluación");
      await recordCommunication({ tenantId: t.id, actorUserId, supplierId: metrologia, kind: "evaluation_result", channel: "meeting", sentAt: ago(100), summary: "Se informó el resultado de la evaluación en la reunión semestral.", evaluationId: ev.id });
    });
  }
  void DEMO_PNG;
  void getSupplier;
  return created;
}

export async function seedSuppliersTenantB(t: DemoTenant) {
  const actorUserId = t.users.admin.userId;
  await step("B: proveedores", async () => {
    for (const [name, body, type] of [["Envases del Sur SRL", 70330100, "product"], ["Control de Plagas Plottier", 71220400, "service"]] as const) {
      const s = await createSupplier({
        tenantId: t.id, actorUserId, legalName: name, taxId: cuit("30", body), type, criticality: "standard", category: type === "product" ? "Envases" : "Control de plagas",
        contactName: "Contacto de demo", contactEmail: "contacto@demo-sur.test", ownerUserId: actorUserId,
      });
      await saveEvaluation({ tenantId: t.id, actorUserId, supplierId: s.id, kind: "initial", mode: "full", evaluatedAt: ago(40), answers: await answers(t.id, type, "initial", "full", 4) });
    }
  });
}
