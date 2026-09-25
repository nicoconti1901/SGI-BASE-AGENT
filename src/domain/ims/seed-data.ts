import {
  buildClauseKey,
  type CatalogRequirement,
  type IsoStandardCode,
} from "@/domain/ims/catalog";

type ClauseRow = {
  code: string;
  title: string;
  summary: string;
  tags: string[];
};

function mapStandard(
  standard: IsoStandardCode,
  rows: ClauseRow[],
  extraTags: string[],
  primerizasCodes: Set<string>,
): CatalogRequirement[] {
  return rows.map((row) => {
    const essential = primerizasCodes.has(row.code);
    return {
      standard,
      clauseCode: row.code,
      clauseKey: buildClauseKey(standard, row.code),
      title: row.title,
      summary: row.summary,
      essential,
      tags: [
        ...row.tags,
        ...extraTags,
        ...(essential ? ["primerizas"] : ["escalable"]),
      ],
    };
  });
}

/** Baseline greenfield / empresas primerizas — ISO 9001 */
const PRIMERIZAS_9001 = new Set([
  "4.1", "4.2", "4.3", "4.4",
  "5.1", "5.2", "5.3",
  "6.1", "6.2",
  "7.2", "7.3", "7.5",
  "8.1", "8.2", "8.4", "8.5.1", "8.7",
  "9.1", "9.2", "9.3",
  "10.2", "10.3",
]);

/** Baseline greenfield / empresas primerizas — ISO 14001 */
const PRIMERIZAS_14001 = new Set([
  "4.1", "4.2", "4.3", "4.4",
  "5.1", "5.2", "5.3",
  "6.1.2", "6.1.3", "6.2",
  "7.2", "7.5",
  "8.1", "8.2",
  "9.1", "9.1.2", "9.2", "9.3",
  "10.2", "10.3",
]);

/** Baseline greenfield / empresas primerizas — ISO 45001 */
const PRIMERIZAS_45001 = new Set([
  "4.1", "4.2", "4.3", "4.4",
  "5.1", "5.2", "5.3", "5.4",
  "6.1.2", "6.1.2.1", "6.1.3", "6.2",
  "7.2", "7.5",
  "8.1.2", "8.2",
  "9.1", "9.1.2", "9.2", "9.3",
  "10.2", "10.3",
]);

/**
 * Mapa operativo de cláusulas (títulos cortos + resumen de implementación).
 * No reproduce el texto normativo copyright de ISO; es checklist de trabajo SGI.
 *
 * La bandera `essential` se calcula con los sets PRIMERIZAS_* (baseline greenfield).
 */
