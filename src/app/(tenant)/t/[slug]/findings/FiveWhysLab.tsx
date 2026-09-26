"use client";

import { useMemo, useState } from "react";
import {
  appendWhyStep,
  confirmRootCause,
  createInitialWhyStep,
  detectWhyAnswerWarnings,
  markStepAsRoot,
  MAX_WHY_DEPTH,
  MIN_WHY_DEPTH,
} from "@/domain/findings/five-whys";
import type { RootCauseAnalysis, WhyStep } from "@/domain/findings/types";

const WARNING_LABELS: Record<string, string> = {
  blame: "Parece culpar a una persona",
  vague: "Respuesta demasiado vaga o corta",
  symptom: "Parece un síntoma, no una causa",
  solution: "Parece una solución, no una causa",
  logic_gap: "Posible salto lógico",
};

export function FiveWhysLab({
  problemStatement,
  initial,
  userId,
  onConfirmed,
}: {
  problemStatement: string;
  initial?: RootCauseAnalysis | null;
  userId: string;
  onConfirmed: (rca: RootCauseAnalysis) => void;
}) {
  const [statement, setStatement] = useState(
    initial?.problemStatement || problemStatement,
  );
  const [steps, setSteps] = useState<WhyStep[]>(
    initial?.steps?.length
      ? initial.steps
      : [createInitialWhyStep(problemStatement || "este hecho")],
  );
  const [activeOrder, setActiveOrder] = useState(
    initial?.steps?.length ? initial.steps.length : 1,
  );
  const [error, setError] = useState<string | null>(null);
  const [checkPrevent, setCheckPrevent] = useState(false);

  const active = steps.find((s) => s.order === activeOrder) ?? steps[0]!;
  const warnings = useMemo(
    () => detectWhyAnswerWarnings(active.answer),
    [active.answer],
  );

  function updateActiveAnswer(answer: string) {
    setSteps((prev) =>
      prev.map((s) => (s.order === activeOrder ? { ...s, answer } : s)),
    );
  }

  function handleAddWhy() {
    try {
      setError(null);
      const next = appendWhyStep(steps);
      setSteps(next);
      setActiveOrder(next[next.length - 1]!.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar nivel");
    }
  }

  function handleMarkRoot() {
    if (active.order < MIN_WHY_DEPTH) {
      setError(`La causa raíz debe estar al menos en el nivel ${MIN_WHY_DEPTH}`);
      return;
    }
    if (active.answer.trim().length < 12) {
      setError("La causa raíz necesita una respuesta más específica");
      return;
    }
    setSteps(markStepAsRoot(steps, active.order));
    setError(null);
  }

  function handleConfirm() {
    try {
      if (!checkPrevent) {
        setError(
          "Confirmá que resolver esta causa evitaría la recurrencia del hecho",
        );
        return;
      }
      const marked = markStepAsRoot(
        steps,
        steps.find((s) => s.isRootCause)?.order ?? active.order,
      );
      const rca = confirmRootCause(marked, userId, statement);
      onConfirmed(rca);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo confirmar");
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5 shadow-[var(--shadow-soft)]">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Laboratorio · 5 Porqués
        </h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Investigación guiada hasta la causa raíz. Mínimo {MIN_WHY_DEPTH}{" "}
          niveles. Sin causa raíz confirmada no se puede publicar el hallazgo.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Hecho / síntoma de partida
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          rows={2}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        />
      </label>

      <ol className="space-y-2">
        {steps.map((step) => {
          const isActive = step.order === activeOrder;
          return (
            <li key={step.order}>
              <button
                type="button"
                onClick={() => setActiveOrder(step.order)}
                className={`w-full rounded-[var(--radius-md)] border px-3 py-3 text-left transition ${
                  step.isRootCause
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : isActive
                      ? "border-[var(--color-line-strong)] bg-[var(--color-surface)]"
                      : "border-[var(--color-line)] bg-[var(--color-surface)]/60"
                }`}
              >
                <p className="text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">
                  Nivel {step.order}
                  {step.isRootCause ? " · ★ Causa raíz" : ""}
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">
                  {step.question}
                </p>
                <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                  {step.answer || "— sin respuesta —"}
                </p>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <p className="text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">
          Nivel activo {active.order}
        </p>
        <p className="mt-1 text-sm font-medium">{active.question}</p>
        <textarea
          value={active.answer}
          onChange={(e) => updateActiveAnswer(e.target.value)}
          rows={3}
          placeholder="Respondé con un hecho verificable del proceso o sistema…"
          className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm text-[var(--color-ink)]"
        />
        {warnings.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {warnings.map((w) => (
              <li
                key={w}
                className="rounded-full bg-[var(--color-warning-soft)] px-2 py-0.5 text-xs text-[var(--color-warning)]"
              >
                {WARNING_LABELS[w] ?? w}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleAddWhy}
          disabled={steps.length >= MAX_WHY_DEPTH}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Agregar otro ¿por qué?
        </button>
        <button
          type="button"
          onClick={handleMarkRoot}
          className="rounded-[var(--radius-md)] border border-[var(--color-accent)] px-3 py-2 text-sm font-medium text-[var(--color-accent)]"
        >
          Marcar este nivel como causa raíz
        </button>
      </div>

      <label className="inline-flex items-start gap-2 text-sm text-[var(--color-ink-muted)]">
        <input
          type="checkbox"
          checked={checkPrevent}
          onChange={(e) => setCheckPrevent(e.target.checked)}
          className="mt-1 size-4 accent-[var(--color-accent)]"
        />
        Si resolvemos esta causa raíz, el hecho no debería repetirse.
      </label>

      {error ? (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={handleConfirm}
        className="w-fit rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white"
      >
        Confirmar causa raíz
      </button>

      {initial?.status === "confirmed" && initial.rootCause ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-success)]/30 bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success)]">
          ★ Causa raíz actual: {initial.rootCause}
        </p>
      ) : null}
    </div>
  );
}
