import { localDateTimeToInstant } from "@/domain/safety-stats/period";
import { isClassification, type EmployerKind } from "@/domain/safety-stats/types";
import { SafetyStatsError, type IncidentFactInput, type IncidentHealthInput } from "@/lib/safety-stats";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const flag = (formData: FormData, key: string) => formData.get(key) === "on";

/** Campos del hecho del formulario (prefijo `fact_`). Los inexistentes quedan con el valor neutro. */
export function parseFactForm(formData: FormData): IncidentFactInput {
  const classification = text(formData, "fact_classification");
  if (!isClassification(classification)) throw new SafetyStatsError("Elegí cuánto se perdió", { classification: "Elegí cuánto se perdió" });
  const occurredAt = localDateTimeToInstant(text(formData, "fact_occurredAt"));
  if (!occurredAt) throw new SafetyStatsError("Ingresá la fecha y la hora del hecho", { occurredAt: "Ingresá la fecha y la hora del hecho" });
  const employer = text(formData, "fact_employerKind");
  const employerKind: EmployerKind = employer === "contractor" ? "contractor" : "own";
  const pct = text(formData, "fact_chargePct");
  return {
    siteId: text(formData, "fact_siteId"),
    occurredAt,
    classification,
    inItinere: flag(formData, "fact_inItinere"),
    isRoad: flag(formData, "fact_isRoad"),
    employerKind,
    restrictedWork: flag(formData, "fact_restrictedWork"),
    accidentForm: text(formData, "fact_accidentForm"),
    materialAgent: text(formData, "fact_materialAgent"),
    returnToWorkDate: text(formData, "fact_returnToWorkDate") || null,
    chargePct: pct ? Number(pct.replace(",", ".")) : null,
  };
}

export function parseHealthForm(formData: FormData): IncidentHealthInput {
  return {
    affectedPersonId: text(formData, "health_personId") || null,
    natureOfInjury: text(formData, "health_nature") || null,
    bodyPart: text(formData, "health_bodyPart") || null,
    artClaimNumber: text(formData, "health_art") || null,
    deathDate: text(formData, "health_deathDate") || null,
  };
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof SafetyStatsError || error instanceof Error ? error.message : fallback;
}