const ISO9001_ROWS: ClauseRow[] = [
  { code: "4.1", title: "Comprensión de la organización y de su contexto", summary: "Determinar cuestiones internas y externas relevantes al SGC.", tags: ["contexto"] },
  { code: "4.2", title: "Comprensión de las necesidades y expectativas de las partes interesadas", summary: "Identificar partes interesadas y requisitos pertinentes.", tags: ["contexto", "partes-interesadas"] },
  { code: "4.3", title: "Determinación del alcance del sistema de gestión de la calidad", summary: "Definir y documentar el alcance del SGC.", tags: ["contexto", "alcance"] },
  { code: "4.4", title: "Sistema de gestión de la calidad y sus procesos", summary: "Establecer, implementar y mejorar procesos del SGC e interacciones.", tags: ["procesos"] },
  { code: "5.1", title: "Liderazgo y compromiso", summary: "Demostrar liderazgo y compromiso con el SGC.", tags: ["liderazgo"] },
  { code: "5.1.1", title: "Generalidades (liderazgo)", summary: "Responsabilidades de la alta dirección respecto del SGC.", tags: ["liderazgo"] },
  { code: "5.1.2", title: "Enfoque al cliente", summary: "Asegurar determinación y cumplimiento de requisitos del cliente.", tags: ["liderazgo", "cliente"] },
  { code: "5.2", title: "Política", summary: "Establecer, implementar y mantener la política de la calidad.", tags: ["liderazgo", "politica"] },
  { code: "5.2.1", title: "Establecimiento de la política de la calidad", summary: "Definir política adecuada al propósito y contexto.", tags: ["politica"] },
  { code: "5.2.2", title: "Comunicación de la política de la calidad", summary: "Comunicar, entender y aplicar la política.", tags: ["politica", "comunicacion"] },
  { code: "5.3", title: "Roles, responsabilidades y autoridades en la organización", summary: "Asignar y comunicar roles y autoridades del SGC.", tags: ["liderazgo", "roles"] },
  { code: "6.1", title: "Acciones para abordar riesgos y oportunidades", summary: "Planificar acciones frente a riesgos y oportunidades.", tags: ["riesgos", "planificacion"] },
  { code: "6.2", title: "Objetivos de la calidad y planificación para lograrlos", summary: "Establecer objetivos medibles y planes asociados.", tags: ["objetivos", "planificacion"] },
  { code: "6.2.1", title: "Objetivos de la calidad", summary: "Definir objetivos coherentes con la política.", tags: ["objetivos"] },
  { code: "6.2.2", title: "Planificación de los objetivos de la calidad", summary: "Planificar qué, quién, cuándo y cómo evaluar.", tags: ["objetivos"] },
  { code: "6.3", title: "Planificación de los cambios", summary: "Planificar cambios del SGC de forma controlada.", tags: ["cambios", "escalable"] },
  { code: "7.1", title: "Recursos", summary: "Determinar y proporcionar recursos necesarios.", tags: ["soporte", "recursos"] },
  { code: "7.1.1", title: "Generalidades (recursos)", summary: "Considerar capacidades internas y proveedores externos.", tags: ["recursos"] },
  { code: "7.1.2", title: "Personas", summary: "Proveer personas necesarias para el SGC.", tags: ["recursos", "personas"] },
  { code: "7.1.3", title: "Infraestructura", summary: "Determinar, proporcionar y mantener infraestructura.", tags: ["recursos", "escalable"] },
  { code: "7.1.4", title: "Ambiente para la operación de los procesos", summary: "Determinar y gestionar el ambiente de operación.", tags: ["recursos", "escalable"] },
  { code: "7.1.5", title: "Recursos de seguimiento y medición", summary: "Asegurar recursos de medición adecuados y trazables.", tags: ["medicion", "escalable"] },
  { code: "7.1.5.1", title: "Generalidades (seguimiento y medición)", summary: "Proveer recursos para resultados válidos y fiables.", tags: ["medicion", "escalable"] },
  { code: "7.1.5.2", title: "Trazabilidad de las mediciones", summary: "Calibrar/verificar equipos cuando la trazabilidad sea requisito.", tags: ["medicion", "escalable"] },
  { code: "7.1.6", title: "Conocimientos de la organización", summary: "Determinar y mantener conocimientos necesarios.", tags: ["conocimiento", "escalable"] },
  { code: "7.2", title: "Competencia", summary: "Determinar competencia, formación y retención de evidencia.", tags: ["competencia"] },
  { code: "7.3", title: "Toma de conciencia", summary: "Asegurar conciencia de política, objetivos y contribución.", tags: ["conciencia"] },
  { code: "7.4", title: "Comunicación", summary: "Determinar comunicaciones internas y externas del SGC.", tags: ["comunicacion"] },
  { code: "7.5", title: "Información documentada", summary: "Controlar información documentada requerida por el SGC.", tags: ["documentos"] },
  { code: "7.5.1", title: "Generalidades (información documentada)", summary: "Incluir lo requerido por la norma y por la organización.", tags: ["documentos"] },
  { code: "7.5.2", title: "Creación y actualización", summary: "Asegurar identificación, formato y revisión adecuados.", tags: ["documentos"] },
  { code: "7.5.3", title: "Control de la información documentada", summary: "Controlar distribución, acceso, almacenamiento y cambios.", tags: ["documentos"] },
  { code: "8.1", title: "Planificación y control operacional", summary: "Planificar, implementar y controlar procesos operativos.", tags: ["operacion"] },
  { code: "8.2", title: "Requisitos para los productos y servicios", summary: "Comunicar y revisar requisitos de productos/servicios.", tags: ["operacion", "cliente"] },
  { code: "8.2.1", title: "Comunicación con el cliente", summary: "Definir canales de información, consultas y reclamaciones.", tags: ["cliente"] },
  { code: "8.2.2", title: "Determinación de los requisitos para los productos y servicios", summary: "Determinar requisitos legales y los definidos por la organización.", tags: ["cliente"] },
  { code: "8.2.3", title: "Revisión de los requisitos para los productos y servicios", summary: "Revisar capacidad de cumplir requisitos antes de comprometerse.", tags: ["cliente"] },
  { code: "8.2.4", title: "Cambios en los requisitos para los productos y servicios", summary: "Asegurar que la información documentada se modifica y se comunica.", tags: ["cliente", "escalable"] },
  { code: "8.3", title: "Diseño y desarrollo de los productos y servicios", summary: "Establecer, implementar y mantener proceso de diseño y desarrollo.", tags: ["diseno", "escalable"] },
  { code: "8.3.1", title: "Generalidades (diseño y desarrollo)", summary: "Proceso de diseño cuando aplique al alcance.", tags: ["diseno", "escalable"] },
  { code: "8.3.2", title: "Planificación del diseño y desarrollo", summary: "Determinar etapas, controles y responsabilidades.", tags: ["diseno", "escalable"] },
  { code: "8.3.3", title: "Entradas para el diseño y desarrollo", summary: "Determinar requisitos esenciales de entrada.", tags: ["diseno", "escalable"] },
  { code: "8.3.4", title: "Controles del diseño y desarrollo", summary: "Aplicar revisiones, verificación y validación.", tags: ["diseno", "escalable"] },
  { code: "8.3.5", title: "Salidas del diseño y desarrollo", summary: "Asegurar salidas que cumplan requisitos de entrada.", tags: ["diseno", "escalable"] },
  { code: "8.3.6", title: "Cambios del diseño y desarrollo", summary: "Identificar, revisar y controlar cambios.", tags: ["diseno", "escalable"] },
  { code: "8.4", title: "Control de los procesos, productos y servicios suministrados externamente", summary: "Asegurar que lo externo cumple requisitos.", tags: ["compras", "proveedores"] },
  { code: "8.4.1", title: "Generalidades (suministro externo)", summary: "Determinar controles y criterios de evaluación de proveedores.", tags: ["proveedores"] },
  { code: "8.4.2", title: "Tipo y alcance del control", summary: "Definir controles según impacto en conformidad.", tags: ["proveedores"] },
  { code: "8.4.3", title: "Información para los proveedores externos", summary: "Comunicar requisitos a proveedores externos.", tags: ["proveedores"] },
  { code: "8.5", title: "Producción y provisión del servicio", summary: "Implementar producción/servicio bajo condiciones controladas.", tags: ["operacion"] },
  { code: "8.5.1", title: "Control de la producción y de la provisión del servicio", summary: "Condiciones controladas, instrucciones y seguimiento.", tags: ["operacion"] },
  { code: "8.5.2", title: "Identificación y trazabilidad", summary: "Identificar salidas cuando sea necesario asegurar conformidad.", tags: ["trazabilidad", "escalable"] },
  { code: "8.5.3", title: "Propiedad perteneciente a los clientes o proveedores externos", summary: "Cuidar propiedad de clientes/proveedores mientras esté bajo control.", tags: ["propiedad", "escalable"] },
  { code: "8.5.4", title: "Preservación", summary: "Preservar salidas durante producción y entrega.", tags: ["preservacion", "escalable"] },
  { code: "8.5.5", title: "Actividades posteriores a la entrega", summary: "Cumplir requisitos posteriores a la entrega.", tags: ["postventa", "escalable"] },
  { code: "8.5.6", title: "Control de los cambios", summary: "Revisar y controlar cambios en producción/servicio.", tags: ["cambios", "escalable"] },
  { code: "8.6", title: "Liberación de los productos y servicios", summary: "Implementar liberaciones planificadas antes de entrega.", tags: ["liberacion"] },
  { code: "8.7", title: "Control de las salidas no conformes", summary: "Identificar y controlar salidas no conformes.", tags: ["nc", "operacion"] },
  { code: "9.1", title: "Seguimiento, medición, análisis y evaluación", summary: "Determinar qué seguir, cómo y cuándo.", tags: ["evaluacion", "indicadores"] },
  { code: "9.1.1", title: "Generalidades (seguimiento y medición)", summary: "Evaluar desempeño y eficacia del SGC.", tags: ["indicadores"] },
  { code: "9.1.2", title: "Satisfacción del cliente", summary: "Hacer seguimiento de la percepción del cliente.", tags: ["cliente", "indicadores"] },
  { code: "9.1.3", title: "Análisis y evaluación", summary: "Analizar datos de conformidad, desempeño y proveedores.", tags: ["analisis"] },
  { code: "9.2", title: "Auditoría interna", summary: "Planificar y realizar auditorías internas.", tags: ["auditoria"] },
  { code: "9.2.1", title: "Generalidades (auditoría interna)", summary: "Verificar conformidad y eficacia del SGC.", tags: ["auditoria"] },
  { code: "9.2.2", title: "Programa de auditoría interna", summary: "Planificar frecuencia, métodos, responsabilidades e informes.", tags: ["auditoria"] },
  { code: "9.3", title: "Revisión por la dirección", summary: "Revisar el SGC a intervalos planificados.", tags: ["revision-direccion"] },
  { code: "9.3.1", title: "Generalidades (revisión por la dirección)", summary: "Asegurar conveniencia, adecuación y eficacia continuas.", tags: ["revision-direccion"] },
  { code: "9.3.2", title: "Entradas de la revisión por la dirección", summary: "Considerar desempeño, auditorías, clientes y cambios.", tags: ["revision-direccion"] },
  { code: "9.3.3", title: "Salidas de la revisión por la dirección", summary: "Decidir oportunidades de mejora y necesidades de recursos.", tags: ["revision-direccion"] },
  { code: "10.1", title: "Generalidades (mejora)", summary: "Determinar oportunidades de mejora e implementar acciones.", tags: ["mejora"] },
  { code: "10.2", title: "No conformidad y acción correctiva", summary: "Reaccionar ante NC y eliminar causas.", tags: ["nc", "mejora"] },
  { code: "10.3", title: "Mejora continua", summary: "Mejorar continuamente la idoneidad y eficacia del SGC.", tags: ["mejora"] },
];

