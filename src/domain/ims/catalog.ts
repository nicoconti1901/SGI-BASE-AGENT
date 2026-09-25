export type IsoStandardCode = "ISO9001" | "ISO14001" | "ISO45001";

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
