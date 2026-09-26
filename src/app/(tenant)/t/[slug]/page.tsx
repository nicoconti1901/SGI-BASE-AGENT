import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getAppSessionContext } from "@/lib/session";
import { getMembership } from "@/lib/identity";
import { ActivateTenantButton } from "@/app/(tenant)/t/[slug]/ActivateTenantButton";
import {
  canTenantRole,
  labelPlatformOrTenantRole,
} from "@/domain/identity/authz";

type Params = Promise<{ slug: string }>;

export default async function TenantPortalBySlugPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    notFound();
  }

  const ctx = await getAppSessionContext();
  if (!ctx) {
    redirect("/login");
  }

  const membership = await getMembership(ctx.userId, tenant.id);
  if (!membership && !ctx.isPlatformSuperuser) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Sin membresía
        </h1>
        <p className="mt-3 text-[var(--color-ink-muted)]">
          {ctx.email} no es miembro de <strong>{tenant.name}</strong>.
        </p>
      </div>
    );
  }

  const canInvite = canTenantRole(membership?.role, "invite_users", {
    isPlatformSuperuser: ctx.isPlatformSuperuser,
  });
  const canWrite = canTenantRole(membership?.role, "write", {
    isPlatformSuperuser: ctx.isPlatformSuperuser,
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
          Portal del cliente
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">
          {tenant.name}
        </h1>
        <p className="mt-2 text-[var(--color-ink-muted)]">
          Tenant <strong>{tenant.slug}</strong> · {tenant.size} / {tenant.activity}{" "}
          · {tenant._count.requirements} requisitos
        </p>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          Sesión {ctx.email}
          {" · "}
          {labelPlatformOrTenantRole({
            isPlatformSuperuser: ctx.isPlatformSuperuser && !membership,
            tenantRole: membership?.role,
          })}
          {ctx.isPlatformSuperuser && membership
            ? ` · también ${labelPlatformOrTenantRole({ isPlatformSuperuser: true })}`
            : ""}
          {ctx.tenantId === tenant.id ? " · activo" : ""}
          {" · "}
          {canWrite ? "puede editar" : "solo lectura"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <ActivateTenantButton slug={slug} />
        {canInvite ? (
          <Link
            href={`/t/${slug}/users`}
            className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Gestionar usuarios
          </Link>
        ) : (
          <Link
            href={`/t/${slug}/users`}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
          >
            Ver usuarios
          </Link>
        )}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface)] px-5 py-8 text-sm text-[var(--color-ink-muted)]">
        Identity-access listo. Consulta no muta; Colaborador escribe;
        Administrador de la organización invita. Gap y documentos en el panel de
        plataforma.
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/t/${slug}/documents`}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
        >
          Ver documentos
        </Link>
        <Link
          href={`/t/${slug}/operations`}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
        >
          Operaciones (NC)
        </Link>
        <Link
          href={`/t/${slug}/automations`}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
        >
          Automatizaciones
        </Link>
      </div>
    </div>
  );
}
