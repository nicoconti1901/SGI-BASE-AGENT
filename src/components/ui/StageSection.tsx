"use client";

import type { ReactNode } from "react";

const chip =
  "rounded-[var(--radius-sm)] border px-2 py-0.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em]";

/**
 * Sección de la ficha: completa = resumen confirmado con «Editar»; incompleta = resaltada con lo que
 * falta y el formulario abierto. `blocked` = todavía no se puede completar (falta un paso anterior).
 */
export function StageSection({
  title,
  done,
  current,
  missingNote,
  blockedNote,
  canWrite,
  editing,
  onEdit,
  onCancel,
  summary,
  form,
}: {
  title: string;
  done: boolean;
  current: boolean;
  missingNote?: string;
  blockedNote?: string;
  canWrite: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  summary: ReactNode;
  form: ReactNode;
}) {
  const showForm = canWrite && !blockedNote && (editing || !done);
  const tone = done
    ? "border-[var(--color-line)]"
    : current
      ? "border-[var(--color-warning)] shadow-[0_0_0_3px_var(--color-warning-soft)]"
      : "border-dashed border-[var(--color-line-strong)]";

  return (
    <section className={`flex flex-col gap-4 rounded-[var(--radius-lg)] border bg-[var(--color-surface-raised)] p-5 ${tone} ${showForm ? "sgi-form" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl">{title}</h2>
        <div className="flex items-center gap-2">
          <span
            className={`${chip} ${
              done
                ? "border-[var(--color-success-line)] bg-[var(--color-success-soft)] text-[var(--color-success)]"
                : current
                  ? "border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
                  : "border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-sunken)] text-[var(--color-ink-muted)]"
            }`}
          >
            {done ? "Completo" : current ? "Falta · impide avanzar" : "Pendiente"}
          </span>
          {canWrite && done && !editing && !blockedNote ? (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-3 py-1 text-sm font-medium hover:border-[var(--color-accent)]"
            >
              Editar
            </button>
          ) : null}
          {editing && done ? (
            <button type="button" onClick={onCancel} className="text-sm text-[var(--color-ink-muted)] underline-offset-2 hover:underline">
              Cancelar
            </button>
          ) : null}
        </div>
      </header>
      {!done && current && missingNote && !blockedNote ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] px-3 py-2 text-sm text-[var(--color-warning)]">
          {missingNote}
        </p>
      ) : null}
      {blockedNote ? <p className="text-sm text-[var(--color-ink-muted)]">{blockedNote}</p> : null}
      {done && !editing ? summary : null}
      {showForm ? form : null}
      {!canWrite && !done && !blockedNote ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Pendiente de completar.</p>
      ) : null}
    </section>
  );
}

/** Resumen de solo lectura: etiqueta → valor. */
export function Summary({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)]">
      {items.map((it) => (
        <div key={it.label} className="contents">
          <dt className="text-[var(--color-ink-muted)]">{it.label}</dt>
          <dd className="break-words font-medium">{it.value || <span className="text-[var(--color-warning)]">Sin completar</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Opciones con su explicación a la vista (en lugar de un desplegable con nombres sueltos). */
export function ChoiceCards<T extends string>({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: { value: T; label: string; hint: string }[];
  defaultValue?: T | null;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <label
          key={o.value}
          className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-2.5 hover:border-[var(--color-accent)] has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent-soft)]"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            required
            defaultChecked={defaultValue === o.value}
            className="mt-1 size-4 accent-[var(--color-accent)]"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{o.label}</span>
            <span className="block text-xs text-[var(--color-ink-muted)]">{o.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
