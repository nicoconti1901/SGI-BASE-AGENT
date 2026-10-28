export type IsoStandardCode = "ISO9001" | "ISO14001" | "ISO45001" | "ISO39001";

/** Normas que toda empresa recibe en su plantilla inicial. */
export const BASE_STANDARDS: readonly IsoStandardCode[] = ["ISO9001", "ISO14001", "ISO45001"];

/** Normas que ninguna empresa recibe sin activarlas (SPEC-road-safety D4). */
export const OPT_IN_STANDARDS: readonly IsoStandardCode[] = ["ISO39001"];

/** Todas las normas del catálogo, en el orden en que se muestran. */
export const ALL_STANDARDS: readonly IsoStandardCode[] = [...BASE_STANDARDS, ...OPT_IN_STANDARDS];

/** Marca de los requisitos cuya numeración no se confirmó contra la norma licenciada (SPEC-road-safety D1). */
export const UNVERIFIED_TAG = "sin-verificar";

export function isOptInStandard(standard: IsoStandardCode): boolean {
  return OPT_IN_STANDARDS.includes(standard);
}

/** Normas que se ofrecen a una empresa: las base y, solo si la adoptó, cada norma opt-in. */
export function offeredStandards(adopted: Iterable<IsoStandardCode>): IsoStandardCode[] {
  const set = new Set(adopted);
  return ALL_STANDARDS.filter((s) => !isOptInStandard(s) || set.has(s));
}

export type CatalogRequirement = {
  standard: IsoStandardCode;
  clauseCode: string;
  clauseKey: string;
  title: string;
  summary: string;
  essential: boolean;
  tags: string[];
};

export function buildClauseKey(
  standard: IsoStandardCode,
  clauseCode: string,
): string {
  return `${standard}:${clauseCode}`;
}

export function assertUniqueClauseKeys(requirements: CatalogRequirement[]): void {
  const seen = new Set<string>();
  for (const requirement of requirements) {
    if (seen.has(requirement.clauseKey)) {
      throw new Error(`duplicate clauseKey: ${requirement.clauseKey}`);
    }
    seen.add(requirement.clauseKey);
  }
}

export function findByClauseKey(
  requirements: CatalogRequirement[],
  clauseKey: string,
): CatalogRequirement | null {
  return requirements.find((r) => r.clauseKey === clauseKey) ?? null;
}

export function filterRequirements(
  requirements: CatalogRequirement[],
  filters: { standard?: IsoStandardCode; essential?: boolean; tag?: string },
): CatalogRequirement[] {
  return requirements.filter((requirement) => {
    if (filters.standard && requirement.standard !== filters.standard) {
      return false;
    }
    if (
      typeof filters.essential === "boolean" &&
      requirement.essential !== filters.essential
    ) {
      return false;
    }
    if (filters.tag && !requirement.tags.includes(filters.tag)) {
      return false;
    }
    return true;
  });
}
