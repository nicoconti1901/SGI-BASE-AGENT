import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import { loadRisksWorkspace } from "@/lib/risks-workspace";
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

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-ink-muted)]">
            ISO 9001 · Riesgos y oportunidades
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Workspace
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--color-ink-muted)]">
            Discovery · Decisions · Execution · Learning — no una matriz como
            pantalla principal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <Link
              href={`/t/${slug}/risks/explore`}
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Explorar contexto
            </Link>
          ) : null}
          {canWrite ? (
            <Link
              href={`/t/${slug}/risks/explore?direct=risk`}
              className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm"
            >
              Alta directa (atajo)
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Riesgos abiertos" value={ws.counts.risksOpen} />
        <Stat
          label="Oportunidades abiertas"
          value={ws.counts.opportunitiesOpen}
        />
        <Stat label="Acciones en curso" value={ws.counts.openActions} />
      </div>

      <WorkspaceLayer
        title="1 · Discovery"
        subtitle="Fuentes y análisis en curso"
      >
        <ItemList
          slug={slug}
          empty="Nada pendiente de descubrir."
          risks={ws.discovery.risks}
          opportunities={ws.discovery.opportunities}
        />
      </WorkspaceLayer>

      <WorkspaceLayer
        title="2 · Decisions"
        subtitle="Qué falta evaluar o decidir"
      >
        <ItemList
          slug={slug}
          empty="Sin decisiones pendientes."
          risks={ws.decisions.risks}
          opportunities={ws.decisions.opportunities}
        />
      </WorkspaceLayer>

      <WorkspaceLayer
        title="3 · Execution"
        subtitle="Respuestas y acciones en curso"
      >
        <ItemList
          slug={slug}
          empty="Sin ejecución activa."
          risks={ws.execution.risks}
          opportunities={ws.execution.opportunities}
        />
        {ws.execution.openActions.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm">
            {ws.execution.openActions.map((a) => (
              <li key={a.id} className="text-[var(--color-ink-muted)]">
                Acción: {a.title}
                {a.dueAt
                  ? ` · vence ${a.dueAt.toLocaleDateString("es-AR")}`
                  : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </WorkspaceLayer>

      <WorkspaceLayer
        title="4 · Learning"
        subtitle="Efectividad, stale y revisiones"
      >
        {ws.learning.actionsNeedingEffectiveness.length > 0 ? (
          <div className="mb-3">
            <h3 className="text-sm font-medium">Efectividad pendiente</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {ws.learning.actionsNeedingEffectiveness.map((a) => (
                <li key={a.id}>{a.title}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <ItemList
          slug={slug}
          empty="Sin señales de revisión / stale."
          risks={ws.learning.staleRisks}
          opportunities={ws.learning.staleOpportunities}
        />
      </WorkspaceLayer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] px-4 py-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-[var(--color-ink-muted)]">{label}</div>
    </div>
  );
}

function WorkspaceLayer({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          {title}
        </h2>
        <p className="text-sm text-[var(--color-ink-muted)]">{subtitle}</p>
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
    <ul className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
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
