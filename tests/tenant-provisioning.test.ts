import { describe, expect, it } from "vitest";
import {
  assertValidSlug,
  selectRequirementIdsForTemplate,
  slugifyTenantName,
  templateSelectionRules,
} from "@/domain/tenant/provisioning";

describe("tenant provisioning domain", () => {
  it("slugifies names for path-based URLs", () => {
    expect(slugifyTenantName("Acme Sur S.A.")).toBe("acme-sur-s-a");
    expect(slugifyTenantName("  Calidad Ñandú  ")).toBe("calidad-nandu");
  });

  it("validates slugs", () => {
    expect(() => assertValidSlug("acme-sur")).not.toThrow();
    expect(() => assertValidSlug("Acme")).toThrow(/Slug inválido/i);
  });

  it("small tenants only get essentials", () => {
    const rules = templateSelectionRules({
      size: "small",
      activity: "manufactura",
    });
    expect(rules.extraTags).toEqual([]);

    const ids = selectRequirementIdsForTemplate({
      size: "small",
      activity: "manufactura",
      catalog: [
        { id: "e1", essential: true, tags: ["primerizas"] },
        { id: "s1", essential: false, tags: ["operacion", "escalable"] },
      ],
    });
    expect(ids).toEqual(["e1"]);
  });

  it("las normas opt-in no entran en la plantilla, ni siquiera en empresas grandes (D4)", () => {
    const catalog = [
      { id: "e1", standard: "ISO9001" as const, essential: true, tags: ["primerizas"] },
      { id: "s1", standard: "ISO45001" as const, essential: false, tags: ["escalable"] },
      { id: "v1", standard: "ISO39001" as const, essential: false, tags: ["escalable", "vial"] },
      { id: "v2", standard: "ISO39001" as const, essential: true, tags: ["primerizas"] },
    ];
    for (const size of ["small", "medium", "large"] as const) {
      const ids = selectRequirementIdsForTemplate({ size, activity: "servicios", catalog });
      expect(ids).not.toContain("v1");
      expect(ids).not.toContain("v2");
    }
    expect(selectRequirementIdsForTemplate({ size: "large", activity: "servicios", catalog }).sort()).toEqual(["e1", "s1"]);
  });

  it("medium tenants add activity-tagged escalables", () => {
    const ids = selectRequirementIdsForTemplate({
      size: "medium",
      activity: "servicios",
      catalog: [
        { id: "e1", essential: true, tags: ["primerizas"] },
        { id: "s1", essential: false, tags: ["cliente", "escalable"] },
        { id: "s2", essential: false, tags: ["trazabilidad", "escalable"] },
      ],
    });
    expect(ids.sort()).toEqual(["e1", "s1"]);
  });
});
