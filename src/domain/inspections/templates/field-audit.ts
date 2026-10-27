import { FIELD_AUDIT_KEY } from "../field-audit";
import type { AppliesWhen, TemplateItemDef } from "../types";
import { checkItem, type TemplateDefinition } from "./types";

const docs = "Documentación";
const people = "Personas";
const conditions = "Condiciones";
const height = "Altura";
const confined = "Espacio confinado";
const lifting = "Izaje";
const environment = "Ambiente";
const notes = "Observaciones";

const onHeight: AppliesWhen = { source: "context", key: "height", equals: true };
const onConfined: AppliesWhen = { source: "context", key: "confined_space", equals: true };
const onLifting: AppliesWhen = { source: "context", key: "lifting", equals: true };

/** Observación libre: no puntúa ni bloquea el cierre. */
function noteItem(code: string, text: string, help: string): TemplateItemDef {
  return { code, section: notes, text, help, criticality: "minor", kind: "text", naAllowed: false, photoOnNc: false, required: false };
}

/**
 * T7. Auditoría de seguridad en campo (Res. SRT 61/2023; Dec. 351/79 arts. 109 y 134; Dec. 911/96 arts. 125, 265, 268 y 342).
 * Es una actividad, no un activo: se hace sobre un frente de trabajo (sede + tarea + contratista + supervisor) y no tiene calendario
 * propio; se mide contra la meta mensual de auditorías de cada sede. Las tareas especiales que se marcan al iniciar suman sus
 * ítems: 10 comunes y hasta 16 con altura, espacio confinado e izaje. Un no apto abre la acción y, con una crítica, el hallazgo.
 * Propuesta del anexo del SPEC: debe revisarla un profesional de Higiene y Seguridad antes de activar el módulo.
 */
export const FIELD_AUDIT: TemplateDefinition = {
  key: FIELD_AUDIT_KEY,
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
    checkItem("docs_pts", docs, "Permiso de trabajo seguro (PTS) firmado y vigente", "critical"),
    checkItem("docs_ats", docs, "Análisis de trabajo seguro (ATS/AST) firmado y difundido", "major"),
    checkItem("docs_talk", docs, "Charla previa registrada", "minor", { help: "Cinco minutos antes de empezar la tarea." }),
    checkItem("people_ppe", people, "EPP adecuado y en uso", "critical"),
    checkItem("people_trained", people, "Personal capacitado y habilitado para la tarea", "critical"),
    checkItem("people_supervisor", people, "Supervisor presente en el frente", "major"),
    checkItem("cond_tools", conditions, "Herramientas inspeccionadas y en buen estado", "major"),
    checkItem("cond_area", conditions, "Frente ordenado, delimitado y señalizado", "major"),
    checkItem("cond_lockout", conditions, "Bloqueo y etiquetado de energías, cuando corresponde", "critical", { help: "Si la tarea no tiene energías para bloquear, marcá «No aplica»." }),
    checkItem("height_harness", height, "Arnés y cabo inspeccionados, vigentes", "critical", {
      help: "Anotá el código del arnés en el comentario.",
      appliesWhen: onHeight,
    }),
    checkItem("height_anchor", height, "Punto de anclaje adecuado e independiente de la plataforma", "critical", { appliesWhen: onHeight }),
    checkItem("confined_gases", confined, "Medición de gases registrada con un equipo calibrado (oxígeno ≥ 18,5 %)", "critical", { appliesWhen: onConfined }),
    checkItem("confined_rescue", confined, "Vigía y plan de rescate", "critical", { appliesWhen: onConfined }),
    checkItem("lifting_plan", lifting, "Plan de izaje y rigger designado", "critical", { appliesWhen: onLifting }),
    checkItem("lifting_zone", lifting, "Zona de maniobra señalizada; nadie bajo la carga", "critical", { appliesWhen: onLifting }),
    checkItem("env_spills", environment, "Sin derrames; residuos bien dispuestos", "major"),
    noteItem("notes_unsafe", "Actos inseguros observados", "Describí lo que viste, sin nombres: es para conversarlo con el equipo."),
    noteItem("notes_positive", "Observaciones positivas", "Lo que se está haciendo bien también cuenta."),
  ],
};
