import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import { GUIDE_DEFINITIONS } from "@/domain/risks/guide";
import { SOURCE_KINDS } from "@/domain/risks/types";
import { listRecentFindingsForLink } from "@/lib/risks-workspace";
import { DirectEntryForm } from "@/app/(tenant)/t/[slug]/risks/DirectEntryForm";
import { GuideLink } from "@/app/(tenant)/t/[slug]/risks/FormFields";
import { PageFrame, PageHeader } from "@/components/ui";

export type NewRecordQuery = { kind?: string; label?: string; finding?: string };

const COPY = {
  risk: {
    title: "Registrar riesgo",
    purpose: "Algo que podría salir mal y afectar a un proceso, al cliente o a un requisito.",
    other: { text: "¿Es algo que se podría aprovechar?", label: "Registrar una oportunidad", path: "opportunities/new" },
  },
  opportunity: {
    title: "Registrar oportunidad",
    purpose: "Algo favorable que se podría aprovechar para mejorar un proceso o un resultado.",
    other: { text: "¿Es algo que podría salir mal?", label: "Registrar un riesgo", path: "new" },
  },
} as const;

/** Alta de un riesgo o de una oportunidad: cada uno tiene su pantalla y su formulario. */
export async function NewRecordView({
  slug,
  kind,
  query,
}: {
  slug: string;
  kind: "risk" | "opportunity";
  query: NewRecordQuery;
}) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const membership = await getMembership(ctx.userId, tenant.id);
  if (!canTenantRole(membership?.role, "write", { isPlatformSuperuser: ctx.isPlatformSuperuser })) {
    redirect(`/t/${slug}/risks`);
  }

  const findings = await listRecentFindingsForLink(tenant.id);
  const def = GUIDE_DEFINITIONS[kind];
  const copy = COPY[kind];

  return (
    <PageFrame>
      <PageHeader eyebrow={`ISO 9001 · §6.1 · ${kind === "risk" ? "Riesgo" : "Oportunidad"}`} title={copy.title} purpose={copy.purpose} />
      <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-card-line)] bg-[var(--color-accent-soft)] px-4 py-3 text-sm text-[var(--color-accent-ink)]">
        <p className="font-semibold">{def.formula}</p>
        <p>Ej.: {def.example}</p>
        <p className="text-[var(--color-ink-muted)]">
          {copy.other.text}{" "}
          <Link href={`/t/${slug}/risks/${copy.other.path}`} className="font-medium text-[var(--color-accent)] underline-offset-2 hover:underline">
            {copy.other.label} →
          </Link>
          {" · "}
          <GuideLink slug={slug} />
        </p>
      </div>
      <DirectEntryForm
        key={kind}
        slug={slug}
        kind={kind}
        findings={findings}
        initialSource={{
          kind: SOURCE_KINDS.find((k) => k === query.kind),
          label: query.label?.slice(0, 200),
          findingId: findings.find((f) => f.id === query.finding)?.id,
        }}
      />
    </PageFrame>
  );
}
