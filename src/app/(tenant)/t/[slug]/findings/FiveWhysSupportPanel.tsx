"use client";

import { useState } from "react";
import {
  BRANCHING_GUIDANCE,
  INDUSTRIAL_CASE_STUDIES,
  SUPPORT_KEY_IDEAS,
  SUPPORT_METHOD_STEPS,
} from "@/domain/findings/why-guidance";

export function FiveWhysSupportPanel() {
  const [open, setOpen] = useState(false);
  const [caseId, setCaseId] = useState(INDUSTRIAL_CASE_STUDIES[0]?.id ?? "");

  const selected =
    INDUSTRIAL_CASE_STUDIES.find((c) => c.id === caseId) ??
    INDUSTRIAL_CASE_STUDIES[0]!;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="block text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">
            Material de apoyo
          </span>
          <span className="mt-0.5 block text-sm font-medium text-[var(--color-ink)]">
            Cómo investigar con 5 Porqués (lectura rápida)
          </span>
        </span>
        <span className="text-sm text-[var(--color-accent)]">
          {open ? "Ocultar" : "Abrir"}
        </span>
      </button>

      {open ? (
        <div className="space-y-5 border-t border-[var(--color-line)] px-4 py-4 text-sm text-[var(--color-ink-muted)]">
          <section>
            <h3 className="font-semibold text-[var(--color-ink)]">
              Para qué sirve
            </h3>
            <p className="mt-1">
              Partí de un hecho comprobado y preguntá “¿por qué?” hasta llegar a
              condiciones del <strong>sistema</strong> (equipo, procedimiento,
              mantenimiento, supervisión, organización) que, al corregirse,
              reduzcan la repetición. “5” es una guía, no un cupo fijo.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {SUPPORT_KEY_IDEAS.map((idea) => (
                <li key={idea}>{idea}</li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-[var(--color-ink)]">
              Secuencia profesional
            </h3>
            <ol className="mt-2 space-y-1.5">
              {SUPPORT_METHOD_STEPS.map((s) => (
                <li key={s.step} className="flex gap-2">
                  <span className="w-5 shrink-0 font-semibold text-[var(--color-ink)]">
                    {s.step}.
                  </span>
                  <span>
                    <strong className="text-[var(--color-ink)]">{s.title}.</strong>{" "}
                    {s.detail}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="font-semibold text-[var(--color-ink)]">
              {BRANCHING_GUIDANCE.title}
            </h3>
            <p className="mt-1">{BRANCHING_GUIDANCE.summary}</p>
            <p className="mt-2 text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">
              Abrí ramas cuando…
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {BRANCHING_GUIDANCE.whenToBranch.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <p className="mt-2 rounded-[var(--radius-sm)] bg-[var(--color-warning-soft)] px-2 py-2 text-[var(--color-warning)]">
              {BRANCHING_GUIDANCE.avoid}
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-[var(--color-ink)]">
              Ejemplos industriales (condensados)
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {INDUSTRIAL_CASE_STUDIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCaseId(c.id)}
                  className={`rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-medium ${
                    caseId === c.id
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      : "border-[var(--color-line)]"
                  }`}
                >
                  {c.title}
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-3">
              <p>
                <strong className="text-[var(--color-ink)]">Hecho:</strong>{" "}
                {selected.fact}
              </p>
              {selected.branches.map((b) => (
                <div key={b.label}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-subtle)]">
                    {b.label}
                  </p>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                    {b.chain.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ol>
                </div>
              ))}
              <p>
                <strong className="text-[var(--color-ink)]">
                  Causas raíz posibles:
                </strong>
              </p>
              <ul className="list-disc pl-5">
                {selected.rootCauses.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="text-[var(--color-accent)]">{selected.lesson}</p>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
