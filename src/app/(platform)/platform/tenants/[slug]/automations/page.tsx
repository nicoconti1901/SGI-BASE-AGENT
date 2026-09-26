import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import {
  listDueItems,
  listOffersWithActivation,
  listTenantNotifications,
} from "@/lib/automation";
import { labelReminderKind } from "@/domain/automation/due";
import { PLATFORM_ROLE_LABEL } from "@/domain/identity/authz";
import {
  CreateDueItemForm,
  RunDueScanForm,
  ToggleOfferForm,
} from "@/app/(platform)/platform/automations/AutomationForms";

type Params = Promise<{ slug: string }>;

export default async function TenantAutomationsPlatformPage({
  params,
}: {
  params: Params;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const platformRole = (session.user as { platformRole?: string | null })
    .platformRole;
  if (platformRole !== "platform_superuser") {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Sin acceso
        </h1>
        <p className="mt-3 text-[var(--color-ink-muted)]">
          Solo el {PLATFORM_ROLE_LABEL.toLowerCase()}.
        </p>
      </div>
    );
  }

  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const [offers, dueItems, notifications] = await Promise.all([
    listOffersWithActivation(tenant.id),
    listDueItems(tenant.id),
    listTenantNotifications(tenant.id),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
            {tenant.name}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Automatizaciones
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/t/${slug}/automations`}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
          >
            Vista cliente
          </Link>
          <Link
            href="/platform/automations"
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
          >
            Catálogo global
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Ofertas
        </h2>
        {offers.map((offer) => {
          const active = Boolean(offer.activation?.active);
          return (
            <div
              key={offer.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-4 py-3"
            >
              <div>
                <p className="font-medium">{offer.name}</p>
                <p className="text-xs text-[var(--color-ink-subtle)]">
                  {offer.code} · {active ? "activa" : "inactiva"}
                </p>
              </div>
              <ToggleOfferForm
                slug={slug}
                offerCode={offer.code}
                active={active}
              />
            </div>
          );
        })}
      </section>

      <CreateDueItemForm slug={slug} />
      <RunDueScanForm defaultSlug={slug} />

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Vencimientos ({dueItems.length})
        </h2>
        <ul className="mt-3 space-y-2">
          {dueItems.map((item) => (
            <li
              key={item.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-3 text-sm"
            >
              <strong>{item.title}</strong> · {item.entityType} · vence{" "}
              {item.dueAt.toISOString().slice(0, 10)} · {item.status}
              {item.lastReminderKind
                ? ` · último: ${labelReminderKind(item.lastReminderKind)}`
                : ""}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Notificaciones in-app
        </h2>
        <ul className="mt-3 space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-3 text-sm"
            >
              <p className="font-medium">{n.title}</p>
              <p className="text-[var(--color-ink-muted)]">{n.body}</p>
            </li>
          ))}
          {notifications.length === 0 ? (
            <li className="text-sm text-[var(--color-ink-muted)]">
              Sin notificaciones todavía.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
