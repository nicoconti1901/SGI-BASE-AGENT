import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { listDocumentsWithVersions } from "@/lib/documents";
import { listTenantGapRequirements } from "@/lib/assessment-gap";
import {
  DOCUMENT_FATE_LABELS,
  type DocumentFate,
} from "@/domain/assessment/gap";
import { PLATFORM_ROLE_LABEL } from "@/domain/identity/authz";
import { resolveStorageBackend } from "@/lib/storage";
import { UploadDocumentForm } from "@/app/(platform)/platform/tenants/[slug]/documents/UploadDocumentForm";

type Params = Promise<{ slug: string }>;

export default async function TenantDocumentsPlatformPage({
  params,
}: {
  params: Params;
}) {
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
          Solo el {PLATFORM_ROLE_LABEL.toLowerCase()} gestiona documentos en el
          MVP.
        </p>
      </div>
    );
  }

  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    notFound();
  }

  const [documents, requirements] = await Promise.all([
    listDocumentsWithVersions(tenant.id),
    listTenantGapRequirements(tenant.id),
  ]);

  const requirementOptions = requirements.map((row) => ({
    id: row.id,
    label: `${row.requirement.standard} ${row.requirement.clauseCode} — ${row.requirement.title}`,
  }));

  const documentOptions = documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    fate: doc.fate as DocumentFate,
  }));

  const backend = resolveStorageBackend();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
            Control documental
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight">
            {tenant.name}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Storage:{" "}
            <strong>{backend === "s3" ? "S3 / MinIO" : "memoria (dev)"}</strong>
            . Los documentos Conservar no admiten nueva versión sin marcar
            “forzar”.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/platform/tenants/${slug}/gap`}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
          >
            Gap
          </Link>
          <Link
            href={`/platform/tenants/${slug}`}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
          >
            Ficha
          </Link>
          <Link
            href={`/t/${slug}/documents`}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
          >
            Vista cliente
          </Link>
        </div>
      </div>

      <UploadDocumentForm
        slug={slug}
        requirements={requirementOptions}
        documents={documentOptions}
      />

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Documentos ({documents.length})
        </h2>
        {documents.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
            Todavía no hay documentos cargados.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--color-ink)]">
                      {doc.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
                      {DOCUMENT_FATE_LABELS[doc.fate as DocumentFate]}
                      {doc.tenantRequirement
                        ? ` · ${doc.tenantRequirement.requirement.standard} ${doc.tenantRequirement.requirement.clauseKey}`
                        : " · sin requisito"}
                      {doc.currentVersion
                        ? ` · v${doc.currentVersion.versionNumber} · ${doc.currentVersion.fileName}`
                        : " · sin archivo"}
                    </p>
                  </div>
                  {doc.currentVersion ? (
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-white"
                    >
                      Descargar actual
                    </a>
                  ) : null}
                </div>
                {doc.versions.length > 1 ? (
                  <ul className="mt-3 space-y-1 border-t border-[var(--color-line)] pt-3 text-xs text-[var(--color-ink-muted)]">
                    {doc.versions.map((version) => (
                      <li key={version.id} className="flex justify-between gap-2">
                        <span>
                          v{version.versionNumber} · {version.fileName} ·{" "}
                          {new Date(version.createdAt).toLocaleString("es-AR")}
                        </span>
                        <a
                          href={`/api/documents/${doc.id}/download?versionId=${version.id}`}
                          className="text-[var(--color-accent)] underline-offset-2 hover:underline"
                        >
                          bajar
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
