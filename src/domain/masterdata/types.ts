export const SITE_KINDS = ["office", "base", "worksite", "field", "camp", "plant"] as const;
export type SiteKindValue = (typeof SITE_KINDS)[number];

export const SITE_KIND_LABELS: Record<SiteKindValue, string> = {
  office: "Oficina",
  base: "Base",
  worksite: "Obrador",
  field: "Yacimiento",
  camp: "Campamento",
  plant: "Planta",
};

export type EmployerValue = "own" | "contractor";

export const EMPLOYER_LABELS: Record<EmployerValue, string> = {
  own: "Propia",
  contractor: "Contratista",
};

/** Persona tal como se compara contra el CSV (todo por nombre, nada por id). */
export type RosterPersonSnapshot = {
  employeeCode: string;
  name: string;
  documentId: string | null;
  employer: EmployerValue;
  contractorName: string | null;
  siteName: string;
  extraSiteNames: string[];
  positionName: string;
  /** YYYY-MM-DD o null */
  hiredAt: string | null;
  taskNames: string[];
  active: boolean;
};

/** Fila del CSV ya validada y normalizada. */
export type RosterRow = Omit<RosterPersonSnapshot, "active"> & { line: number };

export type RosterRowError = { line: number; field: string; message: string };

export type MasterDataEntity = "site" | "position" | "task";

export const MASTER_DATA_ENTITY_LABELS: Record<MasterDataEntity, string> = {
  site: "sede",
  position: "puesto",
  task: "tarea",
};
