import Link from "next/link";
import { HintCallout, StatusChip } from "@/components/ui";
import { isoDay } from "@/domain/suppliers/dates";
import { SUPPLIER_FINDING_KIND_LABELS } from "@/domain/suppliers/findings";
import type { EvaluationEvidence } from "@/lib/supplier-evidence";

const dmy = (date: Date) => isoDay(date).split("-").reverse().join("/");
const ACTION_STATUS: Record<string, string> = { open: "Abierta", in_progress: "En curso" };

/** Evidencia precargada del período para quien evalúa: motivos para reevaluar, hallazgos, acciones abiertas y documentos. */
export function EvidencePanel({
  slug,
  evidence,
  reasons,
  documents,
}: {
  slug: string;
  evidence: EvaluationEvidence;
  /** Por qué conviene reevaluar ya (señales calculadas por `eventReevaluationReasons`). */
  reasons: string[];
  /** Líneas con el estado de los documentos que no están vigentes. */
  documents: string[];
}) {
  const nothing = reasons.length === 0 && evidence.findings.length === 0 && evidence.openActions.length === 0 && documents.length === 0;
  if (nothing) return null;
  return (
    <section aria-label="Evidencia del período" className="flex flex-col gap-3">
      <h3 className="font-[family-name:var(--font-display)] text-lg">Evidencia a mano</h3>
      <p className="text-sm text-[var(--color-ink-muted)]">
        {evidence.since ? `Desde la última evaluación (${dmy(evidence.since)}), más lo que sigue abierto.` : "Todo lo registrado del proveedor hasta hoy."}
      </p>
      {reasons.length ? (
        <HintCallout>
          <span className="flex flex-col gap-1">
            <span className="font-semibold">Conviene reevaluar ahora</span>
            {reasons.map((r) => (
              <span key={r}>{r}</span>
            ))}
          </span>
        </HintCallout>
      ) : null}
      {evidence.findings.length ? (
        <div>
          <p className="text-sm font-semibold">Hallazgos</p>
          <ul className="mt-1 divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
            {evidence.findings.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  <Link href={`/t/${slug}/findings/${f.id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                    {f.title}
                  </Link>
                  <span className="block text-xs text-[var(--color-ink-muted)]">
                    {SUPPLIER_FINDING_KIND_LABELS[f.kind]} · detectado el {dmy(f.detectedAt)}
                  </span>
                </span>
                <StatusChip status={f.open ? "warning" : "ok"} label={f.open ? "Abierto" : "Cerrado"} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {evidence.openActions.length ? (
        <div>
          <p className="text-sm font-semibold">Acciones abiertas</p>
          <ul className="mt-1 divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
            {evidence.openActions.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>{a.title}</span>
                <span className="text-xs text-[var(--color-ink-muted)]">
                  {ACTION_STATUS[a.status] ?? a.status}
                  {a.dueAt ? ` · vence el ${dmy(a.dueAt)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {documents.length ? (
        <p className="text-sm">
          <span className="font-semibold">Documentos: </span>
          {documents.join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
