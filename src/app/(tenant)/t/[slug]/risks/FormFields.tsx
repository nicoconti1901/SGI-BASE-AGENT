"use client";

import { useState } from "react";
import Link from "next/link";
import { FIELD_HINTS, SOURCE_GUIDANCE } from "@/domain/risks/guide";
import {
  SOURCE_KIND_LABELS,
  SOURCE_KINDS,
  type SourceKind,
} from "@/domain/risks/types";

export type FindingOpt = { id: string; title: string; type: string };

const inputClass =
  "rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? (
        <span className="text-xs text-[var(--color-ink-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

/** Tipo de fuente + descripción, con la pregunta que ayuda a pensar esa fuente. */
export function SourceFields({
  findings,
  sourceRequired = true,
}: {
  findings: FindingOpt[];
  sourceRequired?: boolean;
}) {
  const [kind, setKind] = useState<SourceKind>("process");
  const guidance = SOURCE_GUIDANCE[kind];

  return (
    <div className="flex flex-col gap-3">
      <Field label="Tipo de fuente">
        <select
          name="sourceKind"
          value={kind}
          onChange={(e) => setKind(e.target.value as SourceKind)}
          className={inputClass}
        >
          {SOURCE_KINDS.map((k) => (
            <option key={k} value={k}>
              {SOURCE_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </Field>
      <p className="rounded-md bg-[var(--color-accent-soft)] px-3 py-2 text-sm text-[var(--color-accent-ink)]">
        {guidance.question}
      </p>
      <Field label="¿Cuál?" hint={FIELD_HINTS.sourceLabel}>
        <input
          name="sourceLabel"
          required={sourceRequired}
          placeholder={`Ej.: ${guidance.example}`}
          className={inputClass}
        />
      </Field>
      {findings.length > 0 ? (
        <Field label="Hallazgo relacionado (opcional)">
          <select name="findingId" defaultValue="" className={inputClass}>
            <option value="">— Ninguno —</option>
            {findings.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
    </div>
  );
}

export function RiskStatementFields({
  titleName = "title",
  titleRequired = false,
}: {
  titleName?: string;
  titleRequired?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Título" hint={titleRequired ? "Frase corta para reconocerlo en la lista." : "Si lo dejás vacío se usa la fuente."}>
        <input
          name={titleName}
          required={titleRequired}
          placeholder="Ej.: Corte de abastecimiento de acero"
          className={inputClass}
        />
      </Field>
      <Field label="Causa" hint={FIELD_HINTS.cause}>
        <input name="cause" className={inputClass} />
      </Field>
      <Field label="Evento" hint={FIELD_HINTS.event}>
        <input name="event" className={inputClass} />
      </Field>
      <Field label="Efecto" hint={FIELD_HINTS.effect}>
        <input name="effect" className={inputClass} />
      </Field>
      <Field label="Controles existentes" hint={FIELD_HINTS.existingControls}>
        <textarea name="existingControls" rows={2} className={inputClass} />
      </Field>
    </div>
  );
}

export function OpportunityFields({
  titleName = "title",
  titleRequired = false,
}: {
  titleName?: string;
  titleRequired?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Título" hint={titleRequired ? "Frase corta para reconocerla en la lista." : "Si lo dejás vacío se usa la fuente."}>
        <input
          name={titleName}
          required={titleRequired}
          placeholder="Ej.: Automatizar carga de pedidos"
          className={inputClass}
        />
      </Field>
      <Field label="Situación actual" hint={FIELD_HINTS.condition}>
        <input name="condition" className={inputClass} />
      </Field>
      <Field label="Circunstancia favorable" hint={FIELD_HINTS.circumstance}>
        <input name="circumstance" className={inputClass} />
      </Field>
      <Field label="Beneficio esperado" hint={FIELD_HINTS.benefit}>
        <input name="benefit" className={inputClass} />
      </Field>
    </div>
  );
}

export function GuideLink({ slug }: { slug: string }) {
  return (
    <Link href={`/t/${slug}/risks/guia`} className="text-sm text-[var(--color-accent)] hover:underline">
      ¿Dudas? Ver guía para identificar →
    </Link>
  );
}
