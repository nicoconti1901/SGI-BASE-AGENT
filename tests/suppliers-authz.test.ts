import { describe, expect, it } from "vitest";
import { canTenantRole, type AuthzAction } from "@/domain/identity/authz";

const ACTIONS: AuthzAction[] = ["manage_suppliers", "evaluate_suppliers", "manage_supplier_criteria", "upload_supplier_documents"];

describe("permisos de proveedores (tabla del SPEC)", () => {
  it("administrador: todo", () => {
    for (const a of ACTIONS) expect(canTenantRole("tenant_admin", a)).toBe(true);
  });

  it("responsable de proceso: gestiona, evalúa y carga documentos; no edita criterios", () => {
    expect(canTenantRole("process_owner", "manage_suppliers")).toBe(true);
    expect(canTenantRole("process_owner", "evaluate_suppliers")).toBe(true);
    expect(canTenantRole("process_owner", "upload_supplier_documents")).toBe(true);
    expect(canTenantRole("process_owner", "manage_supplier_criteria")).toBe(false);
  });

  it("colaborador: solo carga documentos", () => {
    expect(canTenantRole("contributor", "upload_supplier_documents")).toBe(true);
    for (const a of ["manage_suppliers", "evaluate_suppliers", "manage_supplier_criteria"] as const) {
      expect(canTenantRole("contributor", a)).toBe(false);
    }
  });

  it("consulta: nada, y sin rol tampoco", () => {
    for (const a of ACTIONS) {
      expect(canTenantRole("viewer", a)).toBe(false);
      expect(canTenantRole(null, a)).toBe(false);
    }
  });

  it("el superusuario de plataforma puede todo", () => {
    for (const a of ACTIONS) expect(canTenantRole(null, a, { isPlatformSuperuser: true })).toBe(true);
  });
});