const ISO14001_ROWS: ClauseRow[] = [
  { code: "4.1", title: "Comprensión de la organización y de su contexto", summary: "Determinar cuestiones ambientales internas y externas.", tags: ["contexto"] },
  { code: "4.2", title: "Comprensión de las necesidades y expectativas de las partes interesadas", summary: "Determinar partes interesadas y requisitos ambientales pertinentes.", tags: ["contexto", "partes-interesadas"] },
  { code: "4.3", title: "Determinación del alcance del sistema de gestión ambiental", summary: "Definir límites físicos/organizativos del SGA.", tags: ["alcance"] },
  { code: "4.4", title: "Sistema de gestión ambiental", summary: "Establecer, implementar, mantener y mejorar el SGA.", tags: ["procesos"] },
  { code: "5.1", title: "Liderazgo y compromiso", summary: "Liderazgo y compromiso con el SGA.", tags: ["liderazgo"] },
  { code: "5.2", title: "Política ambiental", summary: "Establecer, implementar y mantener la política ambiental.", tags: ["politica"] },
  { code: "5.3", title: "Roles, responsabilidades y autoridades en la organización", summary: "Asignar roles y autoridades ambientales.", tags: ["roles"] },
  { code: "6.1", title: "Acciones para abordar riesgos y oportunidades", summary: "Planificar acciones frente a riesgos y oportunidades ambientales.", tags: ["riesgos"] },
  { code: "6.1.1", title: "Generalidades (planificación)", summary: "Considerar contexto, partes interesadas y alcance.", tags: ["planificacion"] },
  { code: "6.1.2", title: "Aspectos ambientales", summary: "Determinar aspectos e impactos ambientales significativos.", tags: ["aspectos"] },
  { code: "6.1.3", title: "Requisitos legales y otros requisitos", summary: "Determinar y acceder a requisitos legales aplicables.", tags: ["legal"] },
  { code: "6.1.4", title: "Planificación de acciones", summary: "Planificar acciones para aspectos, legales, riesgos y oportunidades.", tags: ["planificacion"] },
  { code: "6.2", title: "Objetivos ambientales y planificación para lograrlos", summary: "Establecer objetivos ambientales y planes.", tags: ["objetivos"] },
  { code: "6.2.1", title: "Objetivos ambientales", summary: "Definir objetivos coherentes con la política ambiental.", tags: ["objetivos"] },
  { code: "6.2.2", title: "Planificación de acciones para lograr los objetivos ambientales", summary: "Definir qué, recursos, responsables, plazos e indicadores.", tags: ["objetivos"] },
  { code: "7.1", title: "Recursos", summary: "Determinar y proporcionar recursos del SGA.", tags: ["recursos"] },
  { code: "7.2", title: "Competencia", summary: "Asegurar competencia de quienes afectan el desempeño ambiental.", tags: ["competencia"] },
  { code: "7.3", title: "Toma de conciencia", summary: "Asegurar conciencia de política, aspectos e impactos.", tags: ["conciencia"] },
  { code: "7.4", title: "Comunicación", summary: "Establecer procesos de comunicación interna y externa.", tags: ["comunicacion"] },
  { code: "7.4.1", title: "Generalidades (comunicación)", summary: "Determinar qué, cuándo, con quién y cómo comunicar.", tags: ["comunicacion"] },
  { code: "7.4.2", title: "Comunicación interna", summary: "Comunicar información del SGA entre niveles y funciones.", tags: ["comunicacion"] },
  { code: "7.4.3", title: "Comunicación externa", summary: "Comunicar externamente según requisitos legales y propios.", tags: ["comunicacion", "escalable"] },
  { code: "7.5", title: "Información documentada", summary: "Controlar información documentada del SGA.", tags: ["documentos"] },
  { code: "7.5.1", title: "Generalidades (información documentada)", summary: "Incluir lo requerido por la norma y por la organización.", tags: ["documentos"] },
  { code: "7.5.2", title: "Creación y actualización", summary: "Asegurar identificación, formato y revisión.", tags: ["documentos"] },
  { code: "7.5.3", title: "Control de la información documentada", summary: "Controlar distribución, acceso, conservación y cambios.", tags: ["documentos"] },
  { code: "8.1", title: "Planificación y control operacional", summary: "Establecer controles operacionales para requisitos del SGA.", tags: ["operacion"] },
  { code: "8.2", title: "Preparación y respuesta ante emergencias", summary: "Prepararse y responder a situaciones de emergencia potenciales.", tags: ["emergencias"] },
  { code: "9.1", title: "Seguimiento, medición, análisis y evaluación", summary: "Hacer seguimiento del desempeño ambiental.", tags: ["indicadores"] },
  { code: "9.1.1", title: "Generalidades (seguimiento ambiental)", summary: "Determinar qué medir, métodos, criterios e indicadores.", tags: ["indicadores"] },
  { code: "9.1.2", title: "Evaluación del cumplimiento", summary: "Evaluar el cumplimiento de requisitos legales y otros.", tags: ["legal", "cumplimiento"] },
  { code: "9.2", title: "Auditoría interna", summary: "Realizar auditorías internas del SGA.", tags: ["auditoria"] },
  { code: "9.2.1", title: "Generalidades (auditoría interna ambiental)", summary: "Verificar conformidad y eficacia del SGA.", tags: ["auditoria"] },
  { code: "9.2.2", title: "Programa de auditoría interna", summary: "Planificar, implementar y mantener el programa de auditoría.", tags: ["auditoria"] },
  { code: "9.3", title: "Revisión por la dirección", summary: "Revisar el SGA a intervalos planificados.", tags: ["revision-direccion"] },
  { code: "10.1", title: "Generalidades (mejora)", summary: "Determinar oportunidades de mejora e implementar acciones.", tags: ["mejora"] },
  { code: "10.2", title: "No conformidad y acción correctiva", summary: "Reaccionar ante NC ambientales y tomar acciones.", tags: ["nc", "mejora"] },
  { code: "10.3", title: "Mejora continua", summary: "Mejorar continuamente la idoneidad y eficacia del SGA.", tags: ["mejora"] },
];

