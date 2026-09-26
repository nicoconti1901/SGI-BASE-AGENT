import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import { getNonconformity } from "@/lib/operations-nc";
import {
  labelWorkflowStatus,
  type WorkflowStatus,
} from "@/domain/operations/nc";
import {
  CreateActionForm,
  UpdateActionStatusForm,
  UpdateNcStatusForm,
} from "@/app/(tenant)/t/[slug]/operations/OperationsForms";

type Params = Promise<{ slug: string; ncId: string }>;

export default async function NonconformityDetailPage({
  params,
}: {
  params: Params;
}) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");

  const { slug, ncId } = await params;
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

  const nc = await getNonconformity(tenant.id, ncId);
  if (!nc) notFound();

  const canWrite = canTenantRole(membership?.role, "write", {
    isPlatformSuperuser: ctx.isPlatformSuperuser,
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
            No conformidad
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight">
            {nc.title}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            {labelWorkflowStatus(nc.status as WorkflowStatus)}
            {nc.ownerName ? ` · ${nc.ownerName}` : ""}
            {nc.source ? ` · origen: ${nc.source}` : ""}
          </p>
          {nc.description ? (
            <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
              {nc.description}
            </p>
          ) : null}
        </div>
        <Link
          href={`/t/${slug}/operations`}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
        >
          Volver al listado
        </Link>
      </div>

      {canWrite ? (
        <UpdateNcStatusForm
          slug={slug}
          ncId={nc.id}
          current={nc.status as WorkflowStatus}
        />
      ) : null}

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Acciones correctivas ({nc.actions.length})
        </h2>
        <ul className="mt-3 space-y-3">
          {nc.actions.map((action) => (
            <li
              key={action.id}
              className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{action.title}</p>
                  <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
                    {labelWorkflowStatus(action.status as WorkflowStatus)}
                    {action.ownerName ? ` · ${action.ownerName}` : ""}
                    {action.dueAt
                      ? ` · vence ${action.dueAt.toISOString().slice(0, 10)}`
                      : " · sin vencimiento"}
                  </p>
                  {action.description ? (
                    <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                      {action.description}
                    </p>
                  ) : null}
                </div>
                {canWrite ? (
                  <UpdateActionStatusForm
                    slug={slug}
                    ncId={nc.id}
                    actionId={action.id}
                    current={action.status as WorkflowStatus}
                  />
                ) : null}
              </div>
            </li>
          ))}
          {nc.actions.length === 0 ? (
            <li className="text-sm text-[var(--color-ink-muted)]">
              Sin acciones todavía.
            </li>
          ) : null}
        </ul>
      </section>

      {canWrite ? <CreateActionForm slug={slug} ncId={nc.id} /> : null}
    </div>
  );
}
