import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import { listRecentFindingsForLink } from "@/lib/risks-workspace";
import { ExploreContextForm } from "@/app/(tenant)/t/[slug]/risks/ExploreContextForm";
import { SOURCE_KINDS } from "@/domain/risks/types";
import { GuideLink } from "@/app/(tenant)/t/[slug]/risks/FormFields";

type Params = Promise<{ slug: string }>;

export default async function ExploreContextPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ kind?: string; label?: string; finding?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
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
          ← Riesgos y oportunidades
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
          Explorar una fuente
        </h1>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          Elegí un proceso, proveedor, cambio u objetivo y anotá qué riesgos u
          oportunidades aparecen.
        </p>
        <div className="mt-2">
          <GuideLink slug={slug} />
        </div>
      </div>
      <ExploreContextForm
        slug={slug}
        findings={findings}
        initialSource={{
          kind: SOURCE_KINDS.find((k) => k === query.kind),
          label: query.label?.slice(0, 200),
          findingId: findings.find((f) => f.id === query.finding)?.id,
        }}
      />
    </div>
  );
}
