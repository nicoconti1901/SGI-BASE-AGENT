import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import { listFindings } from "@/lib/findings";
import {
  FINDING_STATUS_LABELS,
  FINDING_STATUS_TONE,
  FINDING_TYPE_LABELS,
  FINDING_TYPES,
  MEASURE_KIND_LABELS,
  MEASURE_STATUS_LABELS,
  MEASURE_STATUS_TONE,
  isFindingStatus,
  isFindingType,
  isMeasureWorkflowStatus,
  nearestOpenMeasureDueAt,
  type FindingStatus,
  type FindingType,
  type MeasureKind,
  type MeasureWorkflowStatus,
} from "@/domain/findings/types";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: FindingStatus }) {
  const tone = FINDING_STATUS_TONE[status];
  return (
    <span
      className="inline-flex whitespace-nowrap rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-semibold"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {FINDING_STATUS_LABELS[status]}
    </span>
  );
}

function MeasureStatusCell({
  measures,
}: {
  measures: { kind: string; status: string; title: string }[];
}) {
  if (measures.length === 0) {
    return <span className="text-[var(--color-ink-subtle)]">—</span>;
  }

  return (
    <ul className="flex min-w-[11rem] flex-col gap-1.5">
      {measures.map((m, i) => {
        const status: MeasureWorkflowStatus = isMeasureWorkflowStatus(m.status)
          ? m.status
          : "open";
        const tone = MEASURE_STATUS_TONE[status];
        const kindLabel =
          MEASURE_KIND_LABELS[m.kind as MeasureKind] ?? m.kind;
        return (
          <li key={`${m.kind}-${i}-${m.title}`} className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[11px] font-semibold"
              style={{ background: tone.bg, color: tone.fg }}
              title={`${kindLabel}: ${m.title}`}
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: tone.fg }}
                aria-hidden
              />
              {MEASURE_STATUS_LABELS[status]}
            </span>
            <span className="truncate text-[11px] text-[var(--color-ink-muted)]">
              {kindLabel === "Correctiva" ? "Corr." : "Prev."}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default async function FindingsListPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");

  const { slug } = await params;
  const sp = await searchParams;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const membership = await getMembership(ctx.userId, tenant.id);
  if (!membership && !ctx.isPlatformSuperuser) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Sin acceso
        </h1>
      </div>
    );
  }

  const canWrite = canTenantRole(membership?.role, "write", {
    isPlatformSuperuser: ctx.isPlatformSuperuser,
  });

  const q = first(sp.q).trim();
  const typeRaw = first(sp.type);
  const statusRaw = first(sp.status);
  const type = isFindingType(typeRaw) ? typeRaw : undefined;
  const status =
    statusRaw === "all"
      ? ("all" as const)
      : isFindingStatus(statusRaw)
        ? statusRaw
        : undefined;

  const findings = await listFindings(tenant.id, { q, type, status });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
            {tenant.name}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Hallazgos
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <Link
              href={`/t/${slug}/findings/new`}
              className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Crear hallazgo
            </Link>
          ) : null}
          <Link
            href={`/t/${slug}`}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
          >
            Volver al portal
          </Link>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <form
          method="get"
          className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4 sm:grid-cols-4"
        >
          <label className="flex flex-col gap-1 text-xs text-[var(--color-ink-subtle)] sm:col-span-2">
            Buscar
            <input
              name="q"
              defaultValue={q}
              placeholder="Título, descripción o lugar…"
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--color-ink-subtle)]">
            Tipo
            <select
              name="type"
              defaultValue={type ?? ""}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
            >
              <option value="">Todos</option>
              {FINDING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FINDING_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--color-ink-subtle)]">
            Estado
            <select
              name="status"
              defaultValue={statusRaw || ""}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
            >
              <option value="">Activos (sin anulados)</option>
              {(Object.keys(FINDING_STATUS_LABELS) as FindingStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {FINDING_STATUS_LABELS[s]}
                  </option>
                ),
              )}
              <option value="all">Todos</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-4">
            <button
              type="submit"
              className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              Filtrar
            </button>
            <Link
              href={`/t/${slug}/findings`}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
            >
              Limpiar
            </Link>
            <p className="self-center text-sm text-[var(--color-ink-muted)]">
              {findings.length} resultado{findings.length === 1 ? "" : "s"}
            </p>
          </div>
        </form>

        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)]">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface)] text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">
                <th className="px-3 py-3 font-medium">Título</th>
                <th className="px-3 py-3 font-medium">Tipo</th>
                <th className="px-3 py-3 font-medium">Detección</th>
                <th className="px-3 py-3 font-medium">Lugar</th>
                <th className="px-3 py-3 font-medium">Próx. venc.</th>
                <th className="px-3 py-3 font-medium">Medidas</th>
                <th className="px-3 py-3 font-medium">Estado</th>
                <th className="px-3 py-3 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {findings.map((finding) => {
                const href =
                  finding.status === "draft"
                    ? `/t/${slug}/findings/${finding.id}/edit`
                    : `/t/${slug}/findings/${finding.id}`;
                const nextDue = nearestOpenMeasureDueAt(finding.measures);
                const overdue =
                  nextDue &&
                  nextDue.getTime() < Date.now() &&
                  finding.status !== "closed";
                return (
                  <tr
                    key={finding.id}
                    className="border-b border-[var(--color-line)] last:border-b-0"
                  >
                    <td className="max-w-[14rem] px-3 py-3 font-medium text-[var(--color-ink)]">
                      <span className="line-clamp-2">{finding.title}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[var(--color-ink-muted)]">
                      {FINDING_TYPE_LABELS[finding.type as FindingType]}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[var(--color-ink-muted)]">
                      {formatDate(finding.detectedAt)}
                    </td>
                    <td className="max-w-[10rem] px-3 py-3 text-[var(--color-ink-muted)]">
                      <span className="line-clamp-2">
                        {finding.location?.trim() || "—"}
                      </span>
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-3 ${
                        overdue
                          ? "font-medium text-[var(--color-danger)]"
                          : "text-[var(--color-ink-muted)]"
                      }`}
                    >
                      {nextDue ? formatDate(nextDue) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <MeasureStatusCell measures={finding.measures} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={finding.status as FindingStatus} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={href}
                        className="text-sm font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
                      >
                        {finding.status === "draft" ? "Editar" : "Ver"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {findings.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-[var(--color-ink-muted)]"
                  >
                    No hay hallazgos con estos filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
