import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import { StartFindingForm } from "@/app/(tenant)/t/[slug]/findings/StartFindingForm";

type Params = Promise<{ slug: string }>;

export default async function NewFindingPage({ params }: { params: Params }) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");

  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const membership = await getMembership(ctx.userId, tenant.id);
  const canWrite = canTenantRole(membership?.role, "write", {
    isPlatformSuperuser: ctx.isPlatformSuperuser,
  });

  if (!canWrite) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Sin permiso para crear hallazgos
        </h1>
        <Link
          href={`/t/${slug}/findings`}
          className="mt-4 inline-block text-sm text-[var(--color-accent)] underline-offset-2 hover:underline"
        >
          Volver al seguimiento
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
          {tenant.name}
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Crear hallazgo
        </h1>
        <Link
          href={`/t/${slug}/findings`}
          className="mt-2 inline-block text-sm text-[var(--color-accent)] underline-offset-2 hover:underline"
        >
          ← Volver al seguimiento
        </Link>
      </div>
      <StartFindingForm slug={slug} />
    </div>
  );
}
