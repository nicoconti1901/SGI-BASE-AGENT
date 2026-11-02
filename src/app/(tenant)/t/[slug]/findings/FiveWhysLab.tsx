"use client";

import { useState } from "react";
import {
  addFactorBranch,
  appendWhyStep,
  confirmRootCause,
  detectWhyAnswerWarnings,
  factorBranches,
  markStepAsRoot,
  MAX_WHY_DEPTH,
  MIN_WHY_DEPTH,
  normalizeWhySteps,
  refreshWhyQuestions,
  removeBranch,
  removeLastWhyStep,
  rootCauseBlockers,
} from "@/domain/findings/five-whys";
import {
  causeFactorsFor,
  guideForWhyLevel,
  INVESTIGATION_CHECKLIST,
  PROBLEM_STATEMENT_EXAMPLES,
  PROBLEM_STATEMENT_RULES,
} from "@/domain/findings/why-guidance";
import type { RootCauseAnalysis, WhyStep } from "@/domain/findings/types";
import { FiveWhysSupportPanel } from "@/app/(tenant)/t/[slug]/findings/FiveWhysSupportPanel";
import { INPUT_CLASS } from "@/components/ui";

const WARNING_LABELS: Record<string, string> = {
  blame: "Parece culpar a una persona: seguí preguntando por el sistema",
  vague: "Respuesta demasiado vaga o corta",
  symptom: "Parece un síntoma, no una causa",
  solution: "Parece una solución, no una causa",
  logic_gap: "Posible salto lógico",
};

/** Ramas guardadas sin ninguna respuesta no aportan nada: el usuario vuelve a elegir sus factores. */
function bootSteps(initial?: RootCauseAnalysis | null): WhyStep[] {
  if (!initial?.steps?.length) return [];
  const steps = normalizeWhySteps(initial.steps);
  const kept = new Set(
    factorBranches(steps)
      .filter((b) => b.steps.some((s) => s.answer.trim()))
      .map((b) => b.branchId),
  );
  return steps.filter((s) => kept.has(s.branchId));
}

function StepHeading({ n, title, done }: { n: number; title: string; done: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-base font-semibold text-[var(--color-ink)]">
        <span className="mr-2 font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-subtle)]">
          PASO {n}
        </span>
        {title}
      </h3>
      <span
        className={`rounded-[var(--radius-sm)] border px-2 py-0.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] ${
          done
            ? "border-[var(--color-success-line)] bg-[var(--color-success-soft)] text-[var(--color-success)]"
            : "border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-sunken)] text-[var(--color-ink-muted)]"
        }`}
      >
        {done ? "Completo" : "Falta"}
      </span>
    </div>
  );
}

