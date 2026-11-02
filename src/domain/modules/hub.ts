import {
  MODULE_CATALOG,
  MODULE_SECTIONS,
  type ModuleClause,
  type ModuleDefinition,
  type ModuleKey,
  type ModuleSectionKey,
} from "@/domain/modules/catalog";

/**
 * Ingreso progresivo: Inicio (módulos por área) → módulo (sus pantallas) → pantalla.
 * Un módulo con una sola pantalla visible se abre directo, sin paso intermedio.
 */

export type HubIconName =
  | "documents"
  | "audits"
  | "findings"
  | "risks"
  | "target"
  | "inspections"
  | "gauge"
  | "pulse"
  | "road"
  | "database"
  | "training"
  | "truck"
  | "bolt"
  | "users"
  | "list"
  | "plus"
  | "book"
  | "chart"
  | "compass"
  | "calendar"
  | "check"
  | "layers"
  | "pin"
  | "briefcase"
  | "wrench"
  | "clock"
  | "sliders"
  | "star"
  | "field"
  | "globe";

export type HubScreen = {
  label: string;
  /** Qué encuentra el usuario al entrar, en pocas palabras. */
  hint: string;
  /** Segmento bajo la ruta del módulo; "" es la pantalla principal. */
  path: string;
  icon: HubIconName;
  /** Solo para quien puede registrar o editar. */
  write?: boolean;
};

type ModuleHub = {
  icon: HubIconName;
  tagline: string;
  /** entityType de los DueItem que genera el módulo: alimentan su tablero chico. */
  dueTypes: readonly string[];
  screens: readonly HubScreen[];
};

export const AREA_TAGLINES: Record<ModuleSectionKey, string> = {
  compliance: "Documentos vigentes y auditorías del sistema.",
  improvement: "Hallazgos, riesgos y objetivos.",
  sst: "Inspecciones, equipos, accidentes y seguridad vial.",
  people: "Personal, capacitaciones y proveedores.",
  admin: "Avisos automáticos y usuarios.",
};

const guide = (path = "guia"): HubScreen => ({
  label: "Guía",
  hint: "Cómo se usa y qué pide la norma.",
  path,
  icon: "book",
});

