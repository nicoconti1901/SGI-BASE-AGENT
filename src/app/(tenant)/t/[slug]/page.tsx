import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getAppSessionContext } from "@/lib/session";
import { getMembership } from "@/lib/identity";
import { getTenantDashboard } from "@/lib/dashboard";
import { getEnabledModulesCached } from "@/lib/modules";
import { canTenantRole } from "@/domain/identity/authz";
import { hubAreas } from "@/domain/modules/hub";
import { PageFrame, PageHeader } from "@/components/ui";
import { HubStage, HubSteps } from "@/components/hub/HubStage";
import { AreaGrid } from "@/components/hub/AreaGrid";
import {
  ComplianceBar,
  DueMiniList,
  TelemetryCounts,
  TelemetryHeading,
  TelemetryPanel,
} from "@/components/hub/Telemetry";

type Params = Promise<{ slug: string }>;

const HOME_DUE_LIST_SIZE = 3;

export default async function TenantPortalBySlugPage({ params }: { params: Params }) {
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
  const canWrite = canTenantRole(membership?.role, "write", {
    isPlatformSuperuser: ctx.isPlatformSuperuser,
  });
  const firstName = ctx.name.split(" ")[0] || ctx.name;

  const [{ compliance, dueItems, dueCounts }, enabled] = await Promise.all([
    getTenantDashboard(tenant.id, new Date(), slug),
    getEnabledModulesCached(tenant.id),
  ]);
  const areas = hubAreas(slug, enabled, canWrite);

  return (
    <PageFrame width="7xl">
      <PageHeader
        eyebrow={`${tenant.name} · ISO 9001 · 14001 · 45001`}
        title={`Hola, ${firstName}`}
        purpose="Elegí un módulo para entrar. Adentro vas a ver sus pantallas, cada una con su nombre."
      />

      <HubStage>
        <HubSteps current={1} />
        <nav aria-label="Principal" className="sgi-hub-areas">
          <AreaGrid areas={areas} />
        </nav>
      </HubStage>

      <TelemetryPanel title="Estado del sistema">
        <div className="grid grid-cols-1 divide-y divide-[var(--color-line)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)] lg:divide-x lg:divide-y-0">
          <TelemetryCounts
            items={[
              {
                label: "Cumplimiento",
                value: compliance.percent === null ? "—" : `${compliance.percent}%`,
              },
              {
                label: "Vencidos",
                value: String(dueCounts.overdue),
                tone: dueCounts.overdue > 0 ? "danger" : undefined,
              },
              {
                label: "Por vencer",
                value: String(dueCounts.soon),
                tone: dueCounts.soon > 0 ? "warning" : undefined,
              },
            ]}
          />
          <div className="px-4 py-3">
            <TelemetryHeading>Cumplimiento de requisitos</TelemetryHeading>
            {compliance.total === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                Todavía no hay requisitos ISO asignados.{" "}
                <span className="font-medium text-[var(--color-ink)]">Qué hacer:</span>{" "}
                pedile al administrador de plataforma que cargue el relevamiento inicial
                (gap).
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm">
                  <span className="font-semibold tabular-nums">
                    {compliance.conforming} de {compliance.applicable}
                  </span>{" "}
                  <span className="text-[var(--color-ink-muted)]">
                    requisitos conformes
                  </span>
                </p>
                <ComplianceBar total={compliance.total} byStatus={compliance.byStatus} />
              </>
            )}
          </div>
          <div className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <TelemetryHeading>Próximos vencimientos</TelemetryHeading>
              {dueCounts.open > 0 ? (
                <Link
                  href={`/t/${slug}/automations`}
                  className="text-xs font-medium text-[var(--color-accent)] hover:underline"
                >
                  Ver todos ({dueCounts.open}) →
                </Link>
              ) : null}
            </div>
            {dueItems.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                No hay vencimientos abiertos. Se generan solos al fijar fechas en
                hallazgos, acciones, riesgos, auditorías e indicadores.
              </p>
            ) : (
              <DueMiniList items={dueItems.slice(0, HOME_DUE_LIST_SIZE)} />
            )}
          </div>
        </div>
      </TelemetryPanel>
    </PageFrame>
  );
}