const ISO45001_ROWS: ClauseRow[] = [
  { code: "4.1", title: "Comprensión de la organización y de su contexto", summary: "Determinar cuestiones internas y externas relevantes a SST.", tags: ["contexto"] },
  { code: "4.2", title: "Comprensión de las necesidades y expectativas de los trabajadores y de otras partes interesadas", summary: "Determinar trabajadores y otras partes interesadas pertinentes.", tags: ["contexto", "partes-interesadas"] },
  { code: "4.3", title: "Determinación del alcance del sistema de gestión de la SST", summary: "Definir límites y aplicabilidad del SG-SST.", tags: ["alcance"] },
  { code: "4.4", title: "Sistema de gestión de la SST", summary: "Establecer, implementar, mantener y mejorar el SG-SST.", tags: ["procesos"] },
  { code: "5.1", title: "Liderazgo y compromiso", summary: "Liderazgo y compromiso con el SG-SST.", tags: ["liderazgo"] },
  { code: "5.2", title: "Política de la SST", summary: "Establecer, implementar y mantener la política SST.", tags: ["politica"] },
  { code: "5.3", title: "Roles, responsabilidades y autoridades en la organización", summary: "Asignar roles y autoridades SST.", tags: ["roles"] },
  { code: "5.4", title: "Consulta y participación de los trabajadores", summary: "Establecer procesos de consulta y participación.", tags: ["participacion"] },
  { code: "6.1", title: "Acciones para abordar riesgos y oportunidades", summary: "Planificar acciones SST frente a riesgos y oportunidades.", tags: ["riesgos"] },
  { code: "6.1.1", title: "Generalidades (planificación SST)", summary: "Considerar contexto, trabajadores y alcance.", tags: ["planificacion"] },
  { code: "6.1.2", title: "Identificación de peligros y evaluación de los riesgos y oportunidades", summary: "Identificar peligros y evaluar riesgos/oportunidades SST.", tags: ["peligros", "riesgos"] },
  { code: "6.1.2.1", title: "Identificación de peligros", summary: "Proceso continuo y proactivo de identificación de peligros.", tags: ["peligros"] },
  { code: "6.1.2.2", title: "Evaluación de los riesgos para la SST y otros riesgos para el sistema de gestión de la SST", summary: "Evaluar riesgos SST y del sistema.", tags: ["riesgos"] },
  { code: "6.1.2.3", title: "Evaluación de las oportunidades para la SST y otras oportunidades para el sistema de gestión de la SST", summary: "Evaluar oportunidades de mejora SST.", tags: ["oportunidades", "escalable"] },
  { code: "6.1.3", title: "Determinación de los requisitos legales y otros requisitos", summary: "Determinar y acceder a requisitos legales SST.", tags: ["legal"] },
  { code: "6.1.4", title: "Planificación de acciones", summary: "Planificar acciones para abordar riesgos, oportunidades y legales.", tags: ["planificacion"] },
  { code: "6.2", title: "Objetivos de la SST y planificación para lograrlos", summary: "Establecer objetivos SST y planes.", tags: ["objetivos"] },
  { code: "6.2.1", title: "Objetivos de la SST", summary: "Definir objetivos coherentes con la política SST.", tags: ["objetivos"] },
  { code: "6.2.2", title: "Planificación para lograr los objetivos de la SST", summary: "Definir acciones, recursos, responsables, plazos e indicadores.", tags: ["objetivos"] },
  { code: "7.1", title: "Recursos", summary: "Determinar y proporcionar recursos del SG-SST.", tags: ["recursos"] },
  { code: "7.2", title: "Competencia", summary: "Asegurar competencia de trabajadores que afecten el desempeño SST.", tags: ["competencia"] },
  { code: "7.3", title: "Toma de conciencia", summary: "Asegurar conciencia de política, peligros e incidentes.", tags: ["conciencia"] },
  { code: "7.4", title: "Comunicación", summary: "Establecer procesos de comunicación interna y externa SST.", tags: ["comunicacion"] },
  { code: "7.4.1", title: "Generalidades (comunicación SST)", summary: "Determinar qué, cuándo, con quién y cómo comunicar.", tags: ["comunicacion"] },
  { code: "7.4.2", title: "Comunicación interna", summary: "Comunicar información SST entre niveles y funciones.", tags: ["comunicacion"] },
  { code: "7.4.3", title: "Comunicación externa", summary: "Comunicar externamente según requisitos legales y propios.", tags: ["comunicacion", "escalable"] },
  { code: "7.5", title: "Información documentada", summary: "Controlar información documentada del SG-SST.", tags: ["documentos"] },
  { code: "7.5.1", title: "Generalidades (información documentada SST)", summary: "Incluir lo requerido por la norma y por la organización.", tags: ["documentos"] },
  { code: "7.5.2", title: "Creación y actualización", summary: "Asegurar identificación, formato y revisión.", tags: ["documentos"] },
  { code: "7.5.3", title: "Control de la información documentada", summary: "Controlar distribución, acceso, conservación y cambios.", tags: ["documentos"] },
  { code: "8.1", title: "Planificación y control operacional", summary: "Planificar, implementar y controlar procesos SST.", tags: ["operacion"] },
  { code: "8.1.1", title: "Generalidades (control operacional SST)", summary: "Establecer criterios y controles para procesos.", tags: ["operacion"] },
  { code: "8.1.2", title: "Eliminar peligros y reducir riesgos para la SST", summary: "Aplicar jerarquía de controles.", tags: ["controles", "riesgos"] },
  { code: "8.1.3", title: "Gestión del cambio", summary: "Controlar cambios temporales y permanentes que afecten SST.", tags: ["cambios"] },
  { code: "8.1.4", title: "Compras", summary: "Controlar compras de productos/servicios que impacten SST.", tags: ["compras"] },
  { code: "8.1.4.1", title: "Generalidades (compras SST)", summary: "Establecer controles de compra coherentes con el SG-SST.", tags: ["compras"] },
  { code: "8.1.4.2", title: "Contratistas", summary: "Coordinar con contratistas requisitos SST aplicables.", tags: ["contratistas"] },
  { code: "8.1.4.3", title: "Externalización", summary: "Asegurar control de funciones/procesos externalizados.", tags: ["externalizacion", "escalable"] },
  { code: "8.2", title: "Preparación y respuesta ante emergencias", summary: "Prepararse y responder a emergencias potenciales.", tags: ["emergencias"] },
  { code: "9.1", title: "Seguimiento, medición, análisis y evaluación del desempeño", summary: "Hacer seguimiento del desempeño SST.", tags: ["indicadores"] },
  { code: "9.1.1", title: "Generalidades (seguimiento SST)", summary: "Determinar qué medir, métodos, criterios e indicadores.", tags: ["indicadores"] },
  { code: "9.1.2", title: "Evaluación del cumplimiento", summary: "Evaluar cumplimiento de requisitos legales y otros.", tags: ["legal", "cumplimiento"] },
  { code: "9.2", title: "Auditoría interna", summary: "Realizar auditorías internas del SG-SST.", tags: ["auditoria"] },
  { code: "9.2.1", title: "Generalidades (auditoría interna SST)", summary: "Verificar conformidad y eficacia del SG-SST.", tags: ["auditoria"] },
  { code: "9.2.2", title: "Programa de auditoría interna", summary: "Planificar, implementar y mantener el programa de auditoría.", tags: ["auditoria"] },
  { code: "9.3", title: "Revisión por la dirección", summary: "Revisar el SG-SST a intervalos planificados.", tags: ["revision-direccion"] },
  { code: "10.1", title: "Generalidades (mejora)", summary: "Determinar oportunidades de mejora e implementar acciones.", tags: ["mejora"] },
  { code: "10.2", title: "Incidente, no conformidad y acción correctiva", summary: "Investigar incidentes/NC y tomar acciones correctivas.", tags: ["incidentes", "nc", "mejora"] },
  { code: "10.3", title: "Mejora continua", summary: "Mejorar continuamente la idoneidad y eficacia del SG-SST.", tags: ["mejora"] },
];

