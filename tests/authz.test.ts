import { describe, expect, it } from "vitest";
import {
  canTenantRole,
  labelTenantRole,
  PLATFORM_ROLE_LABEL,
  TENANT_ROLE_LABELS,
} from "@/domain/identity/authz";

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

  it("exposes professional Spanish labels", () => {
    expect(TENANT_ROLE_LABELS.viewer).toBe("Consulta");
    expect(TENANT_ROLE_LABELS.contributor).toBe("Colaborador");
    expect(TENANT_ROLE_LABELS.process_owner).toBe("Responsable de proceso");
    expect(TENANT_ROLE_LABELS.tenant_admin).toBe(
      "Administrador de la organización",
    );
    expect(labelTenantRole("process_owner")).toBe("Responsable de proceso");
    expect(PLATFORM_ROLE_LABEL).toBe("Administrador de plataforma");
  });
});
