"use client";

import { useMemo, useState } from "react";
import {
  addWhyBranch,
  appendWhyStep,
  canConfirmRootCause,
  confirmRootCause,
  createInitialWhyStep,
  detectWhyAnswerWarnings,
  listBranchIds,
  markStepAsRoot,
  MAX_BRANCHES,
  MAX_WHY_DEPTH,
  MIN_WHY_DEPTH,
  normalizeWhySteps,
  removeBranch,
  stepsOfBranch,
  syncFirstWhyQuestion,
  updateBranchLabel,
} from "@/domain/findings/five-whys";
import {
  guideForWhyLevel,
  INVESTIGATION_CHECKLIST,
  PROBLEM_STATEMENT_EXAMPLES,
  PROBLEM_STATEMENT_RULES,
  SUGGESTED_BRANCH_LABELS,
} from "@/domain/findings/why-guidance";
import type { RootCauseAnalysis, WhyStep } from "@/domain/findings/types";
import { FiveWhysSupportPanel } from "@/app/(tenant)/t/[slug]/findings/FiveWhysSupportPanel";

const WARNING_LABELS: Record<string, string> = {
  blame: "Parece culpar a una persona — seguí preguntando por el sistema",
  vague: "Respuesta demasiado vaga o corta",
  symptom: "Parece un síntoma, no una causa",
  solution: "Parece una solución, no una causa",
  logic_gap: "Posible salto lógico",
};

function buildInitialLabState(initial?: RootCauseAnalysis | null): {
  steps: WhyStep[];
  branchId: string;
  stepId: string;
} {
  const steps =
    initial?.steps?.length
      ? normalizeWhySteps(initial.steps)
      : [createInitialWhyStep()];
  const branchId = listBranchIds(steps)[0] ?? steps[0]!.branchId;
  const stepId = stepsOfBranch(steps, branchId)[0]?.id ?? steps[0]!.id;
  return { steps, branchId, stepId };
}

