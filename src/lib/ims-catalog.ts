import { prisma } from "@/lib/db";
import type { IsoStandard } from "@prisma/client";
import {
  filterRequirements,
  type CatalogRequirement,
  type IsoStandardCode,
} from "@/domain/ims/catalog";

function toDomain(row: {
  standard: IsoStandard;
  clauseCode: string;
  clauseKey: string;
  title: string;
  summary: string;
  essential: boolean;
  tags: string[];
}): CatalogRequirement {
  return {
    standard: row.standard as IsoStandardCode,
    clauseCode: row.clauseCode,
    clauseKey: row.clauseKey,
    title: row.title,
    summary: row.summary,
    essential: row.essential,
    tags: row.tags,
  };
}

export async function listCatalogRequirements(filters?: {
  standard?: IsoStandardCode;
  essential?: boolean;
}): Promise<CatalogRequirement[]> {
  const rows = await prisma.isoRequirement.findMany({
    orderBy: [{ standard: "asc" }, { clauseCode: "asc" }],
  });

  const domain = rows.map(toDomain);
  if (!filters) {
    return domain;
  }

  return filterRequirements(domain, filters);
}
