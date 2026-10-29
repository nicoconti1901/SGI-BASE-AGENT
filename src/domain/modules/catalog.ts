import type { IsoStandardCode } from "@/domain/ims/catalog";

export type ModuleSectionKey = "compliance" | "improvement" | "sst" | "people" | "admin";

export const MODULE_SECTIONS: readonly { key: ModuleSectionKey; label: string }[] = [
  { key: "compliance", label: "Cumplimiento" },
  { key: "improvement", label: "Mejora" },
  { key: "sst", label: "Operación SST" },
  { key: "people", label: "Personas y terceros" },
  { key: "admin", label: "Administración" },
];

export type ModuleKey =
  | "documents"
  | "audits"
  | "findings"
  | "risks"
  | "indicators"
  | "inspections"
  | "instruments"
  | "safety_stats"
  | "road_safety"
  | "master_data"
  | "training"
  | "suppliers"
  | "automations"
  | "users";

/** Cláusula ISO que el módulo ayuda a cumplir: contrato para la futura vista por requisito. */
export type ModuleClause = { standard: IsoStandardCode; clause: string };

export type ModuleDefinition = {
  key: ModuleKey;
  label: string;
  section: ModuleSectionKey;
  /** Segmento bajo /t/[slug]. */
  path: string;
  clauses: readonly ModuleClause[];
  /** "planned": registrado para la Fase 5, todavía sin pantallas; nunca aparece ni se activa. */
  status: "available" | "planned";
  defaultEnabled: boolean;
  /** No se puede desactivar por empresa. */
  alwaysOn?: boolean;
};

const all = (...clauses: string[]): ModuleClause[] =>
  (["ISO9001", "ISO14001", "ISO45001"] as const).flatMap((standard) =>
    clauses.map((clause) => ({ standard, clause })),
  );

/** El orden dentro de cada sección es el del menú. */
export const MODULE_CATALOG: readonly ModuleDefinition[] = [
  { key: "documents", label: "Documentos", section: "compliance", path: "documents", clauses: all("7.5"), status: "available", defaultEnabled: true },
  { key: "audits", label: "Auditorías", section: "compliance", path: "audits", clauses: all("9.2"), status: "available", defaultEnabled: true },
  { key: "findings", label: "Hallazgos", section: "improvement", path: "findings", clauses: all("10.2"), status: "available", defaultEnabled: true },
  { key: "risks", label: "Riesgos y oportunidades", section: "improvement", path: "risks", clauses: all("6.1"), status: "available", defaultEnabled: true },
  { key: "indicators", label: "Objetivos", section: "improvement", path: "indicators", clauses: all("6.2", "9.1"), status: "available", defaultEnabled: true },
  {
    key: "inspections",
    label: "Inspecciones",
    section: "sst",
    path: "inspections",
    clauses: [
      { standard: "ISO45001", clause: "6.1.2" },
      { standard: "ISO45001", clause: "8.1" },
      { standard: "ISO45001", clause: "9.1.1" },
      { standard: "ISO14001", clause: "8.1" },
      { standard: "ISO14001", clause: "9.1.1" },
      { standard: "ISO9001", clause: "7.1.3" },
    ],
    status: "available",
    defaultEnabled: false,
  },
  {
    key: "instruments",
    label: "Equipos de medición",
    section: "sst",
    path: "instruments",
    clauses: [
      { standard: "ISO9001", clause: "7.1.5.1" },
      { standard: "ISO9001", clause: "7.1.5.2" },
      { standard: "ISO14001", clause: "9.1.1" },
      { standard: "ISO45001", clause: "9.1.1" },
    ],
    status: "available",
    defaultEnabled: false,
  },
  {
    key: "safety_stats",
    label: "Accidentabilidad",
    section: "sst",
    path: "safety",
    clauses: [
      { standard: "ISO45001", clause: "9.1.1" },
      { standard: "ISO45001", clause: "10.2" },
    ],
    status: "available",
    defaultEnabled: false,
  },
  {
    key: "road_safety",
    label: "Seguridad vial",
    section: "sst",
    path: "road-safety",
    // ISO 39001 (D5): operación, evaluación del desempeño y mejora; las cláusulas del catálogo siguen «sin verificar» (D1).
    clauses: [
      { standard: "ISO39001", clause: "8.1" },
      { standard: "ISO39001", clause: "9.1" },
      { standard: "ISO39001", clause: "10.1" },
      { standard: "ISO45001", clause: "9.1.1" },
    ],
    status: "available",
    defaultEnabled: false,
  },
  { key: "master_data", label: "Datos maestros", section: "people", path: "master-data", clauses: [], status: "available", defaultEnabled: true },
  {
    key: "training",
    label: "Capacitaciones",
    section: "people",
    path: "training",
    clauses: [...all("7.2", "7.3"), { standard: "ISO45001", clause: "5.4" }],
    status: "available",
    defaultEnabled: false,
  },
  {
    key: "suppliers",
    label: "Proveedores",
    section: "people",
    path: "suppliers",
    clauses: [
      { standard: "ISO9001", clause: "8.4" },
      { standard: "ISO14001", clause: "8.1" },
      { standard: "ISO45001", clause: "8.1.4" },
    ],
    status: "available",
    defaultEnabled: false,
  },
  { key: "automations", label: "Automatizaciones", section: "admin", path: "automations", clauses: [], status: "available", defaultEnabled: true },
  { key: "users", label: "Usuarios", section: "admin", path: "users", clauses: [], status: "available", defaultEnabled: true, alwaysOn: true },
];

export function findModule(key: string): ModuleDefinition | undefined {
  return MODULE_CATALOG.find((m) => m.key === key);
}

export function canDisableModule(key: ModuleKey): boolean {
  return !findModule(key)?.alwaysOn;
}

/** Módulos activos de una empresa: el valor por defecto del catálogo, pisado por sus activaciones. */
export function enabledModuleKeys(
  activations: readonly { moduleKey: string; enabled: boolean }[],
): Set<ModuleKey> {
  const overrides = new Map(activations.map((a) => [a.moduleKey, a.enabled]));
  return new Set(
    MODULE_CATALOG.filter((m) => {
      if (m.status !== "available") return false;
      if (m.alwaysOn) return true;
      return overrides.get(m.key) ?? m.defaultEnabled;
    }).map((m) => m.key),
  );
}

export type NavSection = { label: string | null; items: { href: string; label: string }[] };

/** Menú de la empresa: Panel arriba y una sección por grupo con módulos activos. */
export function tenantNavSections(slug: string, enabled: ReadonlySet<ModuleKey>): NavSection[] {
  const base = `/t/${slug}`;
  const sections = MODULE_SECTIONS.map((section) => ({
    label: section.label,
    items: MODULE_CATALOG.filter((m) => m.section === section.key && enabled.has(m.key)).map((m) => ({
      href: `${base}/${m.path}`,
      label: m.label,
    })),
  })).filter((s) => s.items.length > 0);
  return [{ label: null, items: [{ href: base, label: "Panel" }] }, ...sections];
}

/** "§7.5 (9001 · 14001 · 45001)"; varias cláusulas se separan con " / ". */
export function clauseSummary(clauses: readonly ModuleClause[]): string {
  const byClause = new Map<string, string[]>();
  for (const c of clauses) {
    byClause.set(c.clause, [...(byClause.get(c.clause) ?? []), c.standard.replace("ISO", "")]);
  }
  return [...byClause.entries()].map(([clause, standards]) => `§${clause} (${standards.join(" · ")})`).join(" / ");
}
