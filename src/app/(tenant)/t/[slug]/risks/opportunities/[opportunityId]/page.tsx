import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import {
  getOpportunity,
  opportunityHealthSignals,
} from "@/lib/opportunities";
import { listTenantMemberOptions } from "@/lib/findings";
import { listActionsForTarget } from "@/lib/actions";
import {
  OPPORTUNITY_STATUS_LABELS,
  type OpportunityStatus,
} from "@/domain/opportunities/types";
import { SOURCE_KIND_LABELS } from "@/domain/risks/types";
import { OpportunityDetailForms } from "@/app/(tenant)/t/[slug]/risks/OpportunityDetailForms";
import { LinkedActionsPanel } from "@/app/(tenant)/t/[slug]/risks/LinkedActionsPanel";

type Params = Promise<{ slug: string; opportunityId: string }>;

export default async function OpportunityDetailPage({
  params,
}: {
  params: Params;
}) {
  const { slug, opportunityId } = await params;
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

  const opportunity = await getOpportunity(tenant.id, opportunityId);
  if (!opportunity) notFound();

  const [members, actions, health] = await Promise.all([
    listTenantMemberOptions(tenant.id),
    listActionsForTarget(tenant.id, "opportunity", opportunity.id),
    opportunityHealthSignals(tenant.id, opportunity.id),
  ]);

  const returnPath = `/t/${slug}/risks/opportunities/${opportunity.id}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
      <div>
        <Link
          href={`/t/${slug}/risks`}
          className="text-sm text-[var(--color-accent)]"
        >
          ← Workspace
        </Link>
        <p className="mt-2 text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
          Oportunidad ·{" "}
          {
            OPPORTUNITY_STATUS_LABELS[
              opportunity.status as OpportunityStatus
            ]
          }
          {health?.stale ? " · STALE" : ""}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          {opportunity.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Fuente: {SOURCE_KIND_LABELS[opportunity.sourceKind]} —{" "}
          {opportunity.sourceLabel}
          {opportunity.finding ? (
            <>
              {" "}
              · Hallazgo:{" "}
              <Link
                href={`/t/${slug}/findings/${opportunity.finding.id}`}
                className="text-[var(--color-accent)] underline"
              >
                {opportunity.finding.title}
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <OpportunityDetailForms
        slug={slug}
        opportunity={{
          ...opportunity,
          status: opportunity.status as OpportunityStatus,
        }}
        members={members}
        canWrite={canWrite}
      />

      <LinkedActionsPanel
        slug={slug}
        targetType="opportunity"
        targetId={opportunity.id}
        returnPath={returnPath}
        members={members}
        actions={actions}
        canWrite={canWrite}
      />
    </div>
  );
}
