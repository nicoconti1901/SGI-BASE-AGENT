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
import type { RiskResponseDecision, RiskStatus } from "@/domain/risks/types";
import { riskProgress, type StageKey, type StageState } from "@/domain/risks/progress";
import { RiskDetailForms } from "@/app/(tenant)/t/[slug]/risks/RiskDetailForms";
import { LinkedActionsPanel } from "@/app/(tenant)/t/[slug]/risks/LinkedActionsPanel";
import { RecordStatusPanel } from "@/app/(tenant)/t/[slug]/risks/RecordStatus";
import { StatusControls } from "@/app/(tenant)/t/[slug]/risks/RecordParts";

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
  const status = risk.status as RiskStatus;
  const progress = riskProgress({
    status,
    statementComplete: Boolean(risk.cause.trim() && risk.event.trim() && risk.effect.trim()),
    assessments: risk.assessments.length,
    decision: risk.responseDecision as RiskResponseDecision | null,
    actions,
  });
  const stageStates = Object.fromEntries(progress.stages.map((s) => [s.key, s.state])) as Record<StageKey, StageState>;
  const nameOf = (id: string | null | undefined) => members.find((m) => m.id === id)?.name;
  const responsible =
    progress.who === "owner"
      ? { name: nameOf(risk.responseOwnerUserId) ?? "Sin asignar", role: "Responsable de la respuesta" }
      : progress.who === "creator"
        ? { name: nameOf(risk.createdByUserId) ?? "Quien lo registró", role: "Lo registró: evalúa y decide la respuesta" }
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
          ISO 9001 · §6.1 · Riesgo
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

      <RecordStatusPanel
        statusLabel={RISK_STATUS_LABELS[status]}
        stages={progress.stages}
        nextStep={progress.nextStep}
        responsible={responsible}
        missing={progress.missing}
      >
        {canWrite && status !== "closed" ? (
          <StatusControls slug={slug} kind="risk" id={risk.id} advance={progress.advance} canClose />
        ) : null}
      </RecordStatusPanel>

      <RiskDetailForms
        slug={slug}
        risk={{ ...risk, status }}
        members={members}
        canWrite={canWrite}
        stages={stageStates}
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
