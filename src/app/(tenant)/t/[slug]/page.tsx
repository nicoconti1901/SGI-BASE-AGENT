import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getAppSessionContext } from "@/lib/session";
import { getMembership } from "@/lib/identity";
import { getTenantDashboard } from "@/lib/dashboard";
import { canTenantRole } from "@/domain/identity/authz";
import { GAP_STATUS_LABELS, type RequirementStatus } from "@/domain/assessment/gap";
import type { DueTone } from "@/domain/dashboard/summary";
import {
  PageFrame,
  PageHeader,
  StatTile,
  StatusChip,
  EmptyState,
  SectionBlock,
  DashboardStrip,
  StripExtra,
  StripKpis,
  DueRail,
  DueCard,
  type ChipStatus,
} from "@/components/ui";

type Params = Promise<{ slug: string }>;

/** Orden y color de cada estado en la barra de cumplimiento; la leyenda repite el texto. */
const COMPLIANCE_SEGMENTS: { status: RequirementStatus; color: string }[] = [
  { status: "compliant", color: "var(--color-success)" },
  { status: "automated", color: "var(--color-accent)" },
  { status: "partial", color: "var(--color-warning)" },
  { status: "missing", color: "var(--color-danger)" },
  { status: "pending", color: "var(--color-ink-subtle)" },
  { status: "not_applicable", color: "var(--color-line-strong)" },
];

/** "Pendiente" se distingue por patrón (rayado) además de color. */
function segmentBackground(status: RequirementStatus, color: string): string {
  return status === "pending"
    ? `repeating-linear-gradient(135deg, ${color} 0 3px, transparent 3px 6px)`
    : color;
}

const DUE_TONE_STATUS: Record<DueTone, ChipStatus> = {
  overdue: "overdue",
  soon: "warning",
  ok: "ok",
};

function dueChipText(tone: DueTone, daysLeft: number): string {
  if (tone === "overdue") {
    const d = Math.abs(daysLeft);
    return d === 0 ? "Venció hoy" : `Vencido hace ${d} d`;
  }
  return daysLeft === 0 ? "Vence hoy" : `En ${daysLeft} d`;
}

