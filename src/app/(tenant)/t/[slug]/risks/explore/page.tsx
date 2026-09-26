import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import { listRecentFindingsForLink } from "@/lib/risks-workspace";
import { ExploreContextForm } from "@/app/(tenant)/t/[slug]/risks/ExploreContextForm";

type Params = Promise<{ slug: string }>;

export default async function ExploreContextPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");

  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const membership = await getMembership(ctx.userId, tenant.id);
  if (
    !canTenantRole(membership?.role, "write", {
      isPlatformSuperuser: ctx.isPlatformSuperuser,
    })
  ) {
    redirect(`/t/${slug}/risks`);
  }

  const findings = await listRecentFindingsForLink(tenant.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <Link
          href={`/t/${slug}/risks`}
          className="text-sm text-[var(--color-accent)]"
        >
          ← Workspace
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
          Explorar contexto
        </h1>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          Partí de una fuente (proceso, proveedor, hallazgo, cambio…) y decidí
          si nace un riesgo, una oportunidad, ambos o ninguno.
        </p>
      </div>
      <ExploreContextForm slug={slug} findings={findings} />
    </div>
  );
}
