import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantBySlug } from "@/lib/tenant-provisioning";

type Params = Promise<{ slug: string }>;

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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
          Portal del cliente
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">
          {tenant.name}
        </h1>
        <p className="mt-2 text-[var(--color-ink-muted)]">
          Tenant <strong>{tenant.slug}</strong> · perfil {tenant.size} /{" "}
          {tenant.activity}. Plantilla con{" "}
          <strong>{tenant._count.requirements}</strong> requisitos ISO.
        </p>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface)] px-5 py-8 text-sm text-[var(--color-ink-muted)]">
        Shell path-based listo. En Task 6 se conectan usuarios del tenant; el
        dashboard de cumplimiento llega en Task 12.
      </div>

      <Link
        href="/portal"
        className="text-sm font-medium text-[var(--color-accent)] hover:underline"
      >
        Ver shell genérico `/portal`
      </Link>
    </div>
  );
}