export default async function TenantPortalBySlugPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    notFound();
  }

  // El layout ya verificó el acceso; acá solo se decide qué ofrecer.
  const ctx = await getAppSessionContext();
  if (!ctx) {
    redirect("/login");
  }

  const membership = await getMembership(ctx.userId, tenant.id);
  const opts = { isPlatformSuperuser: ctx.isPlatformSuperuser };
  const canWrite = canTenantRole(membership?.role, "write", opts);
  const canInvite = canTenantRole(membership?.role, "invite_users", opts);
  const firstName = ctx.name.split(" ")[0] || ctx.name;

  const { compliance, dueItems, dueCounts } = await getTenantDashboard(
    tenant.id,
    new Date(),
    slug,
  );

  const base = `/t/${slug}`;
  const modules = [
    {
      href: `${base}/findings`,
      title: "Hallazgos y no conformidades",
      body: canWrite ? "Registrá y seguí hallazgos y acciones." : "Consultá hallazgos y acciones.",
    },
    {
      href: `${base}/risks`,
      title: "Riesgos y oportunidades",
      body: canWrite ? "Detectá, evaluá y tratá riesgos." : "Consultá riesgos y su tratamiento.",
    },
    {
      href: `${base}/audits`,
      title: "Auditorías",
      body: "Programa del año, planes y resultados de auditoría.",
    },
    {
      href: `${base}/indicators`,
      title: "Objetivos e indicadores",
      body: canWrite ? "Cargá mediciones y analizá desvíos." : "Consultá metas y tendencias.",
    },
    {
      href: `${base}/documents`,
      title: "Documentos",
      body: "Procedimientos y registros vigentes.",
    },
    {
      href: `${base}/automations`,
      title: "Automatizaciones",
      body: "Vencimientos y avisos programados.",
    },
    {
      href: `${base}/users`,
      title: "Usuarios",
      body: canInvite ? "Sumá personas y asigná roles." : "Quiénes forman parte de la empresa.",
    },
  ];

  return (
    <PageFrame>
      <DashboardStrip aria-label="Panel de control">
        <div className="flex flex-col lg:flex-row">
          <div className="min-w-0 lg:flex-1">
            <StripKpis aria-label="Resumen">
              <StatTile
                label="Cumplimiento"
                value={compliance.percent === null ? "—" : `${compliance.percent}%`}
              />
              <StatTile
                label="Requisitos conformes"
                value={`${compliance.conforming} de ${compliance.applicable}`}
              />
              <StatTile
                label="Vencidos"
                value={String(dueCounts.overdue)}
                tone={dueCounts.overdue > 0 ? "danger" : "default"}
              />
              <StatTile
                label="Próximos a vencer"
                value={String(dueCounts.soon)}
                tone={dueCounts.soon > 0 ? "warning" : "default"}
              />
            </StripKpis>
          </div>
          <StripExtra className="border-t border-[var(--color-line)] px-4 py-3 lg:w-80 lg:shrink-0 lg:border-l lg:border-t-0">
            <h2 className="font-[family-name:var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
              Cumplimiento de requisitos
            </h2>
            {compliance.total === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                Todavía no hay requisitos ISO asignados.{" "}
                <span className="font-medium text-[var(--color-ink)]">Qué hacer:</span> pedile al
                administrador de plataforma que cargue el relevamiento inicial (gap).
              </p>
            ) : (
              <>
                <div
                  className="mt-2 flex h-2 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)]"
                  role="img"
                  aria-label={`Distribución de ${compliance.total} requisitos por estado`}
                >
                  {COMPLIANCE_SEGMENTS.filter((seg) => compliance.byStatus[seg.status] > 0).map((seg) => (
                    <span
                      key={seg.status}
                      style={{
                        width: `${(compliance.byStatus[seg.status] / compliance.total) * 100}%`,
                        background: segmentBackground(seg.status, seg.color),
                      }}
                    />
                  ))}
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {COMPLIANCE_SEGMENTS.map((seg) => (
                    <li key={seg.status} className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-[2px]"
                        style={{ background: segmentBackground(seg.status, seg.color) }}
                      />
                      <span className="text-[var(--color-ink-muted)]">{GAP_STATUS_LABELS[seg.status]}</span>
                      <span className="font-semibold tabular-nums">{compliance.byStatus[seg.status]}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </StripExtra>
        </div>
        <StripExtra>
          {dueItems.length === 0 ? (
            <div className="border-t border-[var(--color-line)] p-4">
              <EmptyState
                what="No hay vencimientos abiertos."
                next="Se generan solos al fijar fechas en hallazgos, acciones, riesgos, auditorías e indicadores."
              />
            </div>
          ) : (
            <DueRail
              action={
                <Link
                  href={`${base}/automations`}
                  className="text-sm font-medium text-[var(--color-accent)] hover:underline"
                >
                  Ver todos ({dueCounts.open}) →
                </Link>
              }
            >
              {dueItems.map((item) => (
                <DueCard
                  key={item.id}
                  date={item.dueAt.toISOString().slice(0, 10)}
                  kind={item.typeLabel}
                  title={item.title}
                  href={item.href}
                  chip={
                    <StatusChip
                      status={DUE_TONE_STATUS[item.tone]}
                      label={dueChipText(item.tone, item.daysLeft)}
                    />
                  }
                />
              ))}
            </DueRail>
          )}
        </StripExtra>
      </DashboardStrip>

      <PageHeader
        eyebrow={`${tenant.name} · ISO 9001 · 14001 · 45001`}
        title={`Hola, ${firstName}`}
        purpose="Estado del sistema de gestión: cuánto de lo exigido ya cumplen y qué vence primero."
      />

      <SectionBlock title="Accesos">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4 transition-[border-color,transform] duration-[var(--duration-med)] ease-[var(--ease-out)] hover:border-[var(--color-accent)] motion-safe:hover:-translate-y-0.5"
            >
              <h3 className="text-sm font-semibold">{m.title}</h3>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{m.body}</p>
            </Link>
          ))}
        </div>
      </SectionBlock>
    </PageFrame>
  );
}
