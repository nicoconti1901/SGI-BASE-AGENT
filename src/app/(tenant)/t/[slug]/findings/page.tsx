import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import { listFindings } from "@/lib/findings";
import {
  FINDING_STATUS_LABELS,
  FINDING_TYPE_LABELS,
  type FindingStatus,
  type FindingType,
} from "@/domain/findings/types";
import { StartFindingForm } from "@/app/(tenant)/t/[slug]/findings/StartFindingForm";

type Params = Promise<{ slug: string }>;

export default async function FindingsListPage({
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
  const findings = await listFindings(tenant.id);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
            {tenant.name}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Hallazgos
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Entrada unificada: NC, observación, incidente u oportunidad. Causa
            raíz obligatoria vía 5 Porqués.
          </p>
        </div>
        <Link
          href={`/t/${slug}`}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
        >
          Volver al portal
        </Link>
      </div>

      {canWrite ? <StartFindingForm slug={slug} /> : null}

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Bandeja ({findings.length})
        </h2>
        <ul className="mt-3 space-y-3">
          {findings.map((finding) => (
            <li
              key={finding.id}
              className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-4 py-4"
            >
              <Link
                href={
                  finding.status === "draft"
                    ? `/t/${slug}/findings/${finding.id}/edit`
                    : `/t/${slug}/findings/${finding.id}`
                }
                className="font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
              >
                {finding.title}
              </Link>
              <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
                {FINDING_TYPE_LABELS[finding.type as FindingType]} ·{" "}
                {FINDING_STATUS_LABELS[finding.status as FindingStatus]}
                {finding.rootCause ? ` · ★ ${finding.rootCause}` : ""}
                {" · "}
                {finding._count.measures} medidas
              </p>
            </li>
          ))}
          {findings.length === 0 ? (
            <li className="text-sm text-[var(--color-ink-muted)]">
              Todavía no hay hallazgos.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
