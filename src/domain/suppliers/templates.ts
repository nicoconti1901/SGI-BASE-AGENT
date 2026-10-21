import { normalizeKey } from "@/domain/masterdata/roster";
import type {
  CriterionPhaseValue,
  DocumentRecurrenceValue,
  SupplierTypeValue,
  Thresholds,
} from "./types";

export type TemplateCriterionInput = {
  name: string;
  description: string;
  /** Qué significa una nota de 1, 3 y 5: sin descriptores el puntaje es opinión. */
  descriptor1: string;
  descriptor3: string;
  descriptor5: string;
  weight: number;
  excluding: boolean;
  allowNA: boolean;
  phase: CriterionPhaseValue;
  /** Entra en la evaluación simplificada. */
  basic: boolean;
};

export type TemplateInput = Thresholds & { criteria: readonly TemplateCriterionInput[] };

export type TemplateIssueCode =
  | "NO_CRITERIA"
  | "WEIGHTS_SUM"
  | "EXCLUDING_NA"
  | "DUPLICATE_NAME"
  | "EMPTY_NAME"
  | "INVALID_WEIGHT"
  | "INVALID_THRESHOLDS";

export type TemplateIssue = { code: TemplateIssueCode; message: string };

/** Reglas al publicar una versión: pesos que suman 100, excluyente sin N/A, nombres únicos, umbrales coherentes. */
export function validateTemplateForPublish(
  template: TemplateInput,
): { ok: true } | { ok: false; errors: TemplateIssue[] } {
  const errors: TemplateIssue[] = [];
  const { criteria } = template;

  if (criteria.length === 0) errors.push({ code: "NO_CRITERIA", message: "Agregá al menos un criterio" });

  if (criteria.some((c) => !c.name.trim())) errors.push({ code: "EMPTY_NAME", message: "Todos los criterios necesitan un nombre" });

  if (criteria.some((c) => !Number.isInteger(c.weight) || c.weight <= 0)) {
    errors.push({ code: "INVALID_WEIGHT", message: "Cada peso tiene que ser un número entero mayor que 0" });
  } else if (criteria.length > 0 && criteria.reduce((sum, c) => sum + c.weight, 0) !== 100) {
    errors.push({ code: "WEIGHTS_SUM", message: "Los pesos tienen que sumar 100" });
  }

  const excludingNA = criteria.filter((c) => c.excluding && c.allowNA).map((c) => c.name.trim());
  if (excludingNA.length > 0) {
    errors.push({ code: "EXCLUDING_NA", message: `Un criterio excluyente no puede ser «No aplica»: ${excludingNA.join(", ")}` });
  }

  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const c of criteria) {
    const key = normalizeKey(c.name);
    if (!key) continue;
    if (seen.has(key)) repeated.add(c.name.trim());
    seen.add(key);
  }
  if (repeated.size > 0) errors.push({ code: "DUPLICATE_NAME", message: `Hay nombres repetidos: ${[...repeated].join(", ")}` });

  const { approvedMin, conditionalMin } = template;
  if (conditionalMin < 0 || approvedMin > 100 || conditionalMin > approvedMin) {
    errors.push({ code: "INVALID_THRESHOLDS", message: "El umbral de «con condiciones» no puede superar al de «aprobado», y ninguno puede pasar de 100" });
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

// ─── Plantillas v1 (RESEARCH-suppliers.md §C): propuesta de partida, a validar con un auditor ───

type CriterionBase = Omit<TemplateCriterionInput, "weight" | "excluding" | "allowNA" | "basic">;

const quality = (what: string): CriterionBase => ({
  name: `Calidad / conformidad del ${what}`,
  description: `Si lo que entrega cumple lo pactado y lo que exige la empresa.`,
  descriptor1: "Entregas no conformes o con defectos de forma frecuente",
  descriptor3: "Defectos ocasionales que se resuelven sin mayor impacto",
  descriptor5: "Sin no conformidades en el período",
  phase: "performance",
});

const SST: CriterionBase = {
  name: "Seguridad y salud en el trabajo",
  description: "Reglas de seguridad, uso de EPP e incidentes en el período.",
  descriptor1: "Incumple las reglas de seguridad o tuvo incidentes graves",
  descriptor3: "Cumple lo básico, con desvíos menores",
  descriptor5: "Cumple las reglas, usa EPP y no tuvo incidentes",
  phase: "both",
};

const DELIVERY: CriterionBase = {
  name: "Cumplimiento de plazos y cantidades",
  description: "Si entrega o ejecuta en el plazo y la cantidad acordados.",
  descriptor1: "Incumple plazos o cantidades con frecuencia",
  descriptor3: "Retrasos ocasionales, avisados con tiempo",
  descriptor5: "Cumple plazos y cantidades siempre",
  phase: "performance",
};

const COMPETENCE: CriterionBase = {
  name: "Competencia e idoneidad del personal",
  description: "Si quienes trabajan para la empresa están capacitados para la tarea.",
  descriptor1: "Personal sin la idoneidad requerida",
  descriptor3: "Idoneidad suficiente, con alguna capacitación pendiente",
  descriptor5: "Personal calificado y con la capacitación al día",
  phase: "both",
};

const CLAIMS: CriterionBase = {
  name: "Respuesta a reclamos y hallazgos",
  description: "Qué tan rápido y bien resuelve lo que se le reclama.",
  descriptor1: "No responde o tarda mucho en resolver los reclamos",
  descriptor3: "Responde, pero con demoras",
  descriptor5: "Responde rápido y corrige la causa",
  phase: "performance",
};

const DOCS: CriterionBase = {
  name: "Documentación",
  description: "Certificados, fichas técnicas y papeles legales al día.",
  descriptor1: "Falta documentación o está vencida",
  descriptor3: "Documentación completa, con algún faltante menor",
  descriptor5: "Documentación completa y vigente",
  phase: "both",
};

const COMMERCIAL: CriterionBase = {
  name: "Condiciones comerciales",
  description: "Precio, plazos de pago y condiciones. Se mira al seleccionar, no al seguir su desempeño.",
  descriptor1: "Condiciones desfavorables o poco claras",
  descriptor3: "Condiciones aceptables",
  descriptor5: "Condiciones claras y convenientes",
  phase: "selection",
};

const ENVIRONMENT: CriterionBase = {
  name: "Desempeño ambiental",
  description: "Residuos, derrames y requisitos ambientales que le aplican.",
  descriptor1: "Incumple requisitos ambientales o tuvo derrames o incidentes",
  descriptor3: "Cumple lo exigido, con desvíos menores",
  descriptor5: "Cumple y gestiona bien sus residuos y su impacto",
  phase: "both",
};

const c = (
  base: CriterionBase,
  weight: number,
  extra: Partial<Pick<TemplateCriterionInput, "excluding" | "allowNA" | "basic">> = {},
): TemplateCriterionInput => ({ ...base, weight, excluding: false, allowNA: false, basic: false, ...extra });

export const DEFAULT_CRITERIA: Record<SupplierTypeValue, TemplateCriterionInput[]> = {
  product: [
    c(quality("producto"), 30, { excluding: true }),
    c(DELIVERY, 25, { basic: true }),
    c(CLAIMS, 15),
    c(DOCS, 10, { basic: true }),
    c(COMMERCIAL, 10),
    c(ENVIRONMENT, 10, { allowNA: true }),
  ],
  service: [
    c(quality("servicio"), 30, { excluding: true }),
    c(DELIVERY, 20, { basic: true }),
    c(COMPETENCE, 15),
    c(CLAIMS, 15),
    c(DOCS, 10, { basic: true }),
    c(ENVIRONMENT, 10, { allowNA: true }),
  ],
  contractor: [
    c(quality("trabajo"), 20),
    c(SST, 30, { excluding: true }),
    c(DELIVERY, 15, { basic: true }),
    c(COMPETENCE, 10),
    c(CLAIMS, 10),
    c(DOCS, 5, { basic: true }),
    c(ENVIRONMENT, 10),
  ],
};

export type DocumentTypeInput = {
  key: string;
  name: string;
  appliesTo: SupplierTypeValue[];
  required: boolean;
  blocksEnablement: boolean;
  validityMonths: number | null;
  recurrence: DocumentRecurrenceValue;
  note: string;
};

const MARKET = "Orientativo: práctica de mercado, validar con su asesor.";
const LEGAL = "Orientativo: validar con su asesor legal y de seguridad e higiene.";

/** Juego sugerido al activar el módulo (Research F). Todo editable por la empresa. */
export const DEFAULT_DOCUMENT_TYPES: DocumentTypeInput[] = [
  { key: "art_certificate", name: "Certificado de cobertura de ART (con cláusula de no repetición o endoso a favor de la empresa)", appliesTo: ["contractor"], required: true, blocksEnablement: true, validityMonths: null, recurrence: "none", note: LEGAL },
  { key: "personnel_roster", name: "Nómina de personal cubierto", appliesTo: ["contractor"], required: true, blocksEnablement: true, validityMonths: null, recurrence: "none", note: LEGAL },
  { key: "life_insurance", name: "Seguro de vida colectivo (certificado)", appliesTo: ["contractor"], required: true, blocksEnablement: true, validityMonths: null, recurrence: "none", note: LEGAL },
  { key: "f931", name: "F.931 y constancia de pago a la seguridad social", appliesTo: ["contractor"], required: true, blocksEnablement: true, validityMonths: 1, recurrence: "monthly", note: LEGAL },
  { key: "tax_registration", name: "Constancia de inscripción (CUIT / ARCA)", appliesTo: ["product", "service", "contractor"], required: true, blocksEnablement: false, validityMonths: null, recurrence: "none", note: MARKET },
  { key: "safety_program", name: "Programa de Seguridad aprobado por la ART (obras)", appliesTo: ["contractor"], required: false, blocksEnablement: false, validityMonths: null, recurrence: "none", note: LEGAL },
  { key: "liability_insurance", name: "Seguro de responsabilidad civil", appliesTo: ["service", "contractor"], required: false, blocksEnablement: false, validityMonths: null, recurrence: "none", note: MARKET },
  { key: "personal_accident", name: "Póliza de accidentes personales (autónomos)", appliesTo: ["contractor"], required: false, blocksEnablement: false, validityMonths: null, recurrence: "none", note: MARKET },
  { key: "specific_permits", name: "Habilitaciones específicas del rubro (transporte, residuos, matrículas)", appliesTo: ["product", "service", "contractor"], required: false, blocksEnablement: false, validityMonths: null, recurrence: "none", note: MARKET },
  { key: "iso_certificate", name: "Certificación ISO u otras", appliesTo: ["product", "service"], required: false, blocksEnablement: false, validityMonths: null, recurrence: "none", note: MARKET },
];
