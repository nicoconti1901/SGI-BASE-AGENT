import { describe, expect, it } from "vitest";
import {
  assertUniqueClauseKeys,
  findByClauseKey,
  filterRequirements,
  type CatalogRequirement,
} from "@/domain/ims/catalog";
import { ESSENTIAL_CATALOG_SEED } from "@/domain/ims/seed-data";

describe("ims catalog seed invariants", () => {
  it("has requirements for all three standards", () => {
    const standards = new Set(ESSENTIAL_CATALOG_SEED.map((r) => r.standard));
    expect(standards).toEqual(new Set(["ISO9001", "ISO14001", "ISO45001"]));
  });

  it("rejects duplicate clause keys", () => {
    expect(() => assertUniqueClauseKeys(ESSENTIAL_CATALOG_SEED)).not.toThrow();

    const withDup: CatalogRequirement[] = [
      ...ESSENTIAL_CATALOG_SEED.slice(0, 2),
      { ...ESSENTIAL_CATALOG_SEED[0]! },
    ];
    expect(() => assertUniqueClauseKeys(withDup)).toThrow(/duplicate clauseKey/i);
  });

  it("marks at least one essential requirement per standard", () => {
    for (const standard of ["ISO9001", "ISO14001", "ISO45001"] as const) {
      const essentials = ESSENTIAL_CATALOG_SEED.filter(
        (r) => r.standard === standard && r.essential,
      );
      expect(essentials.length).toBeGreaterThan(0);
    }
  });
});

describe("ims catalog lookup helpers", () => {
  it("finds by clause key", () => {
    const key = ESSENTIAL_CATALOG_SEED[0]!.clauseKey;
    expect(findByClauseKey(ESSENTIAL_CATALOG_SEED, key)?.clauseKey).toBe(key);
    expect(findByClauseKey(ESSENTIAL_CATALOG_SEED, "missing")).toBeNull();
  });

  it("filters by standard and essential flag", () => {
    const only9001 = filterRequirements(ESSENTIAL_CATALOG_SEED, {
      standard: "ISO9001",
    });
    expect(only9001.every((r) => r.standard === "ISO9001")).toBe(true);

    const essentials = filterRequirements(ESSENTIAL_CATALOG_SEED, {
      essential: true,
    });
    expect(essentials.every((r) => r.essential)).toBe(true);
  });
});
