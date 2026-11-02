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
import { RecordStatusPanel } from "@/app/(tenant)/t/[slug]/risks/RecordStatus";
import { StatusControls } from "@/app/(tenant)/t/[slug]/risks/RecordParts";
import { opportunityProgress, type StageKey, type StageState } from "@/domain/risks/progress";

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
  const status = opportunity.status as OpportunityStatus;
  const progress = opportunityProgress({
    status,
    statementComplete: Boolean(
      opportunity.condition.trim() && opportunity.circumstance.trim() && opportunity.benefit.trim(),
    ),
    assessments: opportunity.assessments.length,
    decided: Boolean(opportunity.pursuitDecision),
    actions,
  });
  const stageStates = Object.fromEntries(progress.stages.map((s) => [s.key, s.state])) as Record<StageKey, StageState>;
  const nameOf = (id: string | null | undefined) => members.find((m) => m.id === id)?.name;
  const responsible =
    progress.who === "owner"
      ? { name: nameOf(opportunity.pursuitOwnerUserId) ?? "Sin asignar", role: "Responsable de llevarla adelante" }
      : progress.who === "creator"
        ? { name: nameOf(opportunity.createdByUserId) ?? "Quien la registró", role: "La registró: evalúa y decide" }
        : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <Link
          href={`/t/${slug}/risks`}
          className="text-sm text-[var(--color-accent)]"
        >
          ← Riesgos y oportunidades
        </Link>
        <p className="mt-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
          ISO 9001 · §6.1 · Oportunidad
          {health?.stale ? " · Revisión vencida" : ""}
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

      <RecordStatusPanel
        statusLabel={OPPORTUNITY_STATUS_LABELS[status]}
        stages={progress.stages}
        nextStep={progress.nextStep}
        responsible={responsible}
        missing={progress.missing}
      >
        {canWrite && status !== "closed" ? (
          <StatusControls slug={slug} kind="opportunity" id={opportunity.id} advance={progress.advance} canClose />
        ) : null}
      </RecordStatusPanel>

      <OpportunityDetailForms
        slug={slug}
        opportunity={{ ...opportunity, status }}
        members={members}
        canWrite={canWrite}
        stages={stageStates}
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
