export class TenantAccessError extends Error {
  readonly code = "TENANT_ACCESS_DENIED" as const;

  constructor(message = "Acceso denegado: el recurso no pertenece al tenant activo") {
    super(message);
    this.name = "TenantAccessError";
  }
}

export type TenantContext = {
  /** Tenant activo de la sesión. `null` solo es válido para superusuario de plataforma. */
  tenantId: string | null;
  isPlatformSuperuser: boolean;
};

/**
 * Deny-by-default: un recurso de tenant solo es accesible si el contexto
 * coincide, o si el actor es superusuario de plataforma.
 */
export function assertTenantAccess(
  ctx: TenantContext,
  resourceTenantId: string,
): void {
  if (ctx.isPlatformSuperuser) {
    return;
  }

  if (!ctx.tenantId || ctx.tenantId !== resourceTenantId) {
    throw new TenantAccessError();
  }
}

export function tenantWhere(tenantId: string): { tenantId: string } {
  return { tenantId };
}

/**
 * Filtra filas al tenant del contexto. Los superusuarios deben pasar
 * un tenantId explícito (no ven “todo” por accidente en queries de negocio).
 */
export function requireTenantId(ctx: TenantContext, explicitTenantId?: string): string {
  if (explicitTenantId) {
    assertTenantAccess(ctx, explicitTenantId);
    return explicitTenantId;
  }

  if (!ctx.tenantId) {
    throw new TenantAccessError(
      "Se requiere un tenant activo para esta operación",
    );
  }

  return ctx.tenantId;
}
