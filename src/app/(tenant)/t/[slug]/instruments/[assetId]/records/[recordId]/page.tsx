import Link from "next/link";
import { notFound } from "next/navigation";
import { getInstrument, searchInstruments } from "@/lib/instruments";
import { getCalibrationRecord } from "@/lib/calibration-records";
import { loadInstrumentsAccess } from "@/app/(tenant)/t/[slug]/instruments/access";
import { RecordForm, type RecordFormDefaults, type RowDraft } from "@/app/(tenant)/t/[slug]/instruments/[assetId]/records/RecordForm";
import { instrumentFormProps } from "@/app/(tenant)/t/[slug]/instruments/[assetId]/records/props";
import { DiscardDraftForm, RemoveCertificateForm, VoidRecordForm } from "@/app/(tenant)/t/[slug]/instruments/[assetId]/RecordControls";
import { POINT_REASON_LABELS, RECORD_KIND_LABELS, TRACEABILITY_LABELS, type PointReason } from "@/domain/calibration";
import { formatDateEs, isoFromDate, todayIso } from "@/domain/inspections/dates";
import { SectionBlock, StatusChip } from "@/components/ui";

const th = "px-3 py-2 font-semibold";
const THEAD = "border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]";
const es = (v: { toString(): string } | null | undefined) => (v === null || v === undefined ? "—" : v.toString().replace(".", ","));
const dateOrDash = (d: Date | null) => (d ? formatDateEs(isoFromDate(d)) : "—");

type RecordDetail = NonNullable<Awaited<ReturnType<typeof getCalibrationRecord>>>;