export function FiveWhysLab({
  initial,
  userId,
  onConfirmed,
}: {
  initial?: RootCauseAnalysis | null;
  userId: string;
  onConfirmed: (rca: RootCauseAnalysis) => void;
}) {
  const [boot] = useState(() => buildInitialLabState(initial));
  const [statement, setStatement] = useState(initial?.problemStatement ?? "");
  const [sequence, setSequence] = useState(
    initial?.investigationSequence ?? "",
  );
  const [checklist, setChecklist] = useState<string[]>(
    initial?.investigationChecklist ?? [],
  );
  const [steps, setSteps] = useState<WhyStep[]>(boot.steps);
  const [activeBranchId, setActiveBranchId] = useState(boot.branchId);
  const [activeStepId, setActiveStepId] = useState<string | null>(boot.stepId);
  const [error, setError] = useState<string | null>(null);
  const [checkPrevent, setCheckPrevent] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  const branchIds = listBranchIds(steps);
  const resolvedBranchId =
    branchIds.includes(activeBranchId) ? activeBranchId : (branchIds[0] ?? boot.branchId);
  const branchSteps = stepsOfBranch(steps, resolvedBranchId);
  const active: WhyStep =
    branchSteps.find((s) => s.id === activeStepId) ??
    branchSteps[branchSteps.length - 1] ??
    branchSteps[0] ??
    steps[0] ??
    createInitialWhyStep();
  const levelGuide = guideForWhyLevel(active.order);
  const warnings = useMemo(
    () => detectWhyAnswerWarnings(active.answer),
    [active.answer],
  );

  function applyStatementToChain(nextStatement: string) {
    const trimmed = nextStatement.trim();
    setStatement(trimmed);
    setSteps((prev) => syncFirstWhyQuestion(prev, trimmed));
    setError(null);
  }

  function toggleCheck(id: string) {
    setChecklist((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function updateActiveAnswer(answer: string) {
    setSteps((prev) =>
      prev.map((s) => (s.id === active.id ? { ...s, answer } : s)),
    );
  }

  function updateActiveEvidence(evidenceNote: string) {
    setSteps((prev) =>
      prev.map((s) => (s.id === active.id ? { ...s, evidenceNote } : s)),
    );
  }

  function selectBranch(branchId: string) {
    setActiveBranchId(branchId);
    const first = stepsOfBranch(steps, branchId)[0];
    setActiveStepId(first?.id ?? null);
  }

  function handleAddWhy() {
    try {
      if (!statement.trim()) {
        setError("Definí primero el hecho comprobado / punto de partida");
        return;
      }
      setError(null);
      const next = appendWhyStep(steps, resolvedBranchId);
      setSteps(next);
      setActiveBranchId(resolvedBranchId);
      const last = stepsOfBranch(next, resolvedBranchId).at(-1);
      setActiveStepId(last?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar nivel");
    }
  }

  function handleAddBranch(label?: string) {
    try {
      if (!statement.trim()) {
        setError("Definí el hecho antes de abrir otra rama");
        return;
      }
      const next = addWhyBranch(steps, label, statement);
      setSteps(next);
      const newId = listBranchIds(next).at(-1)!;
      setActiveBranchId(newId);
      setActiveStepId(stepsOfBranch(next, newId)[0]?.id ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar rama");
    }
  }

  function handleMarkRoot() {
    if (!active) return;
    if (active.order < MIN_WHY_DEPTH) {
      setError(
        `La causa raíz de la rama debe estar al menos en el nivel ${MIN_WHY_DEPTH}`,
      );
      return;
    }
    if (active.answer.trim().length < 12) {
      setError("La causa raíz necesita una respuesta más específica");
      return;
    }
    setSteps(markStepAsRoot(steps, active.id));
    setError(null);
  }

  function handleConfirm() {
    try {
      if (!statement.trim()) {
        setError("El hecho comprobado es obligatorio");
        return;
      }
      if (checklist.length < 3) {
        setError(
          "Marcá al menos 3 ítems de la checklist de investigación (hechos reunidos)",
        );
        return;
      }
      if (!checkPrevent) {
        setError(
          "Confirmá que resolver estas causas evitaría la recurrencia del hecho",
        );
        return;
      }
      if (!canConfirmRootCause(steps)) {
        setError(
          `Completá respuestas, profundizá ≥${MIN_WHY_DEPTH} niveles en al menos una rama y marcá su causa raíz (podés marcar una por rama).`,
        );
        return;
      }
      const rca = confirmRootCause(steps, userId, statement, {
        investigationChecklist: checklist,
        investigationSequence: sequence,
      });
      onConfirmed(rca);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo confirmar");
    }
  }

  const branchLabel =
    branchSteps[0]?.branchLabel ?? SUGGESTED_BRANCH_LABELS[0]!;

  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5 shadow-[var(--shadow-soft)]">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Laboratorio · 5 Porqués
        </h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Primero reuní hechos. Después analizá con cadenas o{" "}
          <strong>ramas</strong> si hay causas independientes. El punto de
          partida es el hecho comprobado, no el título. Mínimo {MIN_WHY_DEPTH}{" "}
          niveles por rama hasta marcar causa raíz.
        </p>
      </div>

      <FiveWhysSupportPanel />

      {/* Fase: investigación previa */}
      <section className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">
          1. Antes de preguntar “¿por qué?”
        </h3>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Los 5 Porqués analizan información ya reunida. Marcá qué tenés
          documentado (hechos, no opiniones).
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {INVESTIGATION_CHECKLIST.map((item) => (
            <li key={item.id}>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--color-ink-muted)]">
                <input
                  type="checkbox"
                  checked={checklist.includes(item.id)}
                  onChange={() => toggleCheck(item.id)}
                  className="mt-0.5 size-4 accent-[var(--color-accent)]"
                />
                {item.label}
              </label>
            </li>
          ))}
        </ul>
        <label className="mt-4 flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
          Secuencia temporal (breve)
          <textarea
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            rows={2}
            placeholder="Ej.: 08:10 baranda retirada → 08:25 ingreso de materiales → 08:40 caída…"
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--color-ink)]"
          />
        </label>
      </section>

      {/* Fase: hecho */}
      <section className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">
          2. Hecho comprobado (punto de partida)
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-ink-muted)]">
          {PROBLEM_STATEMENT_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setShowExamples((v) => !v)}
          className="mt-3 text-sm font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
        >
          {showExamples ? "Ocultar ejemplos" : "Ver ejemplos de hecho"}
        </button>
        {showExamples ? (
          <ul className="mt-3 space-y-2">
            {PROBLEM_STATEMENT_EXAMPLES.map((example) => (
              <li key={example.label}>
                <button
                  type="button"
                  onClick={() => applyStatementToChain(example.text)}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-3 py-2 text-left transition hover:border-[var(--color-accent)]"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-subtle)]">
                    {example.label}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                    {example.text}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <label className="mt-3 flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
          Hecho / incidente (obligatorio)
          <textarea
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            onBlur={() => {
              if (statement.trim()) applyStatementToChain(statement);
            }}
            rows={3}
            placeholder="Ej.: El 08/09 un operario sufrió atrapamiento de la mano al retirar una pieza trabada de la prensa PH-04…"
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--color-ink)]"
          />
        </label>
        <button
          type="button"
          onClick={() => applyStatementToChain(statement)}
          disabled={!statement.trim()}
          className="mt-2 w-fit rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          Aplicar hecho a las preguntas de nivel 1
        </button>
      </section>

      {/* Fase: árbol / ramas */}
      <section className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">
              3. Árbol causal (ramas)
            </h3>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Una cadena por mecanismo independiente. No mezcles “protección +
              capacitación + supervisión” en una sola respuesta.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_BRANCH_LABELS.slice(0, 4).map((label) => (
              <button
                key={label}
                type="button"
                disabled={branchIds.length >= MAX_BRANCHES}
                onClick={() => handleAddBranch(label)}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-2 py-1 text-xs font-medium disabled:opacity-50"
              >
                + {label.split("—")[0]?.trim()}
              </button>
            ))}
            <button
              type="button"
              disabled={branchIds.length >= MAX_BRANCHES}
              onClick={() => handleAddBranch()}
              className="rounded-[var(--radius-md)] border border-[var(--color-accent)] px-2 py-1 text-xs font-medium text-[var(--color-accent)] disabled:opacity-50"
            >
              + Rama
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {branchIds.map((id) => {
            const label =
              stepsOfBranch(steps, id)[0]?.branchLabel ?? id;
            const hasRoot = stepsOfBranch(steps, id).some((s) => s.isRootCause);
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectBranch(id)}
                className={`rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-medium ${
                  id === resolvedBranchId
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "border-[var(--color-line)]"
                }`}
              >
                {label}
                {hasRoot ? " ★" : ""}
              </button>
            );
          })}
        </div>

        <label className="mt-3 flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
          Nombre de la rama activa
          <input
            value={branchLabel}
            onChange={(e) =>
              setSteps(updateBranchLabel(steps, resolvedBranchId, e.target.value))
            }
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--color-ink)]"
          />
        </label>

        {branchIds.length > 1 ? (
          <button
            type="button"
            onClick={() => {
              const next = removeBranch(steps, resolvedBranchId);
              setSteps(next);
              const first = listBranchIds(next)[0]!;
              setActiveBranchId(first);
              setActiveStepId(stepsOfBranch(next, first)[0]?.id ?? null);
            }}
            className="mt-2 text-xs text-[var(--color-danger)] underline-offset-2 hover:underline"
          >
            Eliminar esta rama
          </button>
        ) : null}

        <ol className="mt-4 space-y-2">
          {branchSteps.map((step) => {
            const isActive = step.id === active.id;
            const guide = guideForWhyLevel(step.order);
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => setActiveStepId(step.id)}
                  className={`w-full rounded-[var(--radius-md)] border px-3 py-3 text-left transition ${
                    step.isRootCause
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                      : isActive
                        ? "border-[var(--color-line-strong)] bg-[var(--color-surface-raised)]"
                        : "border-[var(--color-line)] bg-[var(--color-surface-raised)]/60"
                  }`}
                >
                  <p className="text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">
                    Nivel {step.order} · {guide.title}
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
      </section>

      {/* Nivel activo */}
      <section className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <p className="text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">
          Nivel activo {active.order} · {levelGuide.title} · {branchLabel}
        </p>
        <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">
          {active.question}
        </p>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          <strong>Orientación:</strong> {levelGuide.ask}
        </p>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          {levelGuide.tip}
        </p>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <p className="rounded-[var(--radius-sm)] bg-[var(--color-success-soft)] px-2 py-2 text-[var(--color-success)]">
            <strong>Bien:</strong> {levelGuide.goodExample}
          </p>
          <p className="rounded-[var(--radius-sm)] bg-[var(--color-danger-soft)] px-2 py-2 text-[var(--color-danger)]">
            <strong>Evitá:</strong> {levelGuide.badExample}
          </p>
        </div>
        <textarea
          value={active.answer}
          onChange={(e) => updateActiveAnswer(e.target.value)}
          rows={3}
          placeholder="Respondé con un hecho verificable del proceso o sistema…"
          className="mt-3 w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm text-[var(--color-ink)]"
        />
        <label className="mt-2 flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
          Evidencia que sustenta esta respuesta (recomendado)
          <input
            value={active.evidenceNote ?? ""}
            onChange={(e) => updateActiveEvidence(e.target.value)}
            placeholder="Testimonio, registro, foto, medición…"
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--color-ink)]"
          />
        </label>
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
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleAddWhy}
          disabled={branchSteps.length >= MAX_WHY_DEPTH}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Profundizar esta rama (otro ¿por qué?)
        </button>
        <button
          type="button"
          onClick={handleMarkRoot}
          className="rounded-[var(--radius-md)] border border-[var(--color-accent)] px-3 py-2 text-sm font-medium text-[var(--color-accent)]"
        >
          Marcar como causa raíz de esta rama
        </button>
      </div>

      <label className="inline-flex items-start gap-2 text-sm text-[var(--color-ink-muted)]">
        <input
          type="checkbox"
          checked={checkPrevent}
          onChange={(e) => setCheckPrevent(e.target.checked)}
          className="mt-1 size-4 accent-[var(--color-accent)]"
        />
        Si corregimos las causas raíz marcadas, el hecho no debería repetirse
        (verificación de eficacia).
      </label>

      {error ? (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={handleConfirm}
        className="w-fit rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white"
      >
        Confirmar causa(s) raíz
      </button>

      {initial?.status === "confirmed" && initial.rootCause ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-success)]/30 bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success)]">
          ★ Causa(s) raíz actual: {initial.rootCause}
        </p>
      ) : null}
    </div>
  );
}
