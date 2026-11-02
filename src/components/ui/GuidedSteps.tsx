"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/** Lectura del formulario para armar los resúmenes de los pasos ya completos. */
export type FormReader = {
  /** Valor de un campo: el texto elegido en un select, el valor de un radio marcado, el texto de un input. */
  get: (name: string) => string;
  /** Todos los marcados de un grupo de checkboxes (el texto de su etiqueta). */
  all: (name: string) => string[];
};

export type SummaryItem = { label: string; value: string };

export type GuidedStep = {
  key: string;
  /** Nombre corto en el riel lateral. */
  label: string;
  /** Título del paso, como pregunta: «¿Qué querés lograr?». */
  title: string;
  hint?: string;
  content: ReactNode;
  /** Qué se muestra cuando el paso queda completo. */
  summarize: (read: FormReader) => SummaryItem[];
  /** Devuelve el motivo por el que todavía no se puede seguir, o null. */
  validate?: (read: FormReader) => string | null;
};

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function readerOf(form: HTMLFormElement): FormReader {
  const controls = (name: string) =>
    Array.from(form.elements).filter((e): e is Control => (e as Control).name === name);

  const text = (el: Control): string => {
    if (el instanceof HTMLSelectElement) {
      const option = el.selectedOptions[0];
      return option && option.value ? (option.textContent ?? "").trim() : "";
    }
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      return el.checked ? (el.closest("label")?.textContent ?? el.value).trim() : "";
    }
    if (el instanceof HTMLInputElement && el.type === "radio") return el.checked ? el.value : "";
    return el.value.trim();
  };

  return {
    get: (name) => controls(name).map(text).find(Boolean) ?? "",
    all: (name) => controls(name).map(text).filter(Boolean),
  };
}

const PRIMARY =
  "rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-on-solid)] disabled:opacity-60";
const SECONDARY =
  "rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 py-2 text-sm font-medium hover:border-[var(--color-accent)]";

/**
 * Formulario por pasos (alternativa B): un paso a la vez con riel lateral. Lo completo queda como resumen
 * con «Editar»; lo que sigue se ve atenuado. Todos los pasos viven dentro del mismo <form>: los campos de
 * los pasos que no se están mostrando siguen montados (ocultos), así se envía todo junto al final.
 */
export function GuidedSteps({
  steps,
  submitLabel,
  pending = false,
}: {
  steps: GuidedStep[];
  submitLabel: string;
  pending?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const boxes = useRef<(HTMLDivElement | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState<Record<number, SummaryItem[]>>({});
  const [error, setError] = useState<string | null>(null);
  const last = steps.length - 1;

  function go(index: number) {
    setError(null);
    setCurrent(index);
  }

  function advance(index: number) {
    const box = boxes.current[index];
    const form = root.current?.closest("form");
    if (!box || !form) return;
    for (const control of Array.from(box.querySelectorAll<Control>("input, select, textarea"))) {
      if (!control.checkValidity()) {
        control.reportValidity();
        return;
      }
    }
    const read = readerOf(form);
    const message = steps[index]!.validate?.(read) ?? null;
    if (message) {
      setError(message);
      return;
    }
    const next = { ...done, [index]: steps[index]!.summarize(read) };
    setDone(next);
    const firstOpen = steps.findIndex((_, i) => !(i in next));
    go(firstOpen === -1 ? last : firstOpen);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    // Enter en un campo de texto sigue al paso siguiente en lugar de enviar el formulario a medias.
    if (e.key === "Enter" && current !== last && target.tagName === "INPUT") {
      e.preventDefault();
      advance(current);
    }
  }

  return (
    <div
      ref={root}
      onKeyDown={onKeyDown}
      className="grid gap-5 sm:grid-cols-[13rem_minmax(0,1fr)]"
    >
      <ol aria-label="Pasos" className="flex flex-row gap-1 sm:flex-col sm:border-l-2 sm:border-[var(--color-line)]">
        {steps.map((step, i) => {
          const isDone = i in done;
          const isCurrent = i === current;
          const body = (
            <>
              <span
                className={`block font-[family-name:var(--font-mono)] text-[11px] tracking-[0.06em] ${
                  isDone && !isCurrent ? "text-[var(--color-success)]" : "text-[var(--color-ink-subtle)]"
                }`}
              >
                {String(i + 1).padStart(2, "0")} · {isCurrent ? "AHORA" : isDone ? "COMPLETO" : "DESPUÉS"}
              </span>
              {step.label}
            </>
          );
          const tone = isCurrent
            ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] font-semibold text-[var(--color-accent-ink)]"
            : "border-transparent text-[var(--color-ink-muted)]";
          return (
            <li key={step.key} aria-current={isCurrent ? "step" : undefined} className="min-w-0 flex-1 sm:flex-none">
              {isDone && !isCurrent ? (
                <button
                  type="button"
                  onClick={() => go(i)}
                  className={`w-full rounded-[var(--radius-sm)] border-l-2 px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-sunken)] sm:-ml-0.5 ${tone}`}
                >
                  {body}
                </button>
              ) : (
                <div className={`rounded-[var(--radius-sm)] border-l-2 px-3 py-2 text-sm sm:-ml-0.5 ${tone}`}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex min-w-0 flex-col gap-3">
        {steps.map((step, i) => {
          const isCurrent = i === current;
          const summary = done[i];
          const card = isCurrent
            ? "border-[var(--color-accent)] shadow-[0_0_0_3px_var(--color-accent-ring)] p-5"
            : summary
              ? "border-[var(--color-line)] px-4 py-3"
              : "border-dashed border-[var(--color-line-strong)] px-4 py-3";
          return (
            <section
              key={step.key}
              className={`flex flex-col gap-4 rounded-[var(--radius-lg)] border bg-[var(--color-surface-raised)] ${card}`}
            >
              {isCurrent ? (
                <div>
                  <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
                    Paso {i + 1} de {steps.length}
                  </p>
                  <h3 className="font-[family-name:var(--font-display)] text-xl">{step.title}</h3>
                  {step.hint ? <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{step.hint}</p> : null}
                </div>
              ) : summary ? (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <dl className="grid min-w-0 gap-x-6 gap-y-1 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
                    <dt className="font-semibold sm:col-span-2">{step.title}</dt>
                    {summary.map((item) => (
                      <div key={item.label} className="contents">
                        <dt className="text-[var(--color-ink-muted)]">{item.label}</dt>
                        <dd className="break-words font-medium">
                          {item.value || <span className="text-[var(--color-ink-muted)]">—</span>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <button type="button" onClick={() => go(i)} className="text-sm font-medium text-[var(--color-accent)] underline underline-offset-2">
                    Editar
                  </button>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-ink-muted)]">
                  <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.06em]">
                    {String(i + 1).padStart(2, "0")} ·{" "}
                  </span>
                  {step.title}
                </p>
              )}

              <div
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                hidden={!isCurrent}
                className="flex flex-col gap-4"
              >
                {step.content}
              </div>

              {isCurrent ? (
                <>
                  {error ? (
                    <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] px-3 py-2 text-sm text-[var(--color-warning)]">
                      {error}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {i > 0 ? (
                      <button type="button" onClick={() => go(i - 1)} className={SECONDARY}>
                        Volver
                      </button>
                    ) : null}
                    {i === last ? (
                      <button type="submit" disabled={pending} className={PRIMARY}>
                        {pending ? "Guardando…" : submitLabel}
                      </button>
                    ) : (
                      <button type="button" onClick={() => advance(i)} className={PRIMARY}>
                        Guardar y seguir
                      </button>
                    )}
                  </div>
                </>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