export const MODULE_HUB: Record<ModuleKey, ModuleHub> = {
  documents: {
    icon: "documents",
    tagline: "Procedimientos y registros con su versión vigente.",
    dueTypes: ["document_validity"],
    screens: [
      {
        label: "Documentos",
        hint: "Procedimientos y registros vigentes.",
        path: "",
        icon: "documents",
      },
    ],
  },
  audits: {
    icon: "audits",
    tagline: "Programa del año, planes y resultados de auditoría.",
    dueTypes: ["audit_start", "audit_report", "audit_external_response"],
    screens: [
      {
        label: "Programa de auditorías",
        hint: "Auditorías del año y su estado.",
        path: "",
        icon: "list",
      },
      {
        label: "Planificar auditoría",
        hint: "Alcance, equipo y fechas.",
        path: "new",
        icon: "plus",
        write: true,
      },
      {
        label: "Auditoría externa",
        hint: "Cargá el informe del certificador.",
        path: "externas/new",
        icon: "globe",
        write: true,
      },
      guide(),
    ],
  },
  findings: {
    icon: "findings",
    tagline: "No conformidades, observaciones y acciones hasta su cierre.",
    dueTypes: ["finding_verification", "finding_measure"],
    screens: [
      {
        label: "Lista de hallazgos",
        hint: "Abiertos, en tratamiento y cerrados.",
        path: "",
        icon: "list",
      },
      {
        label: "Crear hallazgo",
        hint: "No conformidad, observación o incidente.",
        path: "new",
        icon: "plus",
        write: true,
      },
    ],
  },
  risks: {
    icon: "risks",
    tagline: "Riesgos y oportunidades evaluados, con su tratamiento.",
    dueTypes: ["risk", "opportunity", "operational_action"],
    screens: [
      {
        label: "Registro de riesgos",
        hint: "Con oportunidades, evaluación y tratamiento.",
        path: "",
        icon: "list",
      },
      {
        label: "Registrar riesgo",
        hint: "Algo que podría salir mal.",
        path: "new",
        icon: "plus",
        write: true,
      },
      {
        label: "Registrar oportunidad",
        hint: "Algo que se podría aprovechar.",
        path: "opportunities/new",
        icon: "compass",
        write: true,
      },
      guide(),
    ],
  },
  indicators: {
    icon: "target",
    tagline: "Metas, mediciones y desvíos del sistema.",
    dueTypes: ["indicator_measurement"],
    screens: [
      {
        label: "Objetivos e indicadores",
        hint: "Metas y tendencia de cada medición.",
        path: "",
        icon: "chart",
      },
      {
        label: "Nuevo objetivo",
        hint: "Meta, indicador y frecuencia.",
        path: "new",
        icon: "plus",
        write: true,
      },
      guide(),
    ],
  },
  inspections: {
    icon: "inspections",
    tagline: "Inspecciones programadas, en campo y sus planillas.",
    dueTypes: ["inspection", "inspection_plan", "inspection_target", "asset_due_date"],
    screens: [
      {
        label: "Agenda de inspecciones",
        hint: "Programadas, realizadas y vencidas.",
        path: "",
        icon: "list",
      },
      {
        label: "Nueva inspección",
        hint: "Elegí el activo y la planilla.",
        path: "new",
        icon: "plus",
        write: true,
      },
      {
        label: "Auditoría en campo",
        hint: "Cómo se trabaja en el frente.",
        path: "campo",
        icon: "field",
      },
      {
        label: "Planillas",
        hint: "Plantillas de cada inspección.",
        path: "templates",
        icon: "layers",
      },
      guide(),
    ],
  },
  instruments: {
    icon: "gauge",
    tagline: "Calibraciones y verificaciones de cada equipo.",
    dueTypes: ["instrument", "instrument_calibration", "instrument_verification"],
    screens: [
      {
        label: "Estado de los equipos",
        hint: "Calibración y verificación de cada uno.",
        path: "",
        icon: "list",
      },
      {
        label: "Registrar equipo",
        hint: "Alta con su frecuencia de control.",
        path: "new",
        icon: "plus",
        write: true,
      },
      guide(),
    ],
  },
  safety_stats: {
    icon: "pulse",
    tagline: "Accidentes, horas trabajadas e índices de siniestralidad.",
    dueTypes: ["incident_followup", "exposure_period"],
    screens: [
      {
        label: "Tablero de índices",
        hint: "Frecuencia, gravedad e incidencia.",
        path: "stats",
        icon: "chart",
      },
      {
        label: "Casos",
        hint: "Accidentes registrados y su seguimiento.",
        path: "",
        icon: "list",
      },
      {
        label: "Horas trabajadas",
        hint: "Exposición mensual por sede.",
        path: "exposure",
        icon: "clock",
      },
      guide(),
    ],
  },
  road_safety: {
    icon: "road",
    tagline: "Kilómetros, conductores e indicadores viales.",
    dueTypes: ["road_km_period", "driver_license"],
    screens: [
      {
        label: "Tablero vial",
        hint: "Indicadores del período.",
        path: "",
        icon: "chart",
      },
      {
        label: "Km del mes",
        hint: "Kilómetros recorridos por la flota.",
        path: "km",
        icon: "road",
      },
      {
        label: "Ajustes",
        hint: "Metas y parámetros viales.",
        path: "ajustes",
        icon: "sliders",
      },
      guide(),
    ],
  },
  master_data: {
    icon: "database",
    tagline: "Personas, sedes, puestos y tareas que usan todos los módulos.",
    dueTypes: [],
    screens: [
      {
        label: "Personas",
        hint: "Nómina con su puesto y sede.",
        path: "people",
        icon: "users",
      },
      {
        label: "Sedes",
        hint: "Plantas, obradores y oficinas.",
        path: "sites",
        icon: "pin",
      },
      {
        label: "Puestos",
        hint: "Cargos y sus responsabilidades.",
        path: "positions",
        icon: "briefcase",
      },
      {
        label: "Tareas",
        hint: "Tareas habituales y especiales.",
        path: "tasks",
        icon: "wrench",
      },
    ],
  },
  training: {
    icon: "training",
    tagline: "Plan anual, sesiones, asistencia y eficacia.",
    dueTypes: [],
    screens: [
      {
        label: "Resumen",
        hint: "Avance del plan y pendientes.",
        path: "",
        icon: "chart",
      },
      {
        label: "Cumplimiento",
        hint: "Quién tiene al día lo que su puesto pide.",
        path: "compliance",
        icon: "check",
      },
      {
        label: "Sesiones",
        hint: "Dictadas, asistentes y planillas.",
        path: "sessions",
        icon: "users",
      },
      {
        label: "Eficacia",
        hint: "Evaluaciones posteriores.",
        path: "effectiveness",
        icon: "target",
      },
      {
        label: "Plan anual",
        hint: "Qué se dicta y cuándo.",
        path: "plan",
        icon: "calendar",
      },
      {
        label: "Cursos",
        hint: "Catálogo de capacitaciones.",
        path: "courses",
        icon: "training",
      },
      {
        label: "Requisitos",
        hint: "Qué exige cada puesto.",
        path: "requirements",
        icon: "layers",
      },
      guide(),
    ],
  },
  suppliers: {
    icon: "truck",
    tagline: "Evaluación, aprobación y seguimiento de proveedores.",
    dueTypes: [],
    screens: [
      {
        label: "Todos los proveedores",
        hint: "Con su última evaluación.",
        path: "",
        icon: "list",
      },
      {
        label: "Aprobados",
        hint: "Listado vigente para compras.",
        path: "approved",
        icon: "star",
      },
      {
        label: "Criterios",
        hint: "Cómo se evalúa a cada proveedor.",
        path: "criteria",
        icon: "sliders",
      },
      {
        label: "Nuevo proveedor",
        hint: "Alta con rubro y contacto.",
        path: "new",
        icon: "plus",
        write: true,
      },
      guide("guide"),
    ],
  },
  automations: {
    icon: "bolt",
    tagline: "Vencimientos y avisos programados.",
    dueTypes: [],
    screens: [
      {
        label: "Automatizaciones",
        hint: "Vencimientos y avisos programados.",
        path: "",
        icon: "bolt",
      },
    ],
  },
  users: {
    icon: "users",
    tagline: "Quiénes forman parte de la empresa y con qué rol.",
    dueTypes: [],
    screens: [
      {
        label: "Usuarios",
        hint: "Personas con acceso y su rol.",
        path: "",
        icon: "users",
      },
    ],
  },
};

