import { computeLostDays, diffDays, isIsoDay, localDay } from "@/domain/safety-stats/period";
import {
  ACCIDENT_FORM_KEYS,
  BODY_PART_KEYS,
  DEFAULT_SAFETY_SETTINGS,
  INJURY_CLASSIFICATIONS,
  MATERIAL_AGENT_KEYS,
  NATURE_KEYS,
  type IncidentClassification,
  type IsoDay,
} from "@/domain/safety-stats/types";

export type FieldErrors = Record<string, string>;
export type Validation = { errors: FieldErrors; warnings: string[] };

export type IncidentFactInput = {
  classification: IncidentClassification;
  inItinere: boolean;
  /** Hecho de tránsito: «solo daño material» lo exige (SPEC-road-safety D9). */
  isRoad?: boolean;
  restrictedWork: boolean;
  occurredAt: Date;
  now: Date;
  accidentForm: string;
  materialAgent: string;
  returnToWorkDate?: IsoDay | null;
  chargePct?: number | null;
  /** Días que alguien tipeó a mano, solo para avisar en un fatal. */
  lostDaysEntered?: number | null;
  lostDaysCap?: number;
  timeZone?: string;
};

/** Reglas del hecho (tabla de casos borde del SPEC). Un error impide guardar; una advertencia no. */
export function validateIncident(input: IncidentFactInput): Validation {
  const errors: FieldErrors = {};
  const warnings: string[] = [];
  const cap = input.lostDaysCap ?? DEFAULT_SAFETY_SETTINGS.lostDaysCap;

  if (Number.isNaN(input.occurredAt.getTime())) {
    errors.occurredAt = "Ingresá la fecha y la hora del hecho";
  } else if (input.occurredAt.getTime() > input.now.getTime()) {
    errors.occurredAt = "La fecha del hecho no puede ser futura";
  }

  if (!ACCIDENT_FORM_KEYS.includes(input.accidentForm)) errors.accidentForm = "Elegí la forma del accidente";
  if (!MATERIAL_AGENT_KEYS.includes(input.materialAgent)) errors.materialAgent = "Elegí el agente";

  if (input.inItinere && (input.classification === "near_miss" || input.classification === "occupational_disease")) {
    errors.inItinere =
      input.classification === "near_miss"
        ? "Un casi accidente no puede ser en el trayecto al trabajo"
        : "Una enfermedad profesional no puede ser en el trayecto al trabajo";
  }

  if (input.classification === "property_damage_only" && input.isRoad === false) {
    errors.classification = "«Solo daño material» es propio de un hecho de tránsito: marcalo como tal";
  }

  if (input.restrictedWork && input.classification !== "no_lost_time") {
    errors.restrictedWork = "Las tareas restringidas solo aplican a un accidente sin baja";
  }

  if (input.returnToWorkDate && input.classification !== "lost_time") {
    errors.returnToWorkDate = "La fecha de reintegro solo se carga en un accidente con baja";
  }

  if (input.chargePct != null && (input.chargePct < 0 || input.chargePct > 100)) {
    errors.chargePct = "La incapacidad permanente va entre 0 y 100";
  }

  if (input.returnToWorkDate && !errors.occurredAt && !errors.returnToWorkDate) {
    if (!isIsoDay(input.returnToWorkDate)) {
      errors.returnToWorkDate = "Fecha de reintegro inválida";
    } else {
      const occurredOn = localDay(input.occurredAt, input.timeZone);
      const raw = diffDays(occurredOn, input.returnToWorkDate);
      if (raw < 0) {
        errors.returnToWorkDate = "El reintegro no puede ser anterior al accidente";
      } else if (input.classification === "lost_time") {
        const { days, capped } = computeLostDays({
          occurredOn,
          returnToWorkDate: input.returnToWorkDate,
          asOf: localDay(input.now, input.timeZone),
          cap,
        });
        if (days === 0) {
          errors.returnToWorkDate = "Sin días perdidos el accidente es «sin baja»: cambiá la clasificación";
        } else if (capped) {
          warnings.push(`Los días perdidos se topean en ${cap}. Si hay incapacidad permanente, cargala.`);
        }
      }
    }
  }

  if (input.classification === "fatal" && input.lostDaysEntered && input.lostDaysEntered > 0) {
    warnings.push("En un accidente fatal los días perdidos no se suman: se cuenta el cargo por fatal.");
  }

  return { errors, warnings };
}

