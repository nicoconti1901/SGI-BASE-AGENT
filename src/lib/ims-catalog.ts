import { prisma } from "@/lib/db";
import type { IsoStandard, PrismaClient } from "@prisma/client";
import {
  filterRequirements,
  offeredStandards,
  OPT_IN_STANDARDS,
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

/** Normas que se ofrecen a una empresa: las base y cada norma opt-in que adoptó (SPEC-road-safety D3, D4). */
export async function listOfferedStandards(
  tenantId: string,
  db: Pick<PrismaClient, "tenantRequirement"> = prisma,
): Promise<IsoStandardCode[]> {
  const adopted = await db.tenantRequirement.findMany({
    where: { tenantId, requirement: { standard: { in: [...OPT_IN_STANDARDS] as IsoStandard[] } } },
    distinct: ["requirementId"],
    select: { requirement: { select: { standard: true } } },
  });
  return offeredStandards(adopted.map((r) => r.requirement.standard as IsoStandardCode));
}

/** Normas elegidas que la empresa no adoptó (vacío si todas se ofrecen). No consulta si no hay opt-in. */
export async function findUnofferedStandards(
  tenantId: string,
  standards: readonly IsoStandardCode[],
  db: Pick<PrismaClient, "tenantRequirement"> = prisma,
): Promise<IsoStandardCode[]> {
  if (!standards.some((s) => OPT_IN_STANDARDS.includes(s))) return [];
  const offered = new Set(await listOfferedStandards(tenantId, db));
  return standards.filter((s) => !offered.has(s));
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
