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
import {
  DOCUMENT_FOLDERS,
  documentsInFolder,
  findDocumentFolder,
  parentDocumentFolder,
  type DocumentFolder,
} from "@/domain/documents/folders";
import { EmptyState, EntityList, PageFrame, PageHeader, buttonClass } from "@/components/ui";
import { ChevronIcon, FolderIcon } from "@/components/ui/icons";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ carpeta?: string }>;

type DocumentRow = Awaited<ReturnType<typeof listDocumentsWithVersions>>[number];

const EYEBROW = "ISO 9001 · 14001 · 45001 · §7.5";

function folderHref(slug: string, folder?: DocumentFolder | null) {
  return folder ? `/t/${slug}/documents?carpeta=${folder.key}` : `/t/${slug}/documents`;
}

function countLabel(count: number) {
  return count === 1 ? "1 documento" : `${count} documentos`;
}

export default async function TenantDocumentsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
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

  const { carpeta } = await searchParams;
  const folder = findDocumentFolder(carpeta);
  const documents = await listDocumentsWithVersions(tenant.id);

  if (!folder) {
    return (
      <PageFrame>
        <PageHeader
          eyebrow={EYEBROW}
          title="Documentos"
          purpose={`Información documentada vigente de ${tenant.name}, ordenada en carpetas. La carga la realiza el administrador de plataforma.`}
          actions={
            <Link href={`/t/${slug}`} className={buttonClass("secondary")}>
              Volver al portal
            </Link>
          }
        />
        <FolderGrid slug={slug} folders={DOCUMENT_FOLDERS} documents={documents} label="Carpetas" />
      </PageFrame>
    );
  }

  const parent = parentDocumentFolder(folder.key);
  const isChild = parent !== null && parent.key !== folder.key;
  const inFolder = documentsInFolder(documents, folder);

  return (
    <PageFrame>
      <PageHeader
        eyebrow={EYEBROW}
        title={folder.label}
        purpose={folder.hint}
        actions={
          <Link href={folderHref(slug, isChild ? parent : null)} className={buttonClass("secondary")}>
            {isChild ? `Volver a ${parent.label}` : "Volver a carpetas"}
          </Link>
        }
      />

      <nav aria-label="Ubicación en Documentos" className="-mt-4 text-sm">
        <ol className="flex flex-wrap items-center gap-1.5 text-[var(--color-ink-muted)]">
          <li>
            <Link href={folderHref(slug)} className="font-medium text-[var(--color-accent)] hover:underline">
              Documentos
            </Link>
          </li>
          {isChild ? (
            <li className="flex items-center gap-1.5">
              <ChevronIcon direction="right" />
              <Link href={folderHref(slug, parent)} className="font-medium text-[var(--color-accent)] hover:underline">
                {parent.label}
              </Link>
            </li>
          ) : null}
          <li className="flex items-center gap-1.5" aria-current="page">
            <ChevronIcon direction="right" />
            <span className="font-medium text-[var(--color-ink)]">{folder.label}</span>
          </li>
        </ol>
      </nav>

      {folder.children ? (
        <FolderGrid slug={slug} folders={folder.children} documents={documents} label={`Subcarpetas de ${folder.label}`} />
      ) : inFolder.length === 0 ? (
        <EmptyState
          what={`Todavía no hay documentos en ${folder.label}.`}
          next="el administrador de plataforma los carga desde Control documental, eligiendo esta carpeta."
        />
      ) : (
        <DocumentList documents={inFolder} label={`Documentos de ${folder.label}`} />
      )}
    </PageFrame>
  );
}

function FolderGrid({
  slug,
  folders,
  documents,
  label,
}: {
  slug: string;
  folders: readonly DocumentFolder[];
  documents: readonly DocumentRow[];
  label: string;
}) {
  return (
    <ul aria-label={label} className="grid gap-4 sm:grid-cols-2">
      {folders.map((folder) => {
        const count = documentsInFolder(documents, folder).length;
        return (
          <li key={folder.key}>
            <Link
              href={folderHref(slug, folder)}
              className="group flex h-full items-start gap-4 rounded-[var(--radius-md)] border border-[var(--color-card-line)] bg-[var(--color-surface-raised)] p-5 shadow-[var(--shadow-card)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-card-line)] bg-[var(--color-surface-sunken)] text-[var(--color-accent)]">
                <FolderIcon className="h-6 w-6" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="sgi-h3">{folder.label}</span>
                <span className="text-base leading-relaxed text-[var(--color-ink)]">{folder.hint}</span>
                <span className="mt-1 text-sm text-[var(--color-ink-muted)] tabular-nums">
                  {countLabel(count)}
                  {folder.children ? ` · ${folder.children.map((c) => c.label).join(" y ")}` : ""}
                </span>
              </span>
              <ChevronIcon direction="right" className="mt-1 h-4 w-4 text-[var(--color-ink-muted)] group-hover:text-[var(--color-accent)]" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function DocumentList({ documents, label }: { documents: readonly DocumentRow[]; label: string }) {
  return (
    <EntityList aria-label={label}>
      {documents.map((doc) => (
        <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-base font-semibold">{doc.title}</p>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              {DOCUMENT_FATE_LABELS[doc.fate as DocumentFate]}
              {doc.currentVersion
                ? ` · v${doc.currentVersion.versionNumber} · ${doc.currentVersion.fileName}`
                : " · sin archivo"}
            </p>
          </div>
          {doc.currentVersion ? (
            <a href={`/api/documents/${doc.id}/download`} className={buttonClass("secondary")}>
              Descargar
            </a>
          ) : null}
        </li>
      ))}
    </EntityList>
  );
}
