import { describe, expect, it } from "vitest";
import {
  ALL_STANDARDS,
  assertUniqueClauseKeys,
  BASE_STANDARDS,
  findByClauseKey,
  filterRequirements,
  offeredStandards,
  UNVERIFIED_TAG,
  type CatalogRequirement,
} from "@/domain/ims/catalog";
import {
  ESSENTIAL_CATALOG_SEED,
  catalogStats,
} from "@/domain/ims/seed-data";

describe("ims catalog seed invariants", () => {
  it("has requirements for every standard in the catalog", () => {
    const standards = new Set(ESSENTIAL_CATALOG_SEED.map((r) => r.standard));
    expect(standards).toEqual(new Set(ALL_STANDARDS));
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
    for (const standard of BASE_STANDARDS) {
      expect(stats.byStandard[standard].essential).toBeGreaterThan(15);
      expect(stats.byStandard[standard].essential).toBeLessThan(
        stats.byStandard[standard].total,
      );
    }
  });
});

describe("ISO 39001 en el catálogo (SPEC-road-safety D1, D4, AR-20, AR-21)", () => {
  const iso39001 = ESSENTIAL_CATALOG_SEED.filter((r) => r.standard === "ISO39001");

  it("todo requisito ISO39001 lleva el tag sin-verificar y un clauseKey único (AR-21)", () => {
    expect(iso39001.length).toBeGreaterThan(0);
    for (const r of iso39001) expect(r.tags).toContain(UNVERIFIED_TAG);
    expect(new Set(iso39001.map((r) => r.clauseKey)).size).toBe(iso39001.length);
    expect(iso39001.every((r) => r.clauseKey === `ISO39001:${r.clauseCode}`)).toBe(true);
  });

  it("ninguna otra norma lleva el tag sin-verificar", () => {
    const others = ESSENTIAL_CATALOG_SEED.filter((r) => r.standard !== "ISO39001");
    expect(others.some((r) => r.tags.includes(UNVERIFIED_TAG))).toBe(false);
  });

  it("no es esencial ni escalable: no entra en ninguna plantilla (D4)", () => {
    expect(iso39001.some((r) => r.essential || r.tags.includes("escalable"))).toBe(false);
  });

  it("no incluye la numeración descartada 6.1, 6.2 ni 6.3 (R§1.1)", () => {
    const codes = iso39001.map((r) => r.clauseCode);
    for (const c of ["6.1", "6.2", "6.3"]) expect(codes).not.toContain(c);
  });

  it("las tres normas anteriores conservan sus conteos (AR-20)", () => {
    const stats = catalogStats();
    expect(stats.byStandard.ISO9001.total).toBeGreaterThanOrEqual(55);
    expect(stats.byStandard.ISO14001.total).toBeGreaterThanOrEqual(35);
    expect(stats.byStandard.ISO45001.total).toBeGreaterThanOrEqual(45);
    expect(stats.byStandard.ISO39001.essential).toBe(0);
  });

  it("offeredStandards ofrece ISO39001 solo a quien la adoptó", () => {
    expect(offeredStandards([])).toEqual(["ISO9001", "ISO14001", "ISO45001"]);
    expect(offeredStandards(["ISO39001"])).toEqual(["ISO9001", "ISO14001", "ISO45001", "ISO39001"]);
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
