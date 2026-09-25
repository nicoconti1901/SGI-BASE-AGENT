import { describe, expect, it } from "vitest";
import {
  TenantAccessError,
  assertTenantAccess,
  requireTenantId,
  tenantWhere,
} from "@/domain/tenancy/access";

describe("tenancy access (deny-by-default)", () => {
  it("permite acceso cuando el tenant coincide", () => {
    expect(() =>
      assertTenantAccess(
        { tenantId: "tenant-a", isPlatformSuperuser: false },
        "tenant-a",
      ),
    ).not.toThrow();
  });

  it("bloquea acceso cruzado entre tenants", () => {
    expect(() =>
      assertTenantAccess(
        { tenantId: "tenant-a", isPlatformSuperuser: false },
        "tenant-b",
      ),
    ).toThrow(TenantAccessError);
  });

  it("bloquea si no hay tenant activo", () => {
    expect(() =>
      assertTenantAccess(
        { tenantId: null, isPlatformSuperuser: false },
        "tenant-a",
      ),
    ).toThrow(TenantAccessError);
  });

  it("permite al superusuario de plataforma cruzar tenants", () => {
    expect(() =>
      assertTenantAccess(
        { tenantId: null, isPlatformSuperuser: true },
        "tenant-b",
      ),
    ).not.toThrow();
  });

  it("requireTenantId exige tenant explícito o activo", () => {
    expect(() =>
      requireTenantId({ tenantId: null, isPlatformSuperuser: false }),
    ).toThrow(TenantAccessError);

    expect(
      requireTenantId({ tenantId: "tenant-a", isPlatformSuperuser: false }),
    ).toBe("tenant-a");
  });

  it("tenantWhere siempre fija el filtro de aislamiento", () => {
    expect(tenantWhere("tenant-a")).toEqual({ tenantId: "tenant-a" });
  });
});
