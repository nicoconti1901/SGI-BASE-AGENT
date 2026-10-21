import type { IsoStandardCode } from "@/domain/ims/catalog";
import { cleanName } from "@/domain/masterdata/roster";

export const COURSE_CATEGORIES = ["induction", "awareness", "safety", "environment", "quality", "driving", "other"] as const;
export type CourseCategoryValue = (typeof COURSE_CATEGORIES)[number];

export const COURSE_CATEGORY_LABELS: Record<CourseCategoryValue, string> = {
  induction: "Inducción",
  awareness: "Toma de conciencia",
  safety: "Seguridad e higiene",
  environment: "Ambiente",
  quality: "Calidad",
  driving: "Conducción",
  other: "Otro",
};

export const COURSE_MODALITIES = ["in_person", "online", "on_the_job", "external"] as const;
export type CourseModalityValue = (typeof COURSE_MODALITIES)[number];

export const COURSE_MODALITY_LABELS: Record<CourseModalityValue, string> = {
  in_person: "Presencial",
  online: "En línea",
  on_the_job: "En el puesto de trabajo",
  external: "Con proveedor externo",
};

export const COURSE_STANDARDS: readonly IsoStandardCode[] = ["ISO9001", "ISO14001", "ISO45001"];

export const COURSE_LIMITS = {
  validityMonths: { min: 1, max: 120 },
  reminderDays: { min: 15, max: 90 },
  effectivenessDays: { min: 30, max: 180 },
} as const;

export type CourseInput = {
  name: string;
  code: string | null;
  category: CourseCategoryValue;
  standards: IsoStandardCode[];
  modality: CourseModalityValue;
  defaultHours: number | null;
  /** `null` = no vence. */
  validityMonths: number | null;
  reminderDays: number;
  requiresEffectiveness: boolean;
  effectivenessDays: number;
  legalBasis: string | null;
  defaultProvider: string | null;
};

export type CourseDraft = Partial<Omit<CourseInput, "name">> & { name: string };

export type CourseValidation = { ok: true; value: CourseInput } | { ok: false; error: string };

function inRange(n: number, r: { min: number; max: number }) {
  return Number.isInteger(n) && n >= r.min && n <= r.max;
}

/** Valida y completa los valores por defecto del SPEC (aviso a 30 días, eficacia a 90). */
export function validateCourseInput(raw: CourseDraft): CourseValidation {
  const name = cleanName(raw.name);
  if (name.length < 2) return { ok: false, error: "El nombre debe tener al menos 2 caracteres" };

  const validityMonths = raw.validityMonths ?? null;
  if (validityMonths !== null && !inRange(validityMonths, COURSE_LIMITS.validityMonths)) {
    return { ok: false, error: "La vigencia va de 1 a 120 meses; dejala vacía si el curso no vence" };
  }
  const reminderDays = raw.reminderDays ?? 30;
  if (!inRange(reminderDays, COURSE_LIMITS.reminderDays)) {
    return { ok: false, error: "El aviso previo va de 15 a 90 días" };
  }
  const effectivenessDays = raw.effectivenessDays ?? 90;
  if (!inRange(effectivenessDays, COURSE_LIMITS.effectivenessDays)) {
    return { ok: false, error: "El plazo para evaluar la eficacia va de 30 a 180 días" };
  }
  const defaultHours = raw.defaultHours ?? null;
  if (defaultHours !== null && !(defaultHours > 0 && defaultHours <= 999)) {
    return { ok: false, error: "Las horas tienen que ser mayores que cero" };
  }
  const category = raw.category ?? "other";
  const modality = raw.modality ?? "in_person";
  if (!COURSE_CATEGORIES.includes(category)) return { ok: false, error: "Categoría inválida" };
  if (!COURSE_MODALITIES.includes(modality)) return { ok: false, error: "Modalidad inválida" };
  const standards = [...new Set(raw.standards ?? [])].filter((s) => COURSE_STANDARDS.includes(s));

  return {
    ok: true,
    value: {
      name,
      code: cleanName(raw.code ?? "") || null,
      category,
      standards,
      modality,
      defaultHours,
      validityMonths,
      reminderDays,
      requiresEffectiveness: raw.requiresEffectiveness ?? false,
      effectivenessDays,
      legalBasis: cleanName(raw.legalBasis ?? "") || null,
      defaultProvider: cleanName(raw.defaultProvider ?? "") || null,
    },
  };
}
