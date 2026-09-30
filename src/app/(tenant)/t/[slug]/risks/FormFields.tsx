"use client";

import { useState } from "react";
import Link from "next/link";
import { FIELD_HINTS, SOURCE_GUIDANCE } from "@/domain/risks/guide";
import {
  SOURCE_KIND_LABELS,
  SOURCE_KINDS,
  type SourceKind,
} from "@/domain/risks/types";
import { Field, HintCallout, INPUT_CLASS } from "@/components/ui";

export type FindingOpt = { id: string; title: string; type: string };

/** Tipo de fuente + descripción, con la pregunta que ayuda a pensar esa fuente. */
export function SourceFields({
  findings,
  sourceRequired = true,
  initial,
}: {
  findings: FindingOpt[];
  sourceRequired?: boolean;
  initial?: { kind?: SourceKind; label?: string; findingId?: string };
}) {
  const [kind, setKind] = useState<SourceKind>(initial?.kind ?? "process");
  const guidance = SOURCE_GUIDANCE[kind];

  return (
    <div className="flex flex-col gap-3">
      <Field label="Tipo de fuente">
        <select
          name="sourceKind"
          value={kind}
          onChange={(e) => setKind(e.target.value as SourceKind)}
          className={INPUT_CLASS}
        >
          {SOURCE_KINDS.map((k) => (
            <option key={k} value={k}>
              {SOURCE_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </Field>
      <HintCallout>{guidance.question}</HintCallout>
      <Field label="¿Cuál?" hint={FIELD_HINTS.sourceLabel}>
        <input
          name="sourceLabel"
          defaultValue={initial?.label}
          required={sourceRequired}
          placeholder={`Ej.: ${guidance.example}`}
          className={INPUT_CLASS}
        />
      </Field>
      {findings.length > 0 ? (
        <Field label="Hallazgo relacionado (opcional)">
          <select
            name="findingId"
            defaultValue={initial?.findingId ?? ""}
            className={INPUT_CLASS}
          >
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
      <Field
        label="Título"
        hint={
          titleRequired
            ? "Frase corta para reconocerlo en la lista."
            : "Si lo dejás vacío se usa la fuente."
        }
      >
        <input
          name={titleName}
          required={titleRequired}
          placeholder="Ej.: Corte de abastecimiento de acero"
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Causa" hint={FIELD_HINTS.cause}>
        <input name="cause" className={INPUT_CLASS} />
      </Field>
      <Field label="Evento" hint={FIELD_HINTS.event}>
        <input name="event" className={INPUT_CLASS} />
      </Field>
      <Field label="Efecto" hint={FIELD_HINTS.effect}>
        <input name="effect" className={INPUT_CLASS} />
      </Field>
      <Field label="Controles existentes" hint={FIELD_HINTS.existingControls}>
        <textarea name="existingControls" rows={2} className={INPUT_CLASS} />
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
      <Field
        label="Título"
        hint={
          titleRequired
            ? "Frase corta para reconocerla en la lista."
            : "Si lo dejás vacío se usa la fuente."
        }
      >
        <input
          name={titleName}
          required={titleRequired}
          placeholder="Ej.: Automatizar carga de pedidos"
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Situación actual" hint={FIELD_HINTS.condition}>
        <input name="condition" className={INPUT_CLASS} />
      </Field>
      <Field label="Circunstancia favorable" hint={FIELD_HINTS.circumstance}>
        <input name="circumstance" className={INPUT_CLASS} />
      </Field>
      <Field label="Beneficio esperado" hint={FIELD_HINTS.benefit}>
        <input name="benefit" className={INPUT_CLASS} />
      </Field>
    </div>
  );
}

export function GuideLink({ slug }: { slug: string }) {
  return (
    <Link
      href={`/t/${slug}/risks/guia`}
      className="text-sm text-[var(--color-accent)] hover:underline"
    >
      ¿Dudas? Ver guía para identificar →
    </Link>
  );
}