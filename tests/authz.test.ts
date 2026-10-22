import { describe, expect, it } from "vitest";
import {
  canTenantRole,
  labelTenantRole,
  PLATFORM_ROLE_LABEL,
  TENANT_ROLE_LABELS,
} from "@/domain/identity/authz";
import { canManageHealthData, canReportIncident, canViewHealthData } from "@/domain/safety-stats/access";

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

describe("safety stats permissions", () => {
  it("manage_safety_stats es del administrador y del responsable de proceso", () => {
    expect(canTenantRole("tenant_admin", "manage_safety_stats")).toBe(true);
    expect(canTenantRole("process_owner", "manage_safety_stats")).toBe(true);
    expect(canTenantRole("contributor", "manage_safety_stats")).toBe(false);
    expect(canTenantRole("viewer", "manage_safety_stats")).toBe(false);
  });

  it("todos los roles ven la ficha; solo contributor y superiores dan de alta; solo admin y responsable editan; la plataforma no ve", () => {
    for (const role of ["tenant_admin", "process_owner", "contributor", "viewer"] as const) {
      expect(canViewHealthData({ role })).toBe(true);
    }
    expect(canViewHealthData({ role: null })).toBe(false);
    expect(canViewHealthData({ role: "tenant_admin", isPlatformSuperuser: true })).toBe(false);
    expect(canViewHealthData({ role: null, isPlatformSuperuser: true })).toBe(false);

    expect(canReportIncident({ role: "viewer" })).toBe(false);
    expect(canReportIncident({ role: "contributor" })).toBe(true);

    expect(canManageHealthData({ role: "contributor" })).toBe(false);
    expect(canManageHealthData({ role: "viewer" })).toBe(false);
    expect(canManageHealthData({ role: "process_owner" })).toBe(true);
    expect(canManageHealthData({ role: "tenant_admin" })).toBe(true);
    expect(canManageHealthData({ role: null, isPlatformSuperuser: true })).toBe(false);
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

describe("training permissions", () => {
  it("la matriz y las anulaciones: administrador y responsable de proceso", () => {
    expect(canTenantRole("tenant_admin", "manage_training")).toBe(true);
    expect(canTenantRole("process_owner", "manage_training")).toBe(true);
    expect(canTenantRole("contributor", "manage_training")).toBe(false);
    expect(canTenantRole("viewer", "manage_training")).toBe(false);
  });

  it("registrar capacitaciones: también el colaborador, nunca consulta", () => {
    expect(canTenantRole("tenant_admin", "record_training")).toBe(true);
    expect(canTenantRole("process_owner", "record_training")).toBe(true);
    expect(canTenantRole("contributor", "record_training")).toBe(true);
    expect(canTenantRole("viewer", "record_training")).toBe(false);
  });
});
