import type { ReactNode } from "react";
import type { ProgressStage } from "@/domain/risks/progress";

/** Cabecera de la ficha: en qué estado está, qué sigue, quién tiene que avanzar y qué lo impide. */
export function RecordStatusPanel({
  statusLabel,
  stages,
  nextStep,
  responsible,
  missing,
  notice,
  children,
}: {
  statusLabel: string;
  stages: ProgressStage[];
  nextStep: string;
  responsible: { name: string; role: string } | null;
  missing: string[];
  /** Para quien no puede avanzarlo: quién lo lleva y qué falta para cerrarlo. */
  notice?: { message: string; remaining: string[] } | null;
  children?: ReactNode;
}) {
  return (
    <section
      aria-label="Estado y próximo paso"
      className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line-strong)] bg-[var(--color-surface-raised)] p-5 shadow-[var(--shadow-card)]"
    >
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Etapas">
        {stages.map((s, i) => (
          <li
            key={s.key}
            aria-current={s.state === "current" ? "step" : undefined}
            className={`flex flex-col gap-0.5 rounded-[var(--radius-md)] border px-3 py-2 text-sm ${
              s.state === "done"
                ? "border-[var(--color-success-line)] bg-[var(--color-success-soft)] text-[var(--color-success)]"
                : s.state === "current"
                  ? "border-[var(--color-warning)] bg-[var(--color-warning-soft)] font-semibold text-[var(--color-warning)]"
                  : "border-dashed border-[var(--color-line-strong)] text-[var(--color-ink-muted)]"
            }`}
          >
            <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em]">
              {String(i + 1).padStart(2, "0")} · {s.state === "done" ? "Listo" : s.state === "current" ? "Ahora" : "Después"}
            </span>
            <span>{s.label}</span>
          </li>
        ))}
      </ol>

      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-[var(--color-ink-muted)]">Estado</dt>
          <dd className="mt-0.5 text-base font-semibold">{statusLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-ink-muted)]">Próximo paso</dt>
          <dd className="mt-0.5 text-base font-semibold">{nextStep}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-ink-muted)]">Responsable de avanzar</dt>
          <dd className="mt-0.5 text-base font-semibold">
            {responsible ? (
              <>
                {responsible.name}
                <span className="block text-xs font-normal text-[var(--color-ink-muted)]">{responsible.role}</span>
              </>
            ) : (
              <span className="text-[var(--color-ink-muted)]">Nadie: no requiere más pasos</span>
            )}
          </dd>
        </div>
      </dl>

      {notice ? (
        <div
          role="note"
          className="rounded-[var(--radius-md)] border border-[var(--color-info)] bg-[var(--color-info-soft)] px-3 py-2 text-sm text-[var(--color-ink)]"
        >
          <p className="font-semibold">Lo ves en solo lectura</p>
          <p className="mt-0.5">{notice.message}</p>
          {notice.remaining.length > 0 ? (
            <p className="mt-1">
              <span className="font-semibold">Para cerrarlo falta:</span> {notice.remaining.join(" · ")}.
            </p>
          ) : null}
        </div>
      ) : null}

      {missing.length > 0 ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] px-3 py-2 text-sm text-[var(--color-warning)]">
          <p className="font-semibold">Qué impide avanzar</p>
          <ul className="mt-1 list-disc pl-5">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {children}
    </section>
  );
}
