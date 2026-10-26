/**
 * Guía breve de proveedores. Base: ISO 9001 §8.4 (8.4.1 a 8.4.3), ISO 14001 §8.1 e ISO 45001 §8.1.4.
 * Ver SPEC-suppliers.md y RESEARCH-suppliers.md.
 */
export type SupplierGuideSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: { term: string; text: string }[];
};

export const SUPPLIER_GUIDE_SECTIONS: SupplierGuideSection[] = [
  {
    id: "para-que",
    title: "Para qué sirve",
    paragraphs: [
      "La norma pide que la empresa decida a quién le compra, con qué criterios, cuánto control le aplica y que lo pueda demostrar (ISO 9001 §8.4). Este módulo junta todo en una ficha por proveedor: quién es, cómo se lo evaluó, qué documentos tiene al día y qué se hizo cuando algo falló.",
      "Ante un auditor alcanza con abrir la lista de aprobados y, desde ahí, la ficha: lista, evaluación, criterios, evidencia y acción en una sola recorrida.",
    ],
  },
  {
    id: "criticidad",
    title: "Cuánto control le aplico",
    items: [
      { term: "Crítico", text: "Afecta la conformidad del producto, la seguridad o el ambiente. Evaluación completa; se reevalúa cada 12 meses." },
      { term: "Estándar", text: "Importa para la operación, pero un fallo se corrige sin consecuencias graves. Puede evaluarse de forma simplificada; se reevalúa cada 24 meses." },
      { term: "Bajo impacto", text: "Compras ocasionales o de poco valor. Se acepta escribiendo el motivo; no se reevalúa." },
    ],
    paragraphs: ["Los plazos son los sugeridos y la empresa los puede cambiar. El motivo de la criticidad queda escrito en la ficha."],
  },
  {
    id: "evaluacion",
    title: "Cómo se evalúa",
    paragraphs: [
      "Cada criterio se califica de 1 a 5. El puntaje y el resultado se calculan solos: nadie los escribe a mano. Se aprueba desde 80, queda con condiciones entre 60 y 79,9 y no se aprueba por debajo de 60.",
      "Un criterio excluyente (por ejemplo, seguridad) frena el resultado aunque el total sea alto: con un 1 no se aprueba; con un 2, como mucho queda con condiciones. Una nota de 1 o 2 lleva siempre un comentario.",
      "Cada evaluación guarda una copia fija de los criterios, los pesos y los umbrales con que se hizo. Si después se cambian los criterios, las evaluaciones anteriores no se tocan. Una evaluación equivocada no se edita: se anula con motivo y se carga otra.",
    ],
  },
  {
    id: "reevaluacion",
    title: "Cuándo se vuelve a evaluar",
    items: [
      { term: "Evaluación inicial", text: "Un proveedor crítico o estándar recién cargado queda con un aviso para evaluarlo dentro de los 30 días." },
      { term: "Periódica", text: "Se avisa 30 días antes de la fecha. Con condiciones, a los 6 meses." },
      { term: "Por evento", text: "Cuando pasa algo que no puede esperar: un hallazgo abierto, un plan de mejora cerrado o documentación vencida. La pantalla de evaluar muestra esa evidencia para decidir." },
      { term: "No aprobado", text: "No se reevalúa solo: sale de la lista de aprobados hasta que alguien pida una evaluación nueva." },
    ],
  },
  {
    id: "condiciones",
    title: "Con condiciones: el plan de mejora",
    paragraphs: [
      "Un resultado con condiciones no se guarda sin un plan de mejora: un responsable y una fecha. El plan es una acción común, con su seguimiento y su verificación de eficacia en Acciones.",
      "Cuando el plan se cierra, la pantalla de evaluar lo avisa para que se reevalúe y se compruebe que el proveedor cumplió.",
    ],
  },
  {
    id: "documentos",
    title: "Documentos y habilitación",
    paragraphs: [
      "La habilitación es distinta del puntaje. Un contratista está habilitado si está aprobado o con condiciones y además no tiene un documento bloqueante vencido o faltante (por ejemplo, la cobertura de ART). Sin habilitación se ve en rojo aunque tenga 95 puntos y no figura en la lista de aprobados.",
      "La plataforma registra los documentos y avisa sus vencimientos; no verifica el contenido de las pólizas. Los documentos sugeridos son orientativos: conviene validarlos con su asesor.",
    ],
  },
  {
    id: "hallazgos",
    title: "Hallazgos y comunicaciones",
    paragraphs: [
      "Si algo sale mal con un proveedor (calidad, entrega, seguridad, ambiente, documentación o un reclamo), se registra desde su ficha. Nace como un hallazgo en borrador, con origen «proveedor», y se trabaja en Hallazgos con sus medidas y su cierre. La próxima evaluación lo muestra como evidencia.",
      "La norma pide comunicar al proveedor lo que se le exige (§8.4.3). En la pestaña Comunicaciones se registra cuándo, cómo y qué se le dijo, con el adjunto si lo hay. Registrar no envía nada: el mail o la carta salen por los medios de siempre.",
    ],
  },
  {
    id: "permisos",
    title: "Quién puede qué",
    items: [
      { term: "Administrador", text: "Todo, incluida la edición y publicación de criterios y tipos de documento, y anular evaluaciones." },
      { term: "Responsable de proceso", text: "Alta, edición, evaluación, hallazgos y comunicaciones." },
      { term: "Colaborador", text: "Ver, cargar documentos y registrar hallazgos." },
      { term: "Consulta", text: "Solo ver y exportar la lista de aprobados." },
    ],
  },
];

export const SUPPLIER_GUIDE_REFERENCES: string[] = [
  "ISO 9001:2015 §8.4.1 (generalidades), §8.4.2 (tipo y alcance del control) y §8.4.3 (información para los proveedores externos).",
  "ISO 14001:2015 §8.1 (control operacional de los procesos contratados) e ISO 45001:2018 §8.1.4 (compras, contratistas y tercerización).",
  "Los pesos, umbrales y documentos sugeridos son un punto de partida: conviene que los revise un profesional antes de usarlos como recomendados.",
];
