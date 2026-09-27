import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import { loadRisksWorkspace } from "@/lib/risks-workspace";
import { WORKSPACE_STAGES } from "@/domain/risks/guide";
import { RISK_STATUS_LABELS, RISK_STATUS_TONE } from "@/domain/risks/types";
import {
  OPPORTUNITY_STATUS_LABELS,
  OPPORTUNITY_STATUS_TONE,
} from "@/domain/opportunities/types";
import type { RiskStatus } from "@/domain/risks/types";
import type { OpportunityStatus } from "@/domain/opportunities/types";

type Params = Promise<{ slug: string }>;

export default async function RisksWorkspacePage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
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

  const ws = await loadRisksWorkspace(tenant.id);

  const [discovery, decisions, execution, learning] = WORKSPACE_STAGES;
  const btn = "rounded-md border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-4 py-2 text-sm font-medium hover:border-[var(--color-accent)]";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--color-ink-muted)]">ISO 9001 · §6.1</p>
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
              Riesgos y oportunidades
            </h1>
          </div>
          <Link
            href={`/t/${slug}/risks/guia`}
            className="text-sm font-medium text-[var(--color-accent)] hover:underline"
          >
            Guía para identificar →
          </Link>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/t/${slug}/risks/explore`}
              title="Partí de un proceso, proveedor o cambio y anotá lo que surja"
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Explorar una fuente
            </Link>
            <Link href={`/t/${slug}/risks/new?tipo=riesgo`} className={btn}>
              + Riesgo
            </Link>
            <Link href={`/t/${slug}/risks/new?tipo=oportunidad`} className={btn}>
              + Oportunidad
            </Link>
          </div>
        ) : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Riesgos abiertos" value={ws.counts.risksOpen} />
        <Stat
          label="Oportunidades abiertas"
          value={ws.counts.opportunitiesOpen}
        />
        <Stat label="Acciones en curso" value={ws.counts.openActions} />
      </div>

      <WorkspaceLayer stage={discovery}>
        <ItemList
          slug={slug}
          empty={discovery.empty}
          risks={ws.discovery.risks}
          opportunities={ws.discovery.opportunities}
        />
      </WorkspaceLayer>

      <WorkspaceLayer stage={decisions}>
        <ItemList
          slug={slug}
          empty={decisions.empty}
          risks={ws.decisions.risks}
          opportunities={ws.decisions.opportunities}
        />
      </WorkspaceLayer>

      <WorkspaceLayer stage={execution}>
        <ItemList
          slug={slug}
          empty={execution.empty}
          risks={ws.execution.risks}
          opportunities={ws.execution.opportunities}
        />
        {ws.execution.openActions.length > 0 ? (
          <div className="mt-1">
            <h3 className="text-sm font-medium">Acciones abiertas</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {ws.execution.openActions.map((a) => (
                <li key={a.id} className="text-[var(--color-ink-muted)]">
                  {a.title}
                  {a.dueAt
                    ? ` · vence ${a.dueAt.toLocaleDateString("es-AR")}`
                    : " · sin fecha"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </WorkspaceLayer>

      <WorkspaceLayer stage={learning}>
        {ws.learning.actionsNeedingEffectiveness.length > 0 ? (
          <div className="mb-3">
            <h3 className="text-sm font-medium">Acciones completadas para verificar eficacia</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {ws.learning.actionsNeedingEffectiveness.map((a) => (
                <li key={a.id}>{a.title}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <ItemList
          slug={slug}
          empty={
            ws.learning.actionsNeedingEffectiveness.length > 0
              ? "No hay registros con revisión vencida."
              : learning.empty
          }
          risks={ws.learning.staleRisks}
          opportunities={ws.learning.staleOpportunities}
        />
      </WorkspaceLayer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--color-line)] px-4 py-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-[var(--color-ink-muted)]">{label}</div>
    </div>
  );
}

function WorkspaceLayer({
  stage,
  children,
}: {
  stage: (typeof WORKSPACE_STAGES)[number];
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          {stage.title}
        </h2>
        <p className="text-sm text-[var(--color-ink-muted)]">{stage.what}</p>
        <p className="mt-1 text-sm">
          <span className="font-medium">Qué hacer:</span> {stage.next}
        </p>
      </div>
      {children}
    </section>
  );
}

function ItemList({
  slug,
  empty,
  risks,
  opportunities,
}: {
  slug: string;
  empty: string;
  risks: { id: string; title: string; status: string; sourceLabel: string }[];
  opportunities: {
    id: string;
    title: string;
    status: string;
    sourceLabel: string;
  }[];
}) {
  if (risks.length === 0 && opportunities.length === 0) {
    return <p className="text-sm text-[var(--color-ink-muted)]">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-[var(--color-line)] rounded-md border border-[var(--color-line)]">
      {risks.map((r) => {
        const status = r.status as RiskStatus;
        const tone = RISK_STATUS_TONE[status];
        return (
          <li key={`r-${r.id}`}>
            <Link
              href={`/t/${slug}/risks/${r.id}`}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-[var(--color-surface)]"
            >
              <div>
                <span className="mr-2 text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                  Riesgo
                </span>
                <span className="font-medium">{r.title}</span>
                {r.sourceLabel ? (
                  <span className="ml-2 text-sm text-[var(--color-ink-muted)]">
                    · {r.sourceLabel}
                  </span>
                ) : null}
              </div>
              <span
                className="rounded px-2 py-0.5 text-xs font-semibold"
                style={{ background: tone.bg, color: tone.fg }}
              >
                {RISK_STATUS_LABELS[status]}
              </span>
            </Link>
          </li>
        );
      })}
      {opportunities.map((o) => {
        const status = o.status as OpportunityStatus;
        const tone = OPPORTUNITY_STATUS_TONE[status];
        return (
          <li key={`o-${o.id}`}>
            <Link
              href={`/t/${slug}/risks/opportunities/${o.id}`}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-[var(--color-surface)]"
            >
              <div>
                <span className="mr-2 text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                  Oportunidad
                </span>
                <span className="font-medium">{o.title}</span>
                {o.sourceLabel ? (
                  <span className="ml-2 text-sm text-[var(--color-ink-muted)]">
                    · {o.sourceLabel}
                  </span>
                ) : null}
              </div>
              <span
                className="rounded px-2 py-0.5 text-xs font-semibold"
                style={{ background: tone.bg, color: tone.fg }}
              >
                {OPPORTUNITY_STATUS_LABELS[status]}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
