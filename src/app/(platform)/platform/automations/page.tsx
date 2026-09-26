import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  ensureNativeOffersSeeded,
  listRecentAutomationRuns,
} from "@/lib/automation";
import { PLATFORM_ROLE_LABEL } from "@/domain/identity/authz";
import { prisma } from "@/lib/db";
import { RunDueScanForm } from "@/app/(platform)/platform/automations/AutomationForms";

export default async function PlatformAutomationsPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const platformRole = (session.user as { platformRole?: string | null })
    .platformRole;
  if (platformRole !== "platform_superuser") {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Sin acceso
        </h1>
        <p className="mt-3 text-[var(--color-ink-muted)]">
          Solo el {PLATFORM_ROLE_LABEL.toLowerCase()} gestiona automatizaciones.
        </p>
      </div>
    );
  }

  await ensureNativeOffersSeeded();
  const [offers, runs, tenants] = await Promise.all([
    prisma.automationOffer.findMany({ orderBy: { code: "asc" } }),
    listRecentAutomationRuns(prisma, 15),
    prisma.tenant.findMany({
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
      take: 50,
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
          Automation offers
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Automatizaciones
        </h1>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          Solo se ejecutan ofertas declaradas. MVP: motor de vencimientos +
          activación por tenant. Sin automatizaciones inventadas.
        </p>
      </div>

      <RunDueScanForm />

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Catálogo de ofertas
        </h2>
        <ul className="mt-3 space-y-3">
          {offers.map((offer) => (
            <li
              key={offer.id}
              className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-4 py-4"
            >
              <p className="font-medium">{offer.name}</p>
              <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
                {offer.code} · {offer.kind}
                {offer.enabledGlobal ? " · habilitada" : " · deshabilitada"}
              </p>
              <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                {offer.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Activar por tenant
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {tenants.map((tenant) => (
            <li key={tenant.slug}>
              <Link
                href={`/platform/tenants/${tenant.slug}/automations`}
                className="text-[var(--color-accent)] underline-offset-2 hover:underline"
              >
                {tenant.name} (`{tenant.slug}`)
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Auditoría de runs
        </h2>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
            Todavía no hay ejecuciones.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {runs.map((run) => (
              <li
                key={run.id}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm"
              >
                <p>
                  <strong>{run.offerCode}</strong> · {run.status}
                  {run.tenant ? ` · ${run.tenant.name}` : " · todos"}
                </p>
                <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
                  {new Date(run.startedAt).toLocaleString("es-AR")}
                  {run.summary
                    ? ` · ${JSON.stringify(run.summary)}`
                    : run.error
                      ? ` · ${run.error}`
                      : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