export function visibleScreens(key: ModuleKey, canWrite: boolean): HubScreen[] {
  return MODULE_HUB[key].screens.filter((s) => canWrite || !s.write);
}

export function screenHref(
  slug: string,
  module: ModuleDefinition,
  screen: HubScreen,
): string {
  return `/t/${slug}/${module.path}${screen.path ? `/${screen.path}` : ""}`;
}

export function moduleHubHref(slug: string, module: ModuleDefinition): string {
  return `/t/${slug}/m/${module.path}`;
}

/** Destino del hexágono del módulo: su hub si tiene varias pantallas, si no la pantalla directa. */
export function moduleEntryHref(
  slug: string,
  module: ModuleDefinition,
  canWrite: boolean,
): string {
  const screens = visibleScreens(module.key, canWrite);
  return screens.length > 1
    ? moduleHubHref(slug, module)
    : screenHref(slug, module, screens[0]);
}

/** "§6.2 · §9.1"; las de ISO 39001 llevan la norma porque no es la del resto del sistema. */
export function shortClauses(clauses: readonly ModuleClause[], max = 2): string {
  const seen = [
    ...new Set(
      clauses.map((c) =>
        c.standard === "ISO39001" ? `39001 §${c.clause}` : `§${c.clause}`,
      ),
    ),
  ];
  return seen.slice(0, max).join(" · ");
}

export type HubModuleTile = {
  key: ModuleKey;
  label: string;
  icon: HubIconName;
  href: string;
  meta: string;
};

export type HubArea = {
  key: ModuleSectionKey;
  label: string;
  tagline: string;
  modules: HubModuleTile[];
};

/** Áreas con al menos un módulo activo, en el orden del catálogo. */
export function hubAreas(
  slug: string,
  enabled: ReadonlySet<ModuleKey>,
  canWrite: boolean,
): HubArea[] {
  return MODULE_SECTIONS.map((section) => ({
    key: section.key,
    label: section.label,
    tagline: AREA_TAGLINES[section.key],
    modules: MODULE_CATALOG.filter(
      (m) => m.section === section.key && enabled.has(m.key),
    ).map((m) => {
      const count = visibleScreens(m.key, canWrite).length;
      return {
        key: m.key,
        label: m.label,
        icon: MODULE_HUB[m.key].icon,
        href: moduleEntryHref(slug, m, canWrite),
        meta: [shortClauses(m.clauses), count > 1 ? `${count} accesos` : null]
          .filter(Boolean)
          .join(" · "),
      };
    }),
  })).filter((area) => area.modules.length > 0);
}

export type TrailCrumb = { label: string; href: string };

export type TrailModule = {
  label: string;
  entry: string;
  base: string;
  hub: string;
  screens: TrailCrumb[];
};

/** Lo que necesita la ruta del encabezado para ubicar cualquier URL de la empresa. */
export type TrailIndex = { home: string; modules: TrailModule[] };

export function trailIndex(
  slug: string,
  enabled: ReadonlySet<ModuleKey>,
  canWrite: boolean,
): TrailIndex {
  return {
    home: `/t/${slug}`,
    modules: MODULE_CATALOG.filter((m) => enabled.has(m.key)).map((m) => ({
      label: m.label,
      entry: moduleEntryHref(slug, m, canWrite),
      base: `/t/${slug}/${m.path}`,
      hub: moduleHubHref(slug, m),
      screens: visibleScreens(m.key, canWrite).map((s) => ({
        label: s.label,
        href: screenHref(slug, m, s),
      })),
    })),
  };
}

const within = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** Inicio › Módulo › Pantalla. Un detalle (/risks/abc) cae en la pantalla más específica que lo contiene. */
export function crumbsFor(pathname: string, index: TrailIndex): TrailCrumb[] {
  const crumbs: TrailCrumb[] = [{ label: "Inicio", href: index.home }];
  const mod = index.modules.find((m) => pathname === m.hub || within(pathname, m.base));
  if (!mod) return crumbs;
  crumbs.push({ label: mod.label, href: mod.entry });
  if (pathname === mod.hub) return crumbs;
  const screen = mod.screens
    .filter((s) => within(pathname, s.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (screen && screen.href !== mod.entry) crumbs.push(screen);
  return crumbs;
}
