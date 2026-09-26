import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import { listNonconformities } from "@/lib/operations-nc";
import {
  labelWorkflowStatus,
  type WorkflowStatus,
} from "@/domain/operations/nc";
import { CreateNcForm } from "@/app/(tenant)/t/[slug]/operations/OperationsForms";

type Params = Promise<{ slug: string }>;

export default async function TenantOperationsPage({
  params,
}: {
  params: Params;
}) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");

  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const membership = await getMembership(ctx.userId, tenant.id);
  if (!membership && !ctx.isPlatformSuperuser) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Sin acceso
        </h1>
      </div>
    );
  }

  const canWrite = canTenantRole(membership?.role, "write", {
    isPlatformSuperuser: ctx.isPlatformSuperuser,
  });
  const ncs = await listNonconformities(tenant.id);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
            {tenant.name}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Operaciones · NC
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            No conformidades y acciones correctivas. Las fechas de acción
            alimentan el motor de vencimientos.
          </p>
        </div>
        <Link
          href={`/t/${slug}`}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
        >
          Volver al portal
        </Link>
      </div>

      {canWrite ? <CreateNcForm slug={slug} /> : (
        <p className="text-sm text-[var(--color-ink-muted)]">
          Tu rol es de solo lectura en operaciones.
        </p>
      )}

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          No conformidades ({ncs.length})
        </h2>
        {ncs.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
            Todavía no hay NC registradas.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {ncs.map((nc) => (
              <li
                key={nc.id}
                className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/t/${slug}/operations/${nc.id}`}
                      className="font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
                    >
                      {nc.title}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
                      {labelWorkflowStatus(nc.status as WorkflowStatus)}
                      {nc.ownerName ? ` · ${nc.ownerName}` : ""}
                      {" · "}
                      {nc._count.actions} acciones
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
