import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { listTenantMemberOptions } from "@/lib/findings";
import { canTenantRole } from "@/domain/identity/authz";
import { loadRiskRegister, type RegisterRow } from "@/lib/risks-workspace";
import { RISK_STATUSES, RISK_STATUS_LABELS, RISK_STATUS_TONE, type RiskStatus } from "@/domain/risks/types";
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUS_LABELS,
  OPPORTUNITY_STATUS_TONE,
  type OpportunityStatus,
} from "@/domain/opportunities/types";
import {
  PageFrame,
  PageHeader,
  StatGrid,
  StatTile,
  StatusChip,
  EmptyState,
  SectionBlock,
  RecordList,
  buttonClass,
  type RecordItem,
} from "@/components/ui";

type Params = Promise<{ slug: string }>;

function formatDay(d: Date): string {
  return d.toLocaleDateString("es-AR");
}

/** Primero lo que tiene la revisión vencida; después en el orden del ciclo de vida. */
function byAttention(order: readonly string[]) {
  return (a: RegisterRow, b: RegisterRow) =>
    Number(b.stale) - Number(a.stale) || order.indexOf(a.status) - order.indexOf(b.status);
}

export default async function RisksRegisterPage({ params }: { params: Params }) {
  const { slug } = await params;
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");

  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const membership = await getMembership(ctx.userId, tenant.id);
  const opts = { isPlatformSuperuser: ctx.isPlatformSuperuser };
  if (!canTenantRole(membership?.role, "read", opts)) redirect("/portal");
  const canWrite = canTenantRole(membership?.role, "write", opts);

  const [register, members] = await Promise.all([loadRiskRegister(tenant.id), listTenantMemberOptions(tenant.id)]);
  const nameOf = (id: string | null) => (id ? (members.find((m) => m.id === id)?.name ?? "Sin asignar") : "—");

  function toItem(row: RegisterRow, kind: "risk" | "opportunity"): RecordItem {
    const chip =
      kind === "risk" ? (
        <StatusChip label={RISK_STATUS_LABELS[row.status as RiskStatus]} tone={RISK_STATUS_TONE[row.status as RiskStatus]} />
      ) : (
        <StatusChip
          label={OPPORTUNITY_STATUS_LABELS[row.status as OpportunityStatus]}
          tone={OPPORTUNITY_STATUS_TONE[row.status as OpportunityStatus]}
        />
      );
    return {
      id: row.id,
      href: kind === "risk" ? `/t/${slug}/risks/${row.id}` : `/t/${slug}/risks/opportunities/${row.id}`,
      kind: kind === "risk" ? "Riesgo" : "Oportunidad",
      title: row.title,
      summary: row.summary || (row.sourceLabel ? `Origen: ${row.sourceLabel}` : undefined),
      chip,
      facts: row.closed
        ? []
        : [
            { label: kind === "risk" ? "Nivel" : "Valor", value: row.level ?? "Sin evaluar", tone: row.level ? undefined : "warning" },
            { label: "Próximo paso", value: row.nextStep },
            { label: "Responsable de avanzar", value: nameOf(row.responsibleUserId) },
            {
              label: "Próxima revisión",
              value: row.nextReviewAt ? `${formatDay(row.nextReviewAt)}${row.stale ? " · vencida" : ""}` : row.stale ? "Vencida" : "Sin fecha",
              tone: row.stale ? "danger" : undefined,
            },
          ],
    };
  }

  const openRisks = register.risks.filter((r) => !r.closed).sort(byAttention(RISK_STATUSES));
  const openOpps = register.opportunities.filter((o) => !o.closed).sort(byAttention(OPPORTUNITY_STATUSES));
  const closedItems = [
    ...register.risks.filter((r) => r.closed).map((r) => toItem(r, "risk")),
    ...register.opportunities.filter((o) => o.closed).map((o) => toItem(o, "opportunity")),
  ];

  return (
    <PageFrame>
      <PageHeader
        eyebrow="ISO 9001 · §6.1"
        title="Riesgos y oportunidades"
        purpose="Cada registro muestra su nivel, en qué etapa está, el próximo paso y quién lo tiene que dar."
        guideHref={`/t/${slug}/risks/guia`}
        guideLabel="Guía para identificar →"
        actions={
          canWrite ? (
            <>
              <Link href={`/t/${slug}/risks/new`} className={buttonClass("primary")}>
                Registrar riesgo
              </Link>
              <Link href={`/t/${slug}/risks/opportunities/new`} className={buttonClass("secondary")}>
                Registrar oportunidad
              </Link>
            </>
          ) : undefined
        }
      />

      <StatGrid cols={4} aria-label="Resumen de riesgos y oportunidades">
        <StatTile label="Riesgos abiertos" value={register.counts.risksOpen} />
        <StatTile label="Oportunidades abiertas" value={register.counts.opportunitiesOpen} />
        <StatTile label="Acciones en curso" value={register.counts.openActions} />
        <StatTile label="Con revisión vencida" value={register.counts.stale} />
      </StatGrid>

      <SectionBlock
        title="Riesgos"
        what="Lo que podría salir mal y afectar a un proceso, al cliente o a un requisito."
        next="Abrí cada uno para dar el próximo paso que indica su tarjeta."
      >
        {openRisks.length === 0 ? (
          <EmptyState
            what="No hay riesgos abiertos."
            next={canWrite ? "Registrá el primero: qué podría pasar, por qué y con qué efecto." : undefined}
            action={canWrite ? { href: `/t/${slug}/risks/new`, label: "Registrar riesgo" } : undefined}
          />
        ) : (
          <RecordList aria-label="Riesgos abiertos" items={openRisks.map((r) => toItem(r, "risk"))} />
        )}
      </SectionBlock>

      <SectionBlock
        title="Oportunidades"
        what="Lo favorable que se podría aprovechar para mejorar."
        next="Abrí cada una para evaluarla, decidir si se persigue y cargar sus acciones."
      >
        {openOpps.length === 0 ? (
          <EmptyState
            what="No hay oportunidades abiertas."
            next={canWrite ? "Registrá una: qué situación favorable aparece y qué beneficio traería." : undefined}
            action={canWrite ? { href: `/t/${slug}/risks/opportunities/new`, label: "Registrar oportunidad" } : undefined}
          />
        ) : (
          <RecordList aria-label="Oportunidades abiertas" items={openOpps.map((o) => toItem(o, "opportunity"))} />
        )}
      </SectionBlock>

      {register.openActions.length > 0 || register.actionsNeedingEffectiveness.length > 0 ? (
        <SectionBlock title="Acciones" what="Las acciones de todos los riesgos y oportunidades.">
          {register.openActions.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold">En curso</h3>
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {register.openActions.map((a) => (
                  <li key={a.id} className="text-[var(--color-ink-muted)]">
                    <span className="font-medium text-[var(--color-ink)]">{a.title}</span> · {nameOf(a.ownerUserId)} ·{" "}
                    {a.dueAt ? `fecha límite ${formatDay(a.dueAt)}` : "sin fecha límite"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {register.actionsNeedingEffectiveness.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold">Completadas, falta evaluar su eficacia</h3>
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {register.actionsNeedingEffectiveness.map((a) => (
                  <li key={a.id}>{a.title}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </SectionBlock>
      ) : null}

      {closedItems.length > 0 ? (
        <details className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5">
          <summary className="cursor-pointer font-[family-name:var(--font-display)] text-lg">
            Cerrados y realizados ({closedItems.length})
          </summary>
          <div className="mt-4">
            <RecordList aria-label="Cerrados y realizados" items={closedItems} />
          </div>
        </details>
      ) : null}
    </PageFrame>
  );
}
