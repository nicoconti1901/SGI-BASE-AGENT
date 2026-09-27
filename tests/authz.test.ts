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

describe("audit permissions", () => {
  it("lets admins and process owners plan, only admins approve the program", () => {
    expect(canTenantRole("process_owner", "plan_audits")).toBe(true);
    expect(canTenantRole("contributor", "plan_audits")).toBe(false);
    expect(canTenantRole("tenant_admin", "approve_audit_program")).toBe(true);
    expect(canTenantRole("process_owner", "approve_audit_program")).toBe(false);
  });
});

describe("finding lifecycle permissions", () => {
  it("lets admins and process owners verify, only admins cancel or reopen", () => {
    expect(canTenantRole("process_owner", "verify_findings")).toBe(true);
    expect(canTenantRole("contributor", "verify_findings")).toBe(false);
    expect(canTenantRole("tenant_admin", "cancel_findings")).toBe(true);
    expect(canTenantRole("process_owner", "cancel_findings")).toBe(false);
  });
});

describe("objectives permissions", () => {
  it("lets admins and process owners manage objectives", () => {
    expect(canTenantRole("tenant_admin", "manage_objectives")).toBe(true);
    expect(canTenantRole("process_owner", "manage_objectives")).toBe(true);
    expect(canTenantRole("contributor", "manage_objectives")).toBe(false);
    expect(canTenantRole("viewer", "manage_objectives")).toBe(false);
  });
});
