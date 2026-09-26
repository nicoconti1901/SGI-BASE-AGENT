import type { ReactNode } from "react";
import {
  MEASURE_KIND_LABELS,
  MEASURE_STATUS_LABELS,
  MEASURE_STATUS_TONE,
  isMeasureWorkflowStatus,
  type MeasureKind,
  type MeasureWorkflowStatus,
} from "@/domain/findings/types";

export type AttachmentView = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  label?: string | null;
  createdAt?: Date | string;
};

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(value?: Date | string): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fileKind(contentType: string, fileName: string): {
  short: string;
  isImage: boolean;
} {
  const lower = fileName.toLowerCase();
  if (
    contentType.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif)$/.test(lower)
  ) {
    return { short: "IMG", isImage: true };
  }
  if (contentType.includes("pdf") || lower.endsWith(".pdf")) {
    return { short: "PDF", isImage: false };
  }
  if (
    contentType.includes("word") ||
    lower.endsWith(".doc") ||
    lower.endsWith(".docx")
  ) {
    return { short: "DOC", isImage: false };
  }
  if (contentType.startsWith("text/") || lower.endsWith(".txt")) {
    return { short: "TXT", isImage: false };
  }
  return { short: "FILE", isImage: false };
}

export function MeasureStatusBadge({ status }: { status: string }) {
  const key: MeasureWorkflowStatus = isMeasureWorkflowStatus(status)
    ? status
    : "open";
  const tone = MEASURE_STATUS_TONE[key];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-semibold tracking-wide"
      style={{ background: tone.bg, color: tone.fg }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: tone.fg }}
        aria-hidden
      />
      {MEASURE_STATUS_LABELS[key]}
    </span>
  );
}

export function AttachmentCard({
  attachment,
  tone = "default",
}: {
  attachment: AttachmentView;
  tone?: "default" | "evidence";
}) {
  const kind = fileKind(attachment.contentType, attachment.fileName);
  const when = formatWhen(attachment.createdAt);
  const border =
    tone === "evidence"
      ? "border-[var(--color-success)]/35 bg-[var(--color-success-soft)]/40"
      : "border-[var(--color-line)] bg-[var(--color-surface)]";

  return (
    <a
      href={`/api/findings/attachments/${attachment.id}/download`}
      className={`group flex items-start gap-3 rounded-[var(--radius-md)] border px-3 py-3 transition hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-soft)] ${border}`}
    >
      <span
        className={`mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] font-[family-name:var(--font-mono)] text-xs font-bold tracking-wider ${
          kind.isImage
            ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
            : "bg-[var(--color-surface-raised)] text-[var(--color-ink-muted)] ring-1 ring-[var(--color-line)]"
        }`}
        aria-hidden
      >
        {kind.short}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
          {attachment.fileName}
        </span>
        {attachment.label ? (
          <span className="mt-0.5 block text-sm text-[var(--color-ink-muted)]">
            {attachment.label}
          </span>
        ) : null}
        <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-[var(--color-ink-subtle)]">
          <span>{formatBytes(attachment.sizeBytes)}</span>
          {when ? <span>· {when}</span> : null}
          <span className="font-medium text-[var(--color-accent)] opacity-0 transition group-hover:opacity-100">
            Descargar
          </span>
        </span>
      </span>
    </a>
  );
}

export function AttachmentEmptyState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-6 text-center text-sm text-[var(--color-ink-muted)]">
      {message}
    </div>
  );
}

export function MeasureCardShell({
  status,
  kind,
  title,
  dueAt,
  linkedRootCause,
  overdue,
  children,
}: {
  status: string;
  kind: MeasureKind;
  title: string;
  dueAt: Date | null;
  linkedRootCause: boolean;
  overdue: boolean;
  children?: ReactNode;
}) {
  const key: MeasureWorkflowStatus = isMeasureWorkflowStatus(status)
    ? status
    : "open";
  const tone = MEASURE_STATUS_TONE[key];
  const dueLabel = dueAt
    ? dueAt.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <li
      className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-soft)]"
      style={{ borderLeftWidth: 4, borderLeftColor: tone.accentBar }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <MeasureStatusBadge status={status} />
            <span className="rounded-[var(--radius-sm)] border border-[var(--color-line)] px-2 py-0.5 text-xs font-medium text-[var(--color-ink-muted)]">
              {MEASURE_KIND_LABELS[kind]}
            </span>
            {linkedRootCause ? (
              <span className="rounded-[var(--radius-sm)] bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
                Ataca causa raíz
              </span>
            ) : null}
          </div>
          <p className="mt-2 font-[family-name:var(--font-display)] text-lg text-[var(--color-ink)]">
            {title}
          </p>
          {dueLabel ? (
            <p
              className={`mt-1 text-sm ${
                overdue && key !== "closed"
                  ? "font-semibold text-[var(--color-danger)]"
                  : "text-[var(--color-ink-muted)]"
              }`}
            >
              Vence {dueLabel}
              {overdue && key !== "closed" ? " · vencida" : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--color-ink-subtle)]">
              Sin fecha de vencimiento
            </p>
          )}
        </div>
      </div>
      {children}
    </li>
  );
}
