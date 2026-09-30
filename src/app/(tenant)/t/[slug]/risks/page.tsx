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
import {
  PageFrame,
  PageHeader,
  StatGrid,
  StatTile,
  StatusChip,
  EmptyState,
  SectionBlock,
  EntityList,
  EntityRow,
} from "@/components/ui";

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
  const btn =
    "rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-4 py-2 text-sm font-medium hover:border-[var(--color-accent)]";

  return (
    <PageFrame>
      <PageHeader
        eyebrow="ISO 9001 · §6.1"
        title="Riesgos y oportunidades"
        guideHref={`/t/${slug}/risks/guia`}
        guideLabel="Guía para identificar →"
        actions={
          canWrite ? (
            <>
              <Link
                href={`/t/${slug}/risks/explore`}
                title="Partí de un proceso, proveedor o cambio y anotá lo que surja"
                className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-on-solid)]"
              >
                Explorar una fuente
              </Link>
              <Link href={`/t/${slug}/risks/new?tipo=riesgo`} className={btn}>
                + Riesgo
              </Link>
              <Link
                href={`/t/${slug}/risks/new?tipo=oportunidad`}
                className={btn}
              >
                + Oportunidad
              </Link>
            </>
          ) : undefined
        }
      />

      <StatGrid cols={3} aria-label="Resumen de riesgos y oportunidades">
        <StatTile label="Riesgos abiertos" value={ws.counts.risksOpen} />
        <StatTile
          label="Oportunidades abiertas"
          value={ws.counts.opportunitiesOpen}
        />
        <StatTile label="Acciones en curso" value={ws.counts.openActions} />
      </StatGrid>

      <SectionBlock
        title={discovery.title}
        what={discovery.what}
        next={discovery.next}
      >
        <ItemList
          slug={slug}
          empty={discovery.empty}
          risks={ws.discovery.risks}
          opportunities={ws.discovery.opportunities}
        />
      </SectionBlock>

      <SectionBlock
        title={decisions.title}
        what={decisions.what}
        next={decisions.next}
      >
        <ItemList
          slug={slug}
          empty={decisions.empty}
          risks={ws.decisions.risks}
          opportunities={ws.decisions.opportunities}
        />
      </SectionBlock>

      <SectionBlock
        title={execution.title}
        what={execution.what}
        next={execution.next}
      >
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
      </SectionBlock>

      <SectionBlock
        title={learning.title}
        what={learning.what}
        next={learning.next}
      >
        {ws.learning.actionsNeedingEffectiveness.length > 0 ? (
          <div className="mb-3">
            <h3 className="text-sm font-medium">
              Acciones completadas para verificar eficacia
            </h3>
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
      </SectionBlock>
    </PageFrame>
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
    return <EmptyState what={empty} />;
  }
  return (
    <EntityList>
      {risks.map((r) => {
        const status = r.status as RiskStatus;
        const tone = RISK_STATUS_TONE[status];
        return (
          <EntityRow
            key={`r-${r.id}`}
            href={`/t/${slug}/risks/${r.id}`}
            kind="Riesgo"
            title={r.title}
            meta={r.sourceLabel || undefined}
            chip={
              <StatusChip label={RISK_STATUS_LABELS[status]} tone={tone} />
            }
          />
        );
      })}
      {opportunities.map((o) => {
        const status = o.status as OpportunityStatus;
        const tone = OPPORTUNITY_STATUS_TONE[status];
        return (
          <EntityRow
            key={`o-${o.id}`}
            href={`/t/${slug}/risks/opportunities/${o.id}`}
            kind="Oportunidad"
            title={o.title}
            meta={o.sourceLabel || undefined}
            chip={
              <StatusChip
                label={OPPORTUNITY_STATUS_LABELS[status]}
                tone={tone}
              />
            }
          />
        );
      })}
    </EntityList>
  );
}