export type IncidentHealthInput = {
  classification: IncidentClassification;
  affectedPersonId: string | null;
  natureOfInjury: string | null;
  bodyPart: string | null;
  occurredOn: IsoDay;
  deathDate: IsoDay | null;
};

/** Reglas de la ficha de salud: la persona es obligatoria salvo en un casi accidente. */
export function validateHealth(input: IncidentHealthInput): Validation {
  const errors: FieldErrors = {};
  const warnings: string[] = [];
  const hasInjury = INJURY_CLASSIFICATIONS.includes(input.classification);

  if (hasInjury && !input.affectedPersonId) errors.affectedPersonId = "Elegí a la persona afectada";
  if (input.natureOfInjury && !NATURE_KEYS.includes(input.natureOfInjury)) errors.natureOfInjury = "Naturaleza no válida";
  if (input.bodyPart && !BODY_PART_KEYS.includes(input.bodyPart)) errors.bodyPart = "Parte del cuerpo no válida";

  if (input.deathDate) {
    if (input.classification !== "fatal") {
      errors.deathDate = "La fecha de muerte solo se carga en un accidente fatal";
    } else if (!isIsoDay(input.deathDate)) {
      errors.deathDate = "Fecha inválida";
    } else {
      const gap = diffDays(input.occurredOn, input.deathDate);
      if (gap < 0) errors.deathDate = "La muerte no puede ser anterior al accidente";
      else if (gap > 365) {
        warnings.push("La OIT cuenta solo las muertes dentro del año del accidente. El caso queda como fatal: revisalo.");
      }
    }
  }

  return { errors, warnings };
}

export type Severity = { lostDays: number; chargePct: number; capped: boolean; open: boolean };

/** Valores numéricos de gravedad que se guardan, derivados de la clasificación. */
export function resolveSeverity(input: {
  classification: IncidentClassification;
  occurredOn: IsoDay;
  returnToWorkDate: IsoDay | null;
  asOf: IsoDay;
  cap: number;
  chargePct?: number | null;
}): Severity {
  if (input.classification === "fatal") return { lostDays: 0, chargePct: 100, capped: false, open: false };
  if (input.classification === "lost_time") {
    const { days, capped, open } = computeLostDays({
      occurredOn: input.occurredOn,
      returnToWorkDate: input.returnToWorkDate,
      asOf: input.asOf,
      cap: input.cap,
    });
    return { lostDays: days, chargePct: input.chargePct ?? 0, capped, open };
  }
  return { lostDays: 0, chargePct: 0, capped: false, open: false };
}

export type ExposureInput = { hours: number; headcountAvg: number };
export type ExposureLimits = { maxHoursPerPerson: number; minHoursPerPerson: number; warnMaxHoursPerPerson: number };
export const DEFAULT_EXPOSURE_LIMITS: ExposureLimits = {
  maxHoursPerPerson: 744,
  minHoursPerPerson: 80,
  warnMaxHoursPerPerson: 260,
};

/** Plausibilidad de la exposición de un mes: horas por persona (24 h × 31 días = 744 es el techo). */
export function validateExposure(row: ExposureInput, limits: ExposureLimits = DEFAULT_EXPOSURE_LIMITS): Validation {
  const errors: FieldErrors = {};
  const warnings: string[] = [];

  if (!Number.isInteger(row.hours) || row.hours < 0) errors.hours = "Las horas trabajadas son un número entero, 0 o más";
  if (!Number.isFinite(row.headcountAvg) || row.headcountAvg < 0) errors.headcountAvg = "La dotación promedio es 0 o más";
  if (Object.keys(errors).length > 0) return { errors, warnings };

  if (row.hours === 0 && row.headcountAvg === 0) return { errors, warnings };

  if (row.headcountAvg === 0) {
    warnings.push("Hay horas pero no hay dotación: el índice de incidencia va a quedar «sin datos».");
    return { errors, warnings };
  }

  const perPerson = row.hours / row.headcountAvg;
  if (perPerson > limits.maxHoursPerPerson) {
    errors.hours = `Son ${Math.round(perPerson)} horas por persona: más que las ${limits.maxHoursPerPerson} que tiene un mes`;
  } else if (perPerson > limits.warnMaxHoursPerPerson) {
    warnings.push(`Son ${Math.round(perPerson)} horas por persona en el mes: revisá que sea correcto.`);
  } else if (row.hours > 0 && perPerson < limits.minHoursPerPerson) {
    warnings.push(`Son ${Math.round(perPerson)} horas por persona en el mes: parece poco, revisá.`);
  }
  return { errors, warnings };
}