export const ESSENTIAL_CATALOG_SEED: CatalogRequirement[] = [
  ...mapStandard("ISO9001", ISO9001_ROWS, ["calidad"], PRIMERIZAS_9001),
  ...mapStandard("ISO14001", ISO14001_ROWS, ["ambiente"], PRIMERIZAS_14001),
  ...mapStandard("ISO45001", ISO45001_ROWS, ["sst"], PRIMERIZAS_45001),
];

export function catalogStats(requirements: CatalogRequirement[] = ESSENTIAL_CATALOG_SEED) {
  const byStandard = (standard: IsoStandardCode) =>
    requirements.filter((r) => r.standard === standard);

  return {
    total: requirements.length,
    essential: requirements.filter((r) => r.essential).length,
    scalable: requirements.filter((r) => !r.essential).length,
    byStandard: {
      ISO9001: {
        total: byStandard("ISO9001").length,
        essential: byStandard("ISO9001").filter((r) => r.essential).length,
      },
      ISO14001: {
        total: byStandard("ISO14001").length,
        essential: byStandard("ISO14001").filter((r) => r.essential).length,
      },
      ISO45001: {
        total: byStandard("ISO45001").length,
        essential: byStandard("ISO45001").filter((r) => r.essential).length,
      },
    },
  };
}
