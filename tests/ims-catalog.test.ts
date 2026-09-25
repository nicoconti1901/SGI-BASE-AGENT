import { describe, expect, it } from "vitest";
import {
  assertUniqueClauseKeys,
  findByClauseKey,
  filterRequirements,
  type CatalogRequirement,
} from "@/domain/ims/catalog";
import {
  ESSENTIAL_CATALOG_SEED,
  catalogStats,
} from "@/domain/ims/seed-data";

describe("ims catalog seed invariants", () => {
  it("has requirements for all three standards", () => {
    const standards = new Set(ESSENTIAL_CATALOG_SEED.map((r) => r.standard));
    expect(standards).toEqual(new Set(["ISO9001", "ISO14001", "ISO45001"]));
  });

  it("covers the full operational clause map (not a tiny sample)", () => {
    const stats = catalogStats();
    expect(stats.total).toBeGreaterThanOrEqual(140);
    expect(stats.byStandard.ISO9001.total).toBeGreaterThanOrEqual(55);
    expect(stats.byStandard.ISO14001.total).toBeGreaterThanOrEqual(35);
    expect(stats.byStandard.ISO45001.total).toBeGreaterThanOrEqual(45);
  });

  it("rejects duplicate clause keys", () => {
    expect(() => assertUniqueClauseKeys(ESSENTIAL_CATALOG_SEED)).not.toThrow();

    const withDup: CatalogRequirement[] = [
      ...ESSENTIAL_CATALOG_SEED.slice(0, 2),
      { ...ESSENTIAL_CATALOG_SEED[0]! },
    ];
    expect(() => assertUniqueClauseKeys(withDup)).toThrow(/duplicate clauseKey/i);
  });

  it("marks a primerizas baseline (essential) per standard", () => {
    const stats = catalogStats();
    expect(stats.essential).toBeGreaterThan(40);
    expect(stats.essential).toBeLessThan(90);
    expect(stats.scalable).toBeGreaterThan(50);
    for (const standard of ["ISO9001", "ISO14001", "ISO45001"] as const) {
      expect(stats.byStandard[standard].essential).toBeGreaterThan(15);
      expect(stats.byStandard[standard].essential).toBeLessThan(
        stats.byStandard[standard].total,
      );
    }
  });
});

describe("ims catalog lookup helpers", () => {
  it("finds by clause key", () => {
    const key = ESSENTIAL_CATALOG_SEED[0]!.clauseKey;
    expect(findByClauseKey(ESSENTIAL_CATALOG_SEED, key)?.clauseKey).toBe(key);
    expect(findByClauseKey(ESSENTIAL_CATALOG_SEED, "missing")).toBeNull();
  });

  it("filters essentials for primerizas companies", () => {
    const essentials = filterRequirements(ESSENTIAL_CATALOG_SEED, {
      essential: true,
    });
    expect(essentials.every((r) => r.essential)).toBe(true);
    expect(essentials.length).toBe(catalogStats().essential);
  });
});
