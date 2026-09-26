import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import {
  listDueItems,
  listOffersWithActivation,
  listTenantNotifications,
} from "@/lib/automation";
import { labelReminderKind } from "@/domain/automation/due";

type Params = Promise<{ slug: string }>;

export default async function TenantAutomationsPage({
  params,
}: {
  params: Params;
}) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");

  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const membership = await getMembership(ctx.userId, tenant.id);
  if (!membership && !ctx.isPlatformSuperuser) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Sin acceso
        </h1>
      </div>
    );
  }

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
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Ofertas activas, vencimientos y recordatorios. La activación la
            gestiona el administrador de plataforma.
          </p>
        </div>
        <Link
          href={`/t/${slug}`}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
        >
          Volver al portal
        </Link>
      </div>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Ofertas
        </h2>
        <ul className="mt-3 space-y-2">
          {offers.map((offer) => (
            <li
              key={offer.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-3 text-sm"
            >
              <strong>{offer.name}</strong>
              {" · "}
              {offer.activation?.active ? "activa" : "inactiva"}
              <p className="mt-1 text-[var(--color-ink-muted)]">
                {offer.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Próximos vencimientos
        </h2>
        <ul className="mt-3 space-y-2">
          {dueItems.filter((d) => d.status === "open").map((item) => (
            <li
              key={item.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-3 text-sm"
            >
              {item.title} · {item.dueAt.toISOString().slice(0, 10)}
              {item.lastReminderKind
                ? ` · ${labelReminderKind(item.lastReminderKind)}`
                : ""}
            </li>
          ))}
          {dueItems.filter((d) => d.status === "open").length === 0 ? (
            <li className="text-sm text-[var(--color-ink-muted)]">
              No hay vencimientos abiertos.
            </li>
          ) : null}
        </ul>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Notificaciones
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
              Sin notificaciones.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
