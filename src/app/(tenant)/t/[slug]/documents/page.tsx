import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { listDocumentsWithVersions } from "@/lib/documents";
import {
  DOCUMENT_FATE_LABELS,
  type DocumentFate,
} from "@/domain/assessment/gap";

type Params = Promise<{ slug: string }>;

export default async function TenantDocumentsPage({
  params,
}: {
  params: Params;
}) {
  const ctx = await getAppSessionContext();
  if (!ctx) {
    redirect("/login");
  }

  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    notFound();
  }

  const membership = await getMembership(ctx.userId, tenant.id);
  if (!membership && !ctx.isPlatformSuperuser) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Sin acceso
        </h1>
        <p className="mt-3 text-[var(--color-ink-muted)]">
          No sos miembro de {tenant.name}.
        </p>
      </div>
    );
  }

  const documents = await listDocumentsWithVersions(tenant.id);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
            {tenant.name}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Documentos
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Procedimientos y registros vigentes del SGI. La carga la realiza el
            administrador de plataforma.
          </p>
        </div>
        <Link
          href={`/t/${slug}`}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
        >
          Volver al portal
        </Link>
      </div>

      {documents.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line-strong)] px-5 py-8 text-sm text-[var(--color-ink-muted)]">
          Todavía no hay documentos publicados para este tenant.
        </p>
      ) : (
        <ul className="space-y-3">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-4 py-4"
            >
              <div>
                <p className="font-medium">{doc.title}</p>
                <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
                  {DOCUMENT_FATE_LABELS[doc.fate as DocumentFate]}
                  {doc.currentVersion
                    ? ` · v${doc.currentVersion.versionNumber} · ${doc.currentVersion.fileName}`
                    : ""}
                </p>
              </div>
              {doc.currentVersion ? (
                <a
                  href={`/api/documents/${doc.id}/download`}
                  className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-white"
                >
                  Descargar
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