function PointsTable({ title, points }: { title: string; points: RecordDetail["points"] }) {
  if (points.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">{title}</caption>
          <thead className={THEAD}>
            <tr>
              <th scope="col" className={th}>Canal</th>
              <th scope="col" className={th}>Patrón</th>
              <th scope="col" className={th}>Medido</th>
              <th scope="col" className={th}>Error</th>
              <th scope="col" className={th}>Incert. (U)</th>
              <th scope="col" className={th}>Máx. permitido</th>
              <th scope="col" className={th}>Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {points.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2">{p.channelKey}</td>
                <td className="px-3 py-2 tabular-nums">{es(p.nominal)} {p.unit}</td>
                <td className="px-3 py-2 tabular-nums">{es(p.measured)}</td>
                <td className="px-3 py-2 tabular-nums">{es(p.error)}</td>
                <td className="px-3 py-2 tabular-nums">{es(p.uncertainty)}</td>
                <td className="px-3 py-2 tabular-nums">±{es(p.empApplied)}</td>
                <td className="px-3 py-2">
                  <span className="flex flex-col items-start gap-1">
                    <StatusChip status={p.ok ? (p.reason === "in_guard_band" ? "warning" : "ok") : "danger"} label={p.ok ? "Pasa" : "No pasa"} />
                    {p.reason && p.reason !== "within" ? <span className="text-xs text-[var(--color-ink-muted)]">{POINT_REASON_LABELS[p.reason as PointReason] ?? p.reason}</span> : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const rowsOf = (record: RecordDetail, stage: "as_found" | "as_left"): RowDraft[] =>
  record.points
    .filter((p) => p.stage === stage)
    .map((p) => ({ channelKey: p.channelKey, nominal: p.nominal.toString(), measured: p.measured.toString(), uncertainty: p.uncertainty?.toString() ?? "" }));

export default async function RecordPage({ params }: { params: Promise<{ slug: string; assetId: string; recordId: string }> }) {
  const { slug, assetId, recordId } = await params;
  const { tenant, canWrite, canManage } = await loadInstrumentsAccess(slug);
  const [detail, record] = await Promise.all([getInstrument(tenant.id, assetId), getCalibrationRecord(tenant.id, assetId, recordId)]);
  if (!detail || !record) notFound();
  const { asset, control } = detail;
  const base = `/t/${slug}/instruments/${assetId}`;
  const editable = record.status === "draft" && canWrite && asset.status !== "retired";
  const kindLabel = RECORD_KIND_LABELS[record.kind];

  const back = (
    <p>
      <Link href={base} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
        ← Volver a {asset.code}
      </Link>
    </p>
  );

  if (editable) {
    const standards = (await searchInstruments(tenant.id, { take: 100 })).filter((s) => s.id !== assetId);
    const defaults: RecordFormDefaults = {
      kind: record.kind,
      performedAt: isoFromDate(record.performedAt),
      certificateNumber: record.certificateNumber ?? "",
      certificateIssuedAt: record.certificateIssuedAt ? isoFromDate(record.certificateIssuedAt) : "",
      labName: record.labName,
      traceability: record.traceability,
      accreditationBody: record.accreditationBody ?? "",
      accreditationNumber: record.accreditationNumber ?? "",
      accreditationScopeCovers: record.accreditationScopeCovers ?? false,
      traceabilityBasis: record.traceabilityBasis ?? "",
      referenceStandardAssetId: record.referenceStandardAssetId ?? "",
      conditions: record.conditions ?? "",
      adjusted: record.adjusted,
      basis: record.basis,
      labStatement: record.labStatement ?? "",
      labStatementSpec: record.labStatementSpec ?? "",
      labDecisionRule: record.labDecisionRule ?? "",
      coverageK: record.points.find((p) => p.coverageK)?.coverageK?.toString() ?? "2",
      notes: record.notes ?? "",
      asFound: rowsOf(record, "as_found"),
      asLeft: rowsOf(record, "as_left"),
    };
    return (
      <div className="flex flex-col gap-6">
        {back}
        <SectionBlock title={`Borrador de ${kindLabel.toLowerCase()} · ${asset.code}`} what={`${asset.description}. Cargado por ${record.loadedByName}. Cuando estén todos los datos, cerralo para calcular el resultado.`}>
          {record.attachments.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm">
              {record.attachments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <a href={`/api/calibration/attachments/${a.id}/download`} className="text-[var(--color-accent)] hover:underline" download={a.fileName}>
                    {a.fileName}
                  </a>
                  <RemoveCertificateForm slug={slug} assetId={assetId} attachmentId={a.id} fileName={a.fileName} />
                </li>
              ))}
            </ul>
          ) : null}
          <RecordForm
            slug={slug}
            assetId={assetId}
            recordId={record.id}
            instrument={instrumentFormProps(asset, control, detail.channels)}
            standards={standards}
            defaults={defaults}
            today={todayIso()}
          />
        </SectionBlock>
        <details className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4">
          <summary className="cursor-pointer text-sm font-semibold">Descartar este borrador</summary>
          <div className="mt-3">
            <DiscardDraftForm slug={slug} assetId={assetId} recordId={record.id} />
          </div>
        </details>
      </div>
    );
  }

  const voided = record.status === "voided";
  const asFound = record.points.filter((p) => p.stage === "as_found");
  const asLeft = record.points.filter((p) => p.stage === "as_left");
  return (
    <div className="flex flex-col gap-6">
      {back}
      <SectionBlock
        title={`${kindLabel} del ${formatDateEs(isoFromDate(record.performedAt))} · ${asset.code}`}
        what={voided ? `Anulado: ${record.voidReason}` : record.status === "draft" ? "Borrador" : `Cerrado por ${record.loadedByName}. Un registro cerrado no se edita.`}
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-[var(--color-ink-muted)]">Laboratorio</dt>
            <dd>{record.labName}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-ink-muted)]">Trazabilidad</dt>
            <dd>
              {TRACEABILITY_LABELS[record.traceability]}
              {record.referenceStandard ? ` · patrón ${record.referenceStandard.code}` : ""}
              {record.accreditationBody ? ` · ${record.accreditationBody} ${record.accreditationNumber ?? ""}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-ink-muted)]">Certificado</dt>
            <dd>{record.certificateNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-ink-muted)]">Regla aplicada</dt>
            <dd>{record.ruleApplied === "guard_band" ? "Error + incertidumbre dentro del máximo" : record.ruleApplied === "simple_acceptance" ? "Error dentro del máximo" : "Declaración del laboratorio"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-ink-muted)]">Resultado</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {record.asLeftResult ? <StatusChip status={record.asLeftResult === "apt" ? "ok" : "danger"} label={record.asLeftResult === "apt" ? "Apto" : "No apto"} /> : "—"}
              {record.adjusted && record.asFoundResult ? <span className="text-xs">Al recibir: {{ apt: "dentro de tolerancia", not_apt: "fuera de tolerancia", not_evaluated: "no evaluado" }[record.asFoundResult]}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-ink-muted)]">Vigente hasta</dt>
            <dd>{voided ? "—" : dateOrDash(record.validUntil)}</dd>
          </div>
        </dl>
        {record.basis === "certificate_statement" ? (
          <p className="text-sm">
            El laboratorio declaró <strong>{record.labStatement === "conforme" ? "conforme" : "no conforme"}</strong> contra «{record.labStatementSpec}», con la regla «{record.labDecisionRule}».
          </p>
        ) : null}
        <PointsTable title={record.adjusted ? "Antes del ajuste" : "Puntos medidos"} points={asFound} />
        <PointsTable title="Después del ajuste" points={asLeft} />
        {record.attachments.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {record.attachments.map((a) => (
              <li key={a.id}>
                <a href={`/api/calibration/attachments/${a.id}/download`} className="text-[var(--color-accent)] hover:underline" download={a.fileName}>
                  {a.fileName}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {record.notes ? <p className="text-sm text-[var(--color-ink-muted)]">{record.notes}</p> : null}
      </SectionBlock>
      {record.status === "closed" && canManage ? (
        <details className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4">
          <summary className="cursor-pointer text-sm font-semibold">Anular este registro</summary>
          <div className="mt-3">
            <VoidRecordForm slug={slug} assetId={assetId} recordId={record.id} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
