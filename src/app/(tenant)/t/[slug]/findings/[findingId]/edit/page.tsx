import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import { getFinding, listTenantMemberOptions } from "@/lib/findings";
import { FindingEditor } from "@/app/(tenant)/t/[slug]/findings/FindingEditor";
import type { FindingType, RootCauseAnalysis } from "@/domain/findings/types";

type Params = Promise<{ slug: string; findingId: string }>;

export default async function EditFindingPage({
  params,
}: {
  params: Params;
}) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");

  const { slug, findingId } = await params;
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
          Sin permiso
        </h1>
      </div>
    );
  }

  const [finding, members] = await Promise.all([
    getFinding(tenant.id, findingId),
    listTenantMemberOptions(tenant.id),
  ]);
  if (!finding) notFound();
  if (finding.status !== "draft") {
    redirect(`/t/${slug}/findings/${findingId}`);
  }

  const rca = (finding.rcaJson as RootCauseAnalysis | null) ?? null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
            Borrador de hallazgo
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Completar y publicar
          </h1>
        </div>
        <Link
          href={`/t/${slug}/findings`}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
        >
          Volver a la bandeja
        </Link>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-[var(--color-warning)]">
          No hay usuarios en el tenant. Invitá miembros antes de asignar
          responsables y notificados.
        </p>
      ) : (
        <FindingEditor
          slug={slug}
          findingId={finding.id}
          userId={ctx.userId}
          members={members}
          initialValues={{
            type: finding.type as FindingType,
            title: finding.title,
            description: finding.description,
            detectedAt: finding.detectedAt.toISOString().slice(0, 10),
            source: finding.source ?? "",
            location: finding.location ?? "",
            severity: finding.severity ?? "",
            rca,
            measures: finding.measures.map((m) => ({
              kind: m.kind,
              title: m.title,
              description: m.description ?? "",
              ownerUserId: m.ownerUserId,
              dueAt: m.dueAt ? m.dueAt.toISOString().slice(0, 10) : "",
              linkedRootCause: m.linkedRootCause,
            })),
            notifyUserIds: finding.notifyRecipients.map((r) => r.userId),
          }}
        />
      )}
    </div>
  );
}
