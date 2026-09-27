import type { AuditItemResult } from "@/domain/audits/types";

/**
 * Guía breve de auditoría interna. Base: ISO 19011:2026 (cl. 5–7, Anexo A),
 * ISO 9001:2026 / 14001:2015 / 45001:2018 §9.2. Ver RESEARCH-audits.md.
 */
export type AuditGuideSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: { term: string; text: string }[];
};

export const AUDIT_GUIDE_SECTIONS: AuditGuideSection[] = [
  {
    id: "para-que",
    title: "Para qué sirve",
    paragraphs: [
      "La auditoría interna verifica con evidencia si el sistema de gestión cumple lo que la empresa y las normas exigen, y si logra los resultados previstos. No busca culpables: busca hechos que permitan mejorar.",
      "Las tres normas piden auditar a intervalos planificados, con un programa que tenga en cuenta la importancia de los procesos, los cambios y los resultados de auditorías anteriores.",
    ],
  },
  {
    id: "objetivo",
    title: "Cómo escribir el objetivo",
    paragraphs: [
      "ISO 9001:2026 pide un objetivo para cada auditoría: qué querés comprobar, en una frase. El informe tiene que responderlo.",
    ],
    items: [
      { term: "Bien", text: "Verificar que los cambios en despacho redujeron los errores de especificación." },
      { term: "Bien", text: "Comprobar que los controles operacionales de la planta 2 cubren los aspectos ambientales significativos." },
      { term: "A evitar", text: "“Auditar despacho” (es un alcance, no un objetivo)." },
    ],
  },
  {
    id: "evidencia",
    title: "Cómo obtener evidencia",
    items: [
      { term: "Registros", text: "Revisá una muestra: órdenes, planillas, informes. Anotá cuántos viste y cuáles." },
      { term: "Entrevistas", text: "Preguntá a quien hace la tarea cómo la hace; compará con lo documentado." },
      { term: "Observación", text: "Mirá la actividad en el lugar (o por video en auditorías remotas)." },
      { term: "Anotá lo concreto", text: "“2 de 5 órdenes de agosto sin proveedor evaluado” es evidencia; “falta control” no lo es." },
    ],
  },
  {
    id: "clasificar",
    title: "Cómo clasificar los resultados",
    items: [
      { term: "Conforme", text: "La evidencia muestra que el requisito se cumple." },
      { term: "NC mayor", text: "El requisito no se cumple de forma sistémica, o el incumplimiento pone en riesgo los resultados." },
      { term: "NC menor", text: "Falla puntual, no sistémica." },
      { term: "Observación", text: "Todavía se cumple, pero puede dejar de cumplirse." },
      { term: "Oportunidad de mejora", text: "Se cumple, pero podría hacerse mejor." },
      { term: "No aplica", text: "El requisito no corresponde al alcance auditado." },
    ],
  },
  {
    id: "imparcialidad",
    title: "Imparcialidad",
    paragraphs: [
      "Nadie debería auditar su propio trabajo. En empresas chicas se resuelve cruzando áreas o con un auditor externo; si no hay otra opción, dejá escrita la justificación y quedará en el informe.",
    ],
  },
  {
    id: "informe",
    title: "El informe",
    paragraphs: [
      "La conclusión responde al objetivo: ¿se cumple?, ¿es eficaz? Sumá las fortalezas encontradas; ayudan a sostener lo que funciona. Los hallazgos siguen su propio circuito en Hallazgos (causa, medidas, eficacia).",
      "Si la auditoría incluye ISO 45001, los resultados se comunican también a los trabajadores y sus representantes.",
    ],
  },
];

export const AUDIT_GUIDE_REFERENCES = [
  "ISO 19011:2026 — Directrices para la auditoría de sistemas de gestión.",
  "ISO 9001:2026 §9.2 — Auditoría interna (objetivo, criterios y alcance por auditoría).",
  "ISO 14001:2015 §9.2 y ISO 45001:2018 §9.2 — Auditoría interna.",
];

/** Conteo de resultados para el resumen del informe. */
export function summarizeResults(results: AuditItemResult[]): Record<AuditItemResult, number> {
  const summary: Record<AuditItemResult, number> = {
    pending: 0,
    conforming: 0,
    nc_major: 0,
    nc_minor: 0,
    observation: 0,
    improvement: 0,
    not_applicable: 0,
  };
  for (const r of results) summary[r] += 1;
  return summary;
}
