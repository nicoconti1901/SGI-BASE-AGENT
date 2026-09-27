import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import { GUIDE_DEFINITIONS } from "@/domain/risks/guide";
import { listRecentFindingsForLink } from "@/lib/risks-workspace";
import { DirectEntryForm } from "@/app/(tenant)/t/[slug]/risks/DirectEntryForm";
import { GuideLink } from "@/app/(tenant)/t/[slug]/risks/FormFields";

export default async function NewRiskOrOpportunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { slug } = await params;
  const { tipo } = await searchParams;
  const kind = tipo === "oportunidad" ? "opportunity" : "risk";

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
  const def = GUIDE_DEFINITIONS[kind];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <Link href={`/t/${slug}/risks`} className="text-sm text-[var(--color-accent)]">
          ← Riesgos y oportunidades
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
          {kind === "risk" ? "Nuevo riesgo" : "Nueva oportunidad"}
        </h1>
        <div className="mt-3 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm">
          <p className="font-medium">{def.formula}</p>
          <p className="mt-1 text-[var(--color-ink-muted)]">Ej.: {def.example}</p>
        </div>
        <div className="mt-2">
          <GuideLink slug={slug} />
        </div>
      </div>
      <DirectEntryForm key={kind} slug={slug} kind={kind} findings={findings} />
    </div>
  );
}
