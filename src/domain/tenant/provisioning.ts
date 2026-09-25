export type TenantSize = "small" | "medium" | "large";
export type TenantActivity =
  | "manufactura"
  | "servicios"
  | "construccion"
  | "comercio"
  | "otro";

export const TENANT_SIZES: TenantSize[] = ["small", "medium", "large"];
export const TENANT_ACTIVITIES: TenantActivity[] = [
  "manufactura",
  "servicios",
  "construccion",
  "comercio",
  "otro",
];

const ACTIVITY_EXTRA_TAGS: Record<TenantActivity, string[]> = {
  manufactura: ["operacion", "trazabilidad", "medicion"],
  servicios: ["cliente", "postventa"],
  construccion: ["riesgos", "emergencias", "contratistas"],
  comercio: ["cliente", "proveedores"],
  otro: [],
};

/**
 * Reglas documentadas (Task 5):
 * - small  → solo requisitos essential (empresas primerizas)
 * - medium → essential + escalables cuyo tag coincida con la actividad
 * - large  → essential + todos los escalables de la actividad + tag "escalable" genérico limitado por actividad
 */
export function templateSelectionRules(input: {
  size: TenantSize;
  activity: TenantActivity;
}): { includeAllEssential: true; extraTags: string[] } {
  if (input.size === "small") {
    return { includeAllEssential: true, extraTags: [] };
  }

  const activityTags = ACTIVITY_EXTRA_TAGS[input.activity] ?? [];
  if (input.size === "medium") {
    return { includeAllEssential: true, extraTags: activityTags };
  }

  // large
  return {
    includeAllEssential: true,
    extraTags: [...new Set([...activityTags, "escalable"])],
  };
}

export function slugifyTenantName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function assertValidSlug(slug: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      "Slug inválido: usá minúsculas, números y guiones (ej. acme-sur)",
    );
  }
}

export function selectRequirementIdsForTemplate(input: {
  size: TenantSize;
  activity: TenantActivity;
  catalog: Array<{ id: string; essential: boolean; tags: string[] }>;
}): string[] {
  const rules = templateSelectionRules(input);
  const selected = new Set<string>();

  for (const requirement of input.catalog) {
    if (requirement.essential && rules.includeAllEssential) {
      selected.add(requirement.id);
      continue;
    }
    if (
      !requirement.essential &&
      rules.extraTags.some((tag) => requirement.tags.includes(tag))
    ) {
      selected.add(requirement.id);
    }
  }

  return [...selected];
}
