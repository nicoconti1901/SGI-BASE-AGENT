import { z } from "zod";
import { channelsSchema, DECISION_RULES, MAGNITUDES } from "./types";

export const MAX_INTERVAL_MONTHS = 120;

export type FieldIssue = { field: string; message: string };

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

/** Atributos descriptivos del equipo (van en `Asset.attributes`). */
export const instrumentAttributesSchema = z.object({
  brand: optionalText(80),
  model: optionalText(80),
  serialNumber: optionalText(80),
  inServiceSince: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type InstrumentAttributes = z.infer<typeof instrumentAttributesSchema>;

const interval = z.number().int("Indicá meses enteros").min(1, "Al menos 1 mes").max(MAX_INTERVAL_MONTHS, `Hasta ${MAX_INTERVAL_MONTHS} meses`);

/** Configuración metrológica del equipo (`InstrumentControl`). */
export const controlConfigSchema = z.object({
  magnitude: z.enum(MAGNITUDES, { error: "Elegí la magnitud" }),
  isReferenceStandard: z.boolean().default(false),
  criticalUse: z.boolean().default(false),
  criticalUseReason: optionalText(300),
  requiresCalibration: z.boolean().default(false),
  calibrationIntervalMonths: interval.nullish(),
  requiresVerification: z.boolean().default(false),
  verificationIntervalMonths: interval.nullish(),
  intervalReason: optionalText(300),
  noControlReason: optionalText(300),
  decisionRule: z.enum(DECISION_RULES).default("guard_band"),
  decisionRuleReason: optionalText(300),
  alertLeadDays: z.number().int().min(0).max(365).default(30),
  channels: channelsSchema.default([]),
});
export type ControlConfigInput = z.input<typeof controlConfigSchema>;
export type ControlConfig = z.output<typeof controlConfigSchema>;

/**
 * Valida la configuración completa. Reglas del SPEC: sin ningún control se exige una justificación;
 * cada control requerido lleva su intervalo; una regla distinta de la de banda de guarda se justifica;
 * y un equipo que se evalúa por puntos necesita al menos un canal activo.
 */
export function validateControlConfig(raw: unknown): { ok: true; config: ControlConfig } | { ok: false; issues: FieldIssue[] } {
  const parsed = controlConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) };
  }
  const c = parsed.data;
  const issues: FieldIssue[] = [];
  const controlled = c.requiresCalibration || c.requiresVerification;
  if (!controlled && !c.noControlReason) {
    issues.push({ field: "noControlReason", message: "Si el equipo no se calibra ni se verifica, explicá por qué (por ejemplo: «indicativo, no se usa para decidir»)" });
  }
  if (c.requiresCalibration && !c.calibrationIntervalMonths) issues.push({ field: "calibrationIntervalMonths", message: "Indicá cada cuántos meses se calibra" });
  if (c.requiresVerification && !c.verificationIntervalMonths) issues.push({ field: "verificationIntervalMonths", message: "Indicá cada cuántos meses se verifica" });
  if (c.decisionRule !== "guard_band" && !c.decisionRuleReason) {
    issues.push({ field: "decisionRuleReason", message: "Justificá por qué no usás la regla por defecto (error más incertidumbre)" });
  }
  if (c.criticalUse && !c.criticalUseReason) issues.push({ field: "criticalUseReason", message: "Contá por qué es de uso crítico" });
  if (controlled && c.decisionRule !== "certificate_statement" && !c.channels.some((ch) => ch.active)) {
    issues.push({ field: "channels", message: "Cargá al menos un canal activo con su rango y su error máximo permitido" });
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, config: c };
}
