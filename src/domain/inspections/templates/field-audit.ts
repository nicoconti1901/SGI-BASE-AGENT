import { checkItem, type TemplateDefinition } from "./types";
import type { TemplateItemDef } from "../types";

const docs = "Documentación";
const people = "Personas";
const conditions = "Condiciones";
const height = "Altura";
const confined = "Espacio confinado";
const lifting = "Izaje";
const environment = "Ambiente";
const notes = "Observaciones";

/** Tareas especiales que se marcan al iniciar la auditoría: cada una suma sus ítems. */
export const SPECIAL_TASKS = {
  height: "Trabajo en altura",
  confined_space: "Espacio confinado",
  lifting: "Izaje",
} as const;
export type SpecialTask = keyof typeof SPECIAL_TASKS;

export function isSpecialTask(value: string): value is SpecialTask {
  return Object.prototype.hasOwnProperty.call(SPECIAL_TASKS, value);
}

/** Dato de contexto con el que se evalúa `appliesWhen`: una clave booleana por tarea especial. */
export function auditContext(specialTasks: readonly string[]): Record<string, boolean> {
  return Object.fromEntries(Object.keys(SPECIAL_TASKS).map((key) => [key, specialTasks.includes(key)]));
}

const when = (key: SpecialTask): Pick<TemplateItemDef, "appliesWhen"> => ({ appliesWhen: { source: "context", key, equals: true } });

function textItem(code: string, section: string, text: string): TemplateItemDef {
  return { code, section, text, criticality: "minor", kind: "text", naAllowed: false, photoOnNc: false, required: false };
}

/**
 * T7. Auditoría de seguridad en campo (Res. SRT 61/2023; Dec. 351/79; Dec. 911/96).
 * Es una actividad (sede + tarea + contratista + supervisor), sin calendario: se mide contra la meta mensual de la sede.
 * Con una NC crítica abre acción y hallazgo borrador. Propuesta del anexo del SPEC: debe revisarla un profesional de
 * Higiene y Seguridad antes de activar el módulo.
 */
export const FIELD_AUDIT: TemplateDefinition = {
  key: "field_audit",
  name: "Auditoría de seguridad en campo",
  scope: "activity",
  assetTypeKey: null,
  intervalUnit: null,
  intervalValue: null,
  leadDays: 0,
  reinspectionDays: 7,
  findingOnCritical: true,
  canReinstate: false,
  retireOnUnfit: false,
  maxApplicableItems: 25,
  items: [
    checkItem("docs_pts", docs, "Permiso de trabajo seguro (PTS) firmado y vigente", "critical", { help: "Res. SRT 61/2023 lo exige en altura y construcción; buena práctica en el resto." }),
    checkItem("docs_ats", docs, "Análisis de trabajo seguro (ATS/AST) firmado y difundido", "major"),
    checkItem("docs_talk", docs, "Charla previa registrada", "minor", { help: "Res. SRT 61/2023: charla de 5 minutos." }),
    checkItem("people_ppe", people, "EPP adecuado y en uso", "critical"),
    checkItem("people_trained", people, "Personal capacitado y habilitado para la tarea", "critical", { help: "Dec. 351 art. 134; Dec. 911 art. 265." }),
    checkItem("people_supervisor", people, "Supervisor presente en el frente", "major"),
    checkItem("cond_tools", conditions, "Herramientas inspeccionadas y en buen estado", "major"),
    checkItem("cond_front", conditions, "Frente ordenado, delimitado y señalizado", "major"),
    checkItem("cond_lockout", conditions, "Bloqueo y etiquetado de energías, cuando corresponde", "critical", { help: "Dec. 351 art. 109." }),
    checkItem("height_harness", height, "Arnés y cabo inspeccionados, vigentes (código del activo)", "critical", { ...when("height"), help: "Res. SRT 61/2023. Anotá el código del arnés en el comentario." }),
    checkItem("height_anchor", height, "Punto de anclaje adecuado e independiente de la plataforma", "critical", { ...when("height"), help: "Res. SRT 61/2023, ítem 39." }),
    checkItem("confined_gas", confined, "Medición de gases registrada con un equipo calibrado (oxígeno ≥ 18,5 %)", "critical", { ...when("confined_space"), help: "Dec. 911 art. 125." }),
    checkItem("confined_rescue", confined, "Vigía y plan de rescate", "critical", { ...when("confined_space"), help: "Dec. 911 art. 342." }),
    checkItem("lifting_plan", lifting, "Plan de izaje y rigger designado", "critical", { ...when("lifting") }),
    checkItem("lifting_zone", lifting, "Zona de maniobra señalizada; nadie bajo la carga", "critical", { ...when("lifting"), help: "Dec. 911 art. 268." }),
    checkItem("env_spills", environment, "Sin derrames; residuos bien dispuestos", "major"),
    textItem("notes_unsafe", notes, "Actos inseguros observados"),
    textItem("notes_positive", notes, "Observaciones positivas"),
  ],
};
