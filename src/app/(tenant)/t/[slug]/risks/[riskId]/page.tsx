import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import { getRisk, riskHealthSignals } from "@/lib/risks";
import { listTenantMemberOptions } from "@/lib/findings";
import { listActionsForTarget } from "@/lib/actions";
import { RISK_STATUS_LABELS, SOURCE_KIND_LABELS } from "@/domain/risks/types";
import type { RiskStatus } from "@/domain/risks/types";
import { RiskDetailForms } from "@/app/(tenant)/t/[slug]/risks/RiskDetailForms";
import { LinkedActionsPanel } from "@/app/(tenant)/t/[slug]/risks/LinkedActionsPanel";

type Params = Promise<{ slug: string; riskId: string }>;

export default async function RiskDetailPage({ params }: { params: Params }) {
  const { slug, riskId } = await params;
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");

  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const membership = await getMembership(ctx.userId, tenant.id);
  if (
    !canTenantRole(membership?.role, "read", {
      isPlatformSuperuser: ctx.isPlatformSuperuser,
    })
  ) {
    redirect("/portal");
  }

  const canWrite = canTenantRole(membership?.role, "write", {
    isPlatformSuperuser: ctx.isPlatformSuperuser,
  });

  const risk = await getRisk(tenant.id, riskId);
  if (!risk) notFound();

  const [members, actions, health] = await Promise.all([
    listTenantMemberOptions(tenant.id),
    listActionsForTarget(tenant.id, "risk", risk.id),
    riskHealthSignals(tenant.id, risk.id),
  ]);

  const returnPath = `/t/${slug}/risks/${risk.id}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
      <div>
        <Link
          href={`/t/${slug}/risks`}
          className="text-sm text-[var(--color-accent)]"
        >
          ← Riesgos y oportunidades
        </Link>
        <p className="mt-2 text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
          Riesgo · {RISK_STATUS_LABELS[risk.status as RiskStatus]}
          {health?.stale ? " · Revisión vencida" : ""}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          {risk.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Fuente: {SOURCE_KIND_LABELS[risk.sourceKind]} — {risk.sourceLabel}
          {risk.finding ? (
            <>
              {" "}
              · Hallazgo:{" "}
              <Link
                href={`/t/${slug}/findings/${risk.finding.id}`}
                className="text-[var(--color-accent)] underline"
              >
                {risk.finding.title}
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <RiskDetailForms
        slug={slug}
        risk={{
          ...risk,
          status: risk.status as RiskStatus,
        }}
        members={members}
        canWrite={canWrite}
      />

      <LinkedActionsPanel
        slug={slug}
        targetType="risk"
        targetId={risk.id}
        returnPath={returnPath}
        members={members}
        actions={actions}
        canWrite={canWrite}
      />
    </div>
  );
}
