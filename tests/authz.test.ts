import { describe, expect, it } from "vitest";
import { canTenantRole } from "@/domain/identity/authz";

describe("tenant authz policy", () => {
  it("viewer cannot mutate", () => {
    expect(canTenantRole("viewer", "read")).toBe(true);
    expect(canTenantRole("viewer", "write")).toBe(false);
    expect(canTenantRole("viewer", "invite_users")).toBe(false);
  });

  it("contributor can write but not invite", () => {
    expect(canTenantRole("contributor", "write")).toBe(true);
    expect(canTenantRole("contributor", "invite_users")).toBe(false);
    expect(canTenantRole("contributor", "manage_roles")).toBe(false);
  });

  it("tenant_admin can invite and manage roles", () => {
    expect(canTenantRole("tenant_admin", "invite_users")).toBe(true);
    expect(canTenantRole("tenant_admin", "manage_roles")).toBe(true);
  });

  it("platform superuser bypasses tenant role checks", () => {
    expect(
      canTenantRole(null, "invite_users", { isPlatformSuperuser: true }),
    ).toBe(true);
  });
});