export function FiveWhysLab({
  initial,
  userId,
  findingType,
  onConfirmed,
}: {
  initial?: RootCauseAnalysis | null;
  userId: string;
  findingType: string;
  onConfirmed: (rca: RootCauseAnalysis) => void;
}) {
  const factors = causeFactorsFor(findingType);
  const [statement, setStatement] = useState(initial?.problemStatement ?? "");
  const [sequence, setSequence] = useState(initial?.investigationSequence ?? "");
  const [checklist, setChecklist] = useState<string[]>(initial?.investigationChecklist ?? []);
  const [steps, setSteps] = useState<WhyStep[]>(() => bootSteps(initial));
  const [checkPrevent, setCheckPrevent] = useState(initial?.status === "confirmed");
  const [showExamples, setShowExamples] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const withQuestions = refreshWhyQuestions(steps, statement);
  const branches = factorBranches(withQuestions);
  const chosenLabels = new Set(branches.map((b) => b.label));
  // Ramas de análisis anteriores cuyo nombre ya no está en el catálogo: se muestran tal cual.
  const legacyBranches = branches.filter((b) => !factors.some((f) => f.label === b.label));
  const blockers = rootCauseBlockers({
    checklistCount: checklist.length,
    problemStatement: statement,
    steps,
    preventConfirmed: checkPrevent,
  });
  const rootsCount = branches.filter((b) => b.steps.some((s) => s.isRootCause)).length;

  function patchStep(id: string, patch: Partial<WhyStep>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function toggleFactor(label: string) {
    const branch = branches.find((b) => b.label === label);
    if (!branch) {
      try {
        setSteps((prev) => addFactorBranch(prev, label));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo agregar el factor");
      }
      return;
    }
    if (branch.steps.some((s) => s.answer.trim())) {
      setConfirmRemove(branch.branchId);
      return;
    }
    setSteps((prev) => prev.filter((s) => s.branchId !== branch.branchId));
  }

  function removeFactor(branchId: string) {
    setSteps((prev) => {
      const next = removeBranch(prev, branchId);
      // removeBranch repone un paso inicial si queda vacío; acá "sin factores" es un estado válido.
      return prev.every((s) => s.branchId === branchId) ? [] : next;
    });
    setConfirmRemove(null);
  }

  function askAgain(branchId: string) {
    try {
      setSteps((prev) => appendWhyStep(prev, branchId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar el nivel");
    }
  }

  function handleConfirm() {
    if (blockers.length > 0) return;
    try {
      const rca = confirmRootCause(withQuestions, userId, statement, {
        investigationChecklist: checklist,
        investigationSequence: sequence,
      });
      onConfirmed(rca);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo confirmar");
    }
  }

  const card =
    "flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-card-line)] bg-[var(--color-surface)] p-4";

  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--color-card-line)] bg-[var(--color-surface-raised)] p-5 shadow-[var(--shadow-soft)]">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl">Análisis de causa · 5 Porqués</h2>
        <p className="mt-1 max-w-prose text-sm text-[var(--color-ink-muted)]">
          Partí del hecho, elegí los factores que intervinieron y en cada uno preguntá «¿por qué?» hasta
          llegar a la causa raíz (mínimo {MIN_WHY_DEPTH} niveles).
        </p>
      </div>

      <FiveWhysSupportPanel />

      {/* Paso 1 */}
      <section className={card}>
        <StepHeading n={1} title="¿Qué hechos ya reuniste?" done={checklist.length >= 3} />
        <p className="-mt-2 text-sm text-[var(--color-ink-muted)]">
          Marcá lo que tenés documentado (al menos 3). Los porqués se responden con hechos, no con opiniones.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {INVESTIGATION_CHECKLIST.map((item) => (
            <li key={item.id}>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checklist.includes(item.id)}
                  onChange={() =>
                    setChecklist((prev) =>
                      prev.includes(item.id) ? prev.filter((x) => x !== item.id) : [...prev, item.id],
                    )
                  }
                  className="mt-0.5 size-4 accent-[var(--color-accent)]"
                />
                {item.label}
              </label>
            </li>
          ))}
        </ul>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold">Secuencia de lo ocurrido (opcional)</span>
          <textarea
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            rows={2}
            placeholder="Ej.: 08:10 baranda retirada → 08:25 ingreso de materiales → 08:40 caída"
            className={INPUT_CLASS}
          />
        </label>
      </section>

      {/* Paso 2 */}
      <section className={card}>
        <StepHeading n={2} title="¿Qué pasó exactamente?" done={Boolean(statement.trim())} />
        <ul className="-mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-ink-muted)]">
          {PROBLEM_STATEMENT_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold">Hecho comprobado</span>
          <textarea
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            rows={3}
            placeholder="Ej.: El 08/09 un operario sufrió atrapamiento de la mano al retirar una pieza trabada de la prensa PH-04."
            className={INPUT_CLASS}
          />
          <span className="text-xs text-[var(--color-ink-muted)]">
            Es el punto de partida del primer «¿por qué?» de cada factor.
          </span>
        </label>
        <div>
          <button
            type="button"
            onClick={() => setShowExamples((v) => !v)}
            aria-expanded={showExamples}
            className="text-sm font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
          >
            {showExamples ? "Ocultar ejemplos" : "Ver ejemplos de un hecho bien escrito"}
          </button>
          {showExamples ? (
            <ul className="mt-3 space-y-2">
              {PROBLEM_STATEMENT_EXAMPLES.map((example) => (
                <li key={example.label}>
                  <button
                    type="button"
                    onClick={() => setStatement(example.text)}
                    className="w-full rounded-[var(--radius-md)] border border-[var(--color-card-line)] bg-[var(--color-surface-raised)] px-3 py-2 text-left hover:border-[var(--color-accent)]"
                  >
                    <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-subtle)]">
                      {example.label} · usar este
                    </span>
                    <span className="mt-1 block text-sm text-[var(--color-ink-muted)]">{example.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {/* Paso 3 */}
      <section className={card}>
        <StepHeading n={3} title="¿Qué factores intervinieron?" done={branches.length > 0} />
        <p className="-mt-2 text-sm text-[var(--color-ink-muted)]">
          Elegí uno o más. Cada factor es una rama del árbol y se analiza por separado.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {factors.map((f) => {
            const on = chosenLabels.has(f.label);
            return (
              <button
                key={f.label}
                type="button"
                aria-pressed={on}
                onClick={() => toggleFactor(f.label)}
                className={`flex items-start gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-left ${
                  on
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-line-strong)] bg-[var(--color-surface-raised)] hover:border-[var(--color-accent)]"
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border text-[11px] font-bold ${
                    on
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-solid)]"
                      : "border-[var(--color-line-strong)]"
                  }`}
                >
                  {on ? "✓" : ""}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold ${on ? "text-[var(--color-accent-ink)]" : ""}`}>
                    {f.label}
                  </span>
                  <span className="block text-xs text-[var(--color-ink-muted)]">{f.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Paso 4 */}
      <section className={card}>
        <StepHeading
          n={4}
          title="Preguntá «¿por qué?» en cada factor"
          done={branches.length > 0 && rootsCount > 0 && blockers.every((b) => !b.includes("niveles vacíos"))}
        />
        {branches.length === 0 ? (
          <p className="-mt-2 text-sm text-[var(--color-ink-muted)]">
            Elegí un factor en el paso 3 y acá aparece su cadena de porqués.
          </p>
        ) : (
          <p className="-mt-2 text-sm text-[var(--color-ink-muted)]">
            Respondé cada nivel con un hecho verificable. Desde el nivel {MIN_WHY_DEPTH}, marcá el que, si se
            corrige, evita que se repita.
          </p>
        )}
        {[...branches.filter((b) => !legacyBranches.includes(b)), ...legacyBranches].map((branch) => {
          const last = branch.steps[branch.steps.length - 1]!;
          const hasRoot = branch.steps.some((s) => s.isRootCause);
          const canAsk = Boolean(last.answer.trim()) && branch.steps.length < MAX_WHY_DEPTH;
          return (
            <article
              key={branch.branchId}
              className={`rounded-[var(--radius-md)] border bg-[var(--color-surface-raised)] ${
                hasRoot ? "border-[var(--color-success-line)]" : "border-[var(--color-line-strong)]"
              }`}
            >
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] px-4 py-2.5">
                <h4 className="text-sm font-semibold">{branch.label}</h4>
                <span
                  className={`rounded-[var(--radius-sm)] border px-2 py-0.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] ${
                    hasRoot
                      ? "border-[var(--color-success-line)] bg-[var(--color-success-soft)] text-[var(--color-success)]"
                      : "border-dashed border-[var(--color-line-strong)] text-[var(--color-ink-muted)]"
                  }`}
                >
                  {hasRoot ? "★ Causa raíz" : `${branch.steps.length} ${branch.steps.length === 1 ? "nivel" : "niveles"}`}
                </span>
              </header>
              <ol className="flex flex-col">
                {branch.steps.map((step) => {
                  const guide = guideForWhyLevel(step.order);
                  const warnings = detectWhyAnswerWarnings(step.answer);
                  const canBeRoot = step.order >= MIN_WHY_DEPTH && step.answer.trim().length >= 12;
                  return (
                    <li
                      key={step.id}
                      className={`grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0 ${
                        step.isRootCause ? "bg-[var(--color-success-soft)]" : ""
                      }`}
                    >
                      <span
                        aria-hidden
                        className="flex size-7 items-center justify-center rounded-full border border-[var(--color-line-strong)] font-[family-name:var(--font-mono)] text-xs"
                      >
                        {step.order}
                      </span>
                      <div className="flex min-w-0 flex-col gap-2">
                        <label htmlFor={`why-${step.id}`} className="text-sm font-medium break-words">
                          {step.question}
                        </label>
                        <textarea
                          id={`why-${step.id}`}
                          value={step.answer}
                          onChange={(e) => patchStep(step.id, { answer: e.target.value })}
                          rows={2}
                          placeholder={`Ej.: ${guide.goodExample}`}
                          className={INPUT_CLASS}
                        />
                        <p className="text-xs text-[var(--color-ink-muted)]">
                          <span className="font-semibold">{guide.title}:</span> {guide.ask}
                        </p>
                        <input
                          value={step.evidenceNote ?? ""}
                          onChange={(e) => patchStep(step.id, { evidenceNote: e.target.value })}
                          placeholder="Evidencia que lo respalda (opcional): registro, foto, testimonio…"
                          aria-label={`Evidencia del nivel ${step.order}`}
                          className={INPUT_CLASS}
                        />
                        {warnings.length > 0 ? (
                          <ul className="flex flex-wrap gap-2">
                            {warnings.map((w) => (
                              <li
                                key={w}
                                className="rounded-[var(--radius-sm)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] px-2 py-0.5 text-xs text-[var(--color-warning)]"
                              >
                                {WARNING_LABELS[w] ?? w}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {step.isRootCause ? (
                          <p className="text-sm font-semibold text-[var(--color-success)]">★ Causa raíz de este factor</p>
                        ) : canBeRoot ? (
                          <button
                            type="button"
                            onClick={() => setSteps((prev) => markStepAsRoot(prev, step.id))}
                            className="w-fit rounded-[var(--radius-md)] border border-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
                          >
                            Es la causa raíz
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
              <footer className="flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] px-4 py-3">
                <button
                  type="button"
                  onClick={() => askAgain(branch.branchId)}
                  disabled={!canAsk}
                  className="rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  + ¿Por qué? (nivel {last.order + 1})
                </button>
                {!last.answer.trim() ? (
                  <span className="text-xs text-[var(--color-ink-muted)]">Respondé el nivel {last.order} para seguir.</span>
                ) : null}
                {branch.steps.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setSteps((prev) => removeLastWhyStep(prev, branch.branchId))}
                    className="text-sm text-[var(--color-ink-muted)] underline-offset-2 hover:underline"
                  >
                    Quitar el último nivel
                  </button>
                ) : null}
                <span className="flex-1" />
                {confirmRemove === branch.branchId ? (
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    ¿Quitar este factor y sus respuestas?
                    <button
                      type="button"
                      onClick={() => removeFactor(branch.branchId)}
                      className="rounded-[var(--radius-md)] border border-[var(--color-danger)] px-2 py-1 text-xs font-semibold text-[var(--color-danger)]"
                    >
                      Quitar
                    </button>
                    <button type="button" onClick={() => setConfirmRemove(null)} className="text-xs underline">
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(branch.branchId)}
                    className="text-sm text-[var(--color-danger)] underline-offset-2 hover:underline"
                  >
                    Quitar factor
                  </button>
                )}
              </footer>
            </article>
          );
        })}
      </section>

      {/* Paso 5 */}
      <section className={card}>
        <StepHeading n={5} title="Confirmar la causa raíz" done={blockers.length === 0} />
        <label className="inline-flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={checkPrevent}
            onChange={(e) => setCheckPrevent(e.target.checked)}
            className="mt-1 size-4 accent-[var(--color-accent)]"
          />
          Si corregimos las causas raíz marcadas, el hecho no debería repetirse.
        </label>
        {blockers.length > 0 ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] px-3 py-2 text-sm text-[var(--color-warning)]">
            <p className="font-semibold">Para confirmar falta:</p>
            <ul className="mt-1 list-disc pl-5">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={blockers.length > 0}
          className="w-fit rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-solid)] disabled:cursor-not-allowed disabled:bg-[var(--color-line)] disabled:text-[var(--color-ink-muted)]"
        >
          {rootsCount > 1 ? `Confirmar ${rootsCount} causas raíz` : "Confirmar causa raíz"}
        </button>
      </section>
    </div>
  );
}
