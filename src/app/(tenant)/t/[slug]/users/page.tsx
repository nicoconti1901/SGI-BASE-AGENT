import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership, listTenantMembers } from "@/lib/identity";
import { canTenantRole, labelPlatformOrTenantRole, labelTenantRole, PLATFORM_ROLE_LABEL } from "@/domain/identity/authz";
import { InviteMemberForm } from "@/app/(tenant)/t/[slug]/users/InviteMemberForm";
import { ActivateTenantButton } from "@/app/(tenant)/t/[slug]/ActivateTenantButton";

type Params = Promise<{ slug: string }>;

export default async function TenantUsersPage({ params }: { params: Params }) {
  const ctx = await getAppSessionContext();
  if (!ctx) {
    redirect("/login");
  }

  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    notFound();
  }

  const membership = await getMembership(ctx.userId, tenant.id);
  const canInvite = canTenantRole(membership?.role, "invite_users", {
    isPlatformSuperuser: ctx.isPlatformSuperuser,
  });

  if (!membership && !ctx.isPlatformSuperuser) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Sin acceso
        </h1>
        <p className="mt-3 text-[var(--color-ink-muted)]">
          No sos miembro de <strong>{tenant.name}</strong>. Pedile a un{" "}
          <strong>Administrador de la organización</strong> o al{" "}
          {PLATFORM_ROLE_LABEL.toLowerCase()} que te invite.
        </p>
        <Link href="/login" className="mt-4 inline-block text-[var(--color-accent)]">
          Ir al login
        </Link>
      </div>
    );
  }

  const members = await listTenantMembers(tenant.id);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
            {tenant.name}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Usuarios del tenant
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Sesión: {ctx.email}
            {" · "}
            {labelPlatformOrTenantRole({
              isPlatformSuperuser: ctx.isPlatformSuperuser && !membership,
              tenantRole: membership?.role,
            })}
            {ctx.isPlatformSuperuser && membership
              ? ` (${PLATFORM_ROLE_LABEL})`
              : ""}
            {ctx.tenantId === tenant.id
              ? " · tenant activo"
              : " · tenant no activo en sesión"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActivateTenantButton slug={slug} />
          <Link
            href={`/t/${slug}`}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
          >
            Volver al portal
          </Link>
        </div>
      </div>

      {canInvite ? <InviteMemberForm slug={slug} /> : (
        <p className="rounded-[var(--radius-lg)] border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-warning)]">
          Tu rol no puede invitar usuarios (hace falta{" "}
          <strong>Administrador de la organización</strong> o{" "}
          {PLATFORM_ROLE_LABEL.toLowerCase()}).
        </p>
      )}

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Miembros ({members.length})
        </h2>
        <div className="mt-3 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-subtle)]">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Rol</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-[var(--color-line)] last:border-b-0"
                >
                  <td className="px-4 py-3">{member.user.name}</td>
                  <td className="px-4 py-3">{member.user.email}</td>
                  <td className="px-4 py-3">{labelTenantRole(member.role)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
