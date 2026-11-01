import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getAppSessionContext } from "@/lib/session";
import { getMembership } from "@/lib/identity";
import { getModuleTelemetry } from "@/lib/dashboard";
import { requireModuleEnabled } from "@/lib/modules";
import { canTenantRole } from "@/domain/identity/authz";
import { MODULE_CATALOG, MODULE_SECTIONS, clauseSummary } from "@/domain/modules/catalog";
import { MODULE_HUB, screenHref, visibleScreens } from "@/domain/modules/hub";
import { PageFrame, PageHeader } from "@/components/ui";
import { HexBus, HexTile, HubStage, HubSteps } from "@/components/hub/HubStage";
import {
  DueMiniList,
  TelemetryCounts,
  TelemetryHeading,
  TelemetryPanel,
} from "@/components/hub/Telemetry";

type Params = Promise<{ slug: string; module: string }>;

/** Paso 2 del ingreso: las pantallas de un módulo, con su tablero chico de referencia. */
export default async function ModuleHubPage({ params }: { params: Params }) {
  const { slug, module: modulePath } = await params;
  const mod = MODULE_CATALOG.find(
    (m) => m.path === modulePath && m.status === "available",
  );
  const tenant = await getTenantBySlug(slug);
  if (!mod || !tenant) notFound();
  await requireModuleEnabled(tenant.id, mod.key);

  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");
  const membership = await getMembership(ctx.userId, tenant.id);
  const canWrite = canTenantRole(membership?.role, "write", {
    isPlatformSuperuser: ctx.isPlatformSuperuser,
  });

  const screens = visibleScreens(mod.key, canWrite);
  // Con una sola pantalla no hay nada que elegir: se entra directo.
  if (screens.length < 2) redirect(screenHref(slug, mod, screens[0]));

  const hub = MODULE_HUB[mod.key];
  const area = MODULE_SECTIONS.find((s) => s.key === mod.section)?.label ?? "";
  const clauses = clauseSummary(mod.clauses);
  const { dueItems, dueCounts } = await getModuleTelemetry(
    tenant.id,
    hub.dueTypes,
    new Date(),
    slug,
  );

  return (
    <PageFrame width="7xl">
      <PageHeader
        eyebrow={clauses ? `${area} · ${clauses}` : area}
        title={mod.label}
        purpose={hub.tagline}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <HubStage>
          <HubSteps current={2} moduleLabel={mod.label} />
          <nav aria-label={`Pantallas de ${mod.label}`} className="flex justify-center">
            <HexBus size="lg">
              {screens.map((screen, i) => (
                <HexTile
                  key={screen.path}
                  href={screenHref(slug, mod, screen)}
                  label={screen.label}
                  icon={screen.icon}
                  detail={screen.hint}
                  index={i}
                />
              ))}
            </HexBus>
          </nav>
          <Link
            href={`/t/${slug}`}
            className="self-start rounded-[var(--radius-sm)] text-sm text-[var(--color-hub-ink-muted)] hover:text-[var(--color-hub-ink)]"
          >
            ← Todos los módulos
          </Link>
        </HubStage>

        <TelemetryPanel title="Tablero del módulo">
          {hub.dueTypes.length > 0 ? (
            <>
              <TelemetryCounts
                items={[
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
                  { label: "Abiertos", value: String(dueCounts.open) },
                ]}
              />
              <div className="border-t border-[var(--color-line)] px-4 py-3">
                <TelemetryHeading>Próximos vencimientos</TelemetryHeading>
                {dueItems.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                    Nada vence por ahora en {mod.label.toLowerCase()}. Los vencimientos
                    aparecen al fijar fechas en sus registros.
                  </p>
                ) : (
                  <DueMiniList items={dueItems} />
                )}
              </div>
            </>
          ) : (
            <p className="px-4 py-3 text-sm text-[var(--color-ink-muted)]">
              Este módulo no genera vencimientos propios.{" "}
              <span className="font-medium text-[var(--color-ink)]">Qué hacer:</span>{" "}
              entrá a {screens[0].label} para ver su estado.
            </p>
          )}
          {clauses ? (
            <div className="border-t border-[var(--color-line)] px-4 py-3">
              <TelemetryHeading>Requisitos que ayuda a cumplir</TelemetryHeading>
              <ul className="mt-1 font-[family-name:var(--font-mono)] text-xs leading-relaxed">
                {clauses.split(" / ").map((clause) => (
                  <li key={clause}>{clause}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </TelemetryPanel>
      </div>
    </PageFrame>
  );
}
