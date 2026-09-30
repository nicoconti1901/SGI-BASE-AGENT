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
  StatGrid,
  StatTile,
  StatusChip,
  EmptyState,
  SectionBlock,
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

const DUE_TONE_CHIP: Record<DueTone, string> = {
  overdue: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  soon: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  ok: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
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
      <PageHeader
        eyebrow={`${tenant.name} · ISO 9001 · 14001 · 45001`}
        title={`Hola, ${firstName}`}
        purpose="Estado del sistema de gestión: cuánto de lo exigido ya cumplen y qué vence primero."
      />

      <StatGrid cols={4} aria-label="Resumen">
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
      </StatGrid>

      <SectionBlock title="Cumplimiento de requisitos">
        {compliance.total === 0 ? (
          <EmptyState
            what="Todavía no hay requisitos ISO asignados a la empresa."
            next="Pedile al administrador de plataforma que cargue el relevamiento inicial (gap)."
          />
        ) : (
          <>
            <p className="text-sm text-[var(--color-ink-muted)]">
              {compliance.total} requisitos en seguimiento.{" "}
              <span className="font-medium text-[var(--color-ink)]">Qué hacer:</span> atendé
              primero los faltantes y los parciales.
            </p>
            <div
              className="mt-1 flex h-3 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-line)]"
              role="img"
              aria-label={`Distribución de ${compliance.total} requisitos por estado`}
            >
              {COMPLIANCE_SEGMENTS.filter((s) => compliance.byStatus[s.status] > 0).map((s) => (
                <span
                  key={s.status}
                  style={{
                    width: `${(compliance.byStatus[s.status] / compliance.total) * 100}%`,
                    background: s.color,
                  }}
                />
              ))}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {COMPLIANCE_SEGMENTS.map((s) => (
                <li key={s.status} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-[2px]"
                    style={{ background: s.color }}
                  />
                  <span className="text-[var(--color-ink-muted)]">{GAP_STATUS_LABELS[s.status]}</span>
                  <span className="font-semibold tabular-nums">{compliance.byStatus[s.status]}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </SectionBlock>

      <SectionBlock title="Próximos vencimientos">
        <p className="-mt-1">
          <Link
            href={`${base}/automations`}
            className="text-sm font-medium text-[var(--color-accent)] hover:underline"
          >
            Ver todos ({dueCounts.open}) →
          </Link>
        </p>
        {dueItems.length === 0 ? (
          <EmptyState
            what="No hay vencimientos abiertos."
            next="Se generan solos al fijar fechas en hallazgos, acciones, riesgos, auditorías e indicadores."
          />
        ) : (
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)]">
            {dueItems.map((item) => {
              const content = (
                <>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
                      {item.typeLabel}
                    </span>
                    <span className="block truncate text-sm font-medium">{item.title}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <time
                      dateTime={item.dueAt.toISOString()}
                      className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]"
                    >
                      {item.dueAt.toISOString().slice(0, 10)}
                    </time>
                    <StatusChip
                      label={dueChipText(item.tone, item.daysLeft)}
                      className={DUE_TONE_CHIP[item.tone]}
                    />
                  </span>
                </>
              );
              const rowClass = "flex items-center justify-between gap-4 px-4 py-3";
              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={`${rowClass} transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-[var(--color-accent-soft)]`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className={rowClass}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionBlock>

      <SectionBlock title="Accesos">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4 transition duration-[var(--duration-med)] ease-[var(--ease-out)] hover:border-[var(--color-accent)]"
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
