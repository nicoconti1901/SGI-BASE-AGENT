import { describe, expect, it } from "vitest";
import {
  describeCapabilities,
  resolveHomePath,
  resolvePersona,
} from "@/domain/identity/persona";

describe("persona", () => {
  it("distinguishes superuser, company admin and member", () => {
    expect(resolvePersona({ isPlatformSuperuser: true, tenantRole: "viewer" })).toBe(
      "superuser",
    );
    expect(
      resolvePersona({ isPlatformSuperuser: false, tenantRole: "tenant_admin" }),
    ).toBe("company_admin");
    expect(
      resolvePersona({ isPlatformSuperuser: false, tenantRole: "contributor" }),
    ).toBe("member");
    expect(resolvePersona({ isPlatformSuperuser: false, tenantRole: null })).toBe(
      "member",
    );
  });

  it("describes capabilities explicitly", () => {
    expect(
      describeCapabilities({ isPlatformSuperuser: false, tenantRole: "viewer" }),
    ).toEqual({ canEdit: false, items: ["Ver"] });
    expect(
      describeCapabilities({ isPlatformSuperuser: false, tenantRole: "contributor" }),
    ).toEqual({ canEdit: true, items: ["Ver", "Crear y editar"] });
    expect(
      describeCapabilities({ isPlatformSuperuser: false, tenantRole: "tenant_admin" })
        .items,
    ).toContain("Gestionar usuarios");
  });

  it("sends each persona to its natural home", () => {
    expect(resolveHomePath({ isPlatformSuperuser: true, tenantSlugs: ["acme"] })).toBe(
      "/platform",
    );
    expect(
      resolveHomePath({ isPlatformSuperuser: false, tenantSlugs: ["acme", "beta"] }),
    ).toBe("/t/acme");
    expect(resolveHomePath({ isPlatformSuperuser: false, tenantSlugs: [] })).toBeNull();
  });
});
