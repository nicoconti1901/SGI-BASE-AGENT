import Link from "next/link";
import type { ReactNode } from "react";

export type RecordFact = {
  label: string;
  value: string;
  /** Resalta un dato que pide atención (vencido, sin responsable…). */
  tone?: "danger" | "warning";
};

export type RecordItem = {
  id: string;
  href: string;
  /** Tipo de registro: "Riesgo", "Oportunidad", "Objetivo"… */
  kind: string;
  code?: string;
  title: string;
  /** Una línea que explica de qué se trata (causa → efecto, beneficio, meta…). */
  summary?: string;
  facts: RecordFact[];
  chip?: ReactNode;
  /** Contenido anidado, p. ej. los indicadores de un objetivo. */
  children?: ReactNode;
};

const FACT_TONE = {
  danger: "text-[var(--color-danger)]",
  warning: "text-[var(--color-warning)]",
} as const;

export function RecordFacts({ facts }: { facts: RecordFact[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
      {facts.map((f) => (
        <div key={f.label} className="min-w-0">
          <dt className="text-xs text-[var(--color-ink-muted)]">{f.label}</dt>
          <dd className={`break-words text-sm font-medium ${f.tone ? FACT_TONE[f.tone] : ""}`}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Tarjeta de registro: qué es, de qué se trata, sus datos clave y su estado, de un vistazo. */
export function RecordCard({ href, kind, code, title, summary, facts, chip, children }: RecordItem) {
  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4 shadow-[var(--shadow-card)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-[var(--color-line-strong)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
              {kind}
            </span>
            {code ? (
              <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">{code}</span>
            ) : null}
          </p>
          <Link
            href={href}
            className="mt-1 block break-words font-[family-name:var(--font-display)] text-lg leading-snug hover:text-[var(--color-accent)] hover:underline"
          >
            {title}
          </Link>
          {summary ? <p className="mt-0.5 break-words text-sm text-[var(--color-ink-muted)]">{summary}</p> : null}
        </div>
        {chip ?? null}
      </div>
      {facts.length > 0 ? <RecordFacts facts={facts} /> : null}
      {children}
    </li>
  );
}

export function RecordList({ items, "aria-label": ariaLabel }: { items: RecordItem[]; "aria-label"?: string }) {
  return (
    <ul aria-label={ariaLabel} className="flex flex-col gap-3">
      {items.map((item) => (
        <RecordCard key={item.id} {...item} />
      ))}
    </ul>
  );
}
