"use client";

import { useState } from "react";
import { Field, HintCallout, INPUT_CLASS } from "@/components/ui";
import { PersonPicker } from "@/components/pickers/PersonPicker";
import type { PersonOption } from "@/components/pickers/picker-actions";
import {
  ACCIDENT_FORMS,
  BODY_PARTS,
  CLASSIFICATION_HINTS,
  CLASSIFICATION_LABELS,
  EMPLOYER_LABELS,
  LABOR_CLASSIFICATIONS,
  INJURY_CLASSIFICATIONS,
  MATERIAL_AGENTS,
  NATURES_OF_INJURY,
  type EmployerKind,
  type IncidentClassification,
} from "@/domain/safety-stats/types";

export type SiteOption = { id: string; name: string };

export type FactDefaults = {
  siteId?: string;
  /** "AAAA-MM-DDTHH:mm" en hora local. */
  occurredAt?: string;
  classification?: IncidentClassification;
  inItinere?: boolean;
  isRoad?: boolean;
  employerKind?: EmployerKind;
  restrictedWork?: boolean;
  accidentForm?: string;
  materialAgent?: string;
  returnToWorkDate?: string;
  chargePct?: string;
};

const checkboxClass =
  "h-4 w-4 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] accent-[var(--color-accent)]";

function OptionSelect({
  name,
  options,
  defaultValue,
  required,
  placeholder,
}: {
  name: string;
  options: readonly { key: string; label: string }[];
  defaultValue?: string | null;
  required?: boolean;
  placeholder: string;
}) {
  return (
    <select name={name} required={required} defaultValue={defaultValue ?? ""} className={INPUT_CLASS}>
      <option value="" disabled={required}>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Bloques «¿Qué pasó?» y «¿Cuántos días de baja?». Los días y la clasificación son del administrador
 * y del responsable de proceso: `showDays` los habilita; `lockClassification` deja la clasificación fija.
 */
export function FactFields({
  sites,
  defaults = {},
  showDays,
  lockClassification,
  onClassificationChange,
}: {
  sites: SiteOption[];
  defaults?: FactDefaults;
  showDays: boolean;
  lockClassification?: boolean;
  onClassificationChange?: (c: IncidentClassification) => void;
}) {
  const [classification, setClassification] = useState<IncidentClassification>(defaults.classification ?? "near_miss");
  const change = (c: IncidentClassification) => {
    setClassification(c);
    onClassificationChange?.(c);
  };

  return (
    <fieldset className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
      <legend className="px-1 font-[family-name:var(--font-display)] text-base font-semibold">¿Qué pasó?</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha y hora" required>
          <input type="datetime-local" name="fact_occurredAt" required defaultValue={defaults.occurredAt} className={INPUT_CLASS} />
        </Field>
        <Field label="Sede" required>
          <select name="fact_siteId" required defaultValue={defaults.siteId ?? ""} className={INPUT_CLASS}>
            <option value="" disabled>
              Elegí una sede
            </option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {lockClassification ? (
        <input type="hidden" name="fact_classification" value={classification} />
      ) : (
        <Field label="¿Hubo lesión? ¿Cuánto se perdió?" hint={CLASSIFICATION_HINTS[classification]} required>
          <select
            name="fact_classification"
            value={classification}
            onChange={(e) => change(e.target.value as IncidentClassification)}
            className={INPUT_CLASS}
          >
            {LABOR_CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {CLASSIFICATION_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="¿Personal propio o contratista?" required>
          <select name="fact_employerKind" defaultValue={defaults.employerKind ?? "own"} className={INPUT_CLASS}>
            {(Object.keys(EMPLOYER_LABELS) as EmployerKind[]).map((k) => (
              <option key={k} value={k}>
                {EMPLOYER_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-col justify-end gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="fact_inItinere" defaultChecked={defaults.inItinere} className={checkboxClass} />
            Fue en el trayecto de ida o vuelta al trabajo
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="fact_isRoad" defaultChecked={defaults.isRoad} className={checkboxClass} />
            Fue un hecho de tránsito
          </label>
          {classification === "no_lost_time" ? (
            <label className="flex items-center gap-2">
              <input type="checkbox" name="fact_restrictedWork" defaultChecked={defaults.restrictedWork} className={checkboxClass} />
              Volvió con tareas restringidas
            </label>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Forma del accidente" required>
          <OptionSelect name="fact_accidentForm" options={ACCIDENT_FORMS} defaultValue={defaults.accidentForm} required placeholder="Elegí la forma" />
        </Field>
        <Field label="Agente" hint="Lo que causó o se vio involucrado en la lesión." required>
          <OptionSelect name="fact_materialAgent" options={MATERIAL_AGENTS} defaultValue={defaults.materialAgent} required placeholder="Elegí el agente" />
        </Field>
      </div>

      {showDays && classification === "lost_time" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Fecha de reintegro"
            hint="Dejala vacía si sigue de baja: el sistema cuenta los días hasta hoy y te avisa para actualizarlos."
          >
            <input type="date" name="fact_returnToWorkDate" defaultValue={defaults.returnToWorkDate} className={INPUT_CLASS} />
          </Field>
          <Field label="Incapacidad permanente (%)" hint="Solo si hay. Suma un cargo proporcional al índice de gravedad.">
            <input
              type="number"
              name="fact_chargePct"
              min={0}
              max={100}
              step="0.01"
              inputMode="decimal"
              defaultValue={defaults.chargePct}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      ) : null}
    </fieldset>
  );
}

export type HealthDefaults = {
  person?: PersonOption | null;
  natureOfInjury?: string | null;
  bodyPart?: string | null;
  artClaimNumber?: string | null;
  deathDate?: string | null;
};

/** Bloque «¿A quién?» y «¿Qué lesión?». Lo completan el administrador y el responsable de proceso. */
export function HealthFields({
  slug,
  classification,
  defaults = {},
}: {
  slug: string;
  classification: IncidentClassification;
  defaults?: HealthDefaults;
}) {
  const hasInjury = INJURY_CLASSIFICATIONS.includes(classification);
  return (
    <fieldset className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
      <legend className="px-1 font-[family-name:var(--font-display)] text-base font-semibold">¿A quién? ¿Qué lesión?</legend>
      <HintCallout>Datos de salud: los ven todos los usuarios de la empresa y cada consulta queda registrada.</HintCallout>
      <PersonPicker
        slug={slug}
        name="health_personId"
        label="Persona afectada"
        required={hasInjury}
        hint={hasInjury ? undefined : "En un casi accidente no hace falta."}
        defaultPerson={defaults.person}
      />
      {hasInjury ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Naturaleza de la lesión">
              <OptionSelect name="health_nature" options={NATURES_OF_INJURY} defaultValue={defaults.natureOfInjury} placeholder="Sin indicar" />
            </Field>
            <Field label="Parte del cuerpo">
              <OptionSelect name="health_bodyPart" options={BODY_PARTS} defaultValue={defaults.bodyPart} placeholder="Sin indicar" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="N.° de denuncia a la ART" hint="Si ya se hizo.">
              <input name="health_art" maxLength={60} defaultValue={defaults.artClaimNumber ?? ""} className={INPUT_CLASS} />
            </Field>
            {classification === "fatal" ? (
              <Field label="Fecha de la muerte">
                <input type="date" name="health_deathDate" defaultValue={defaults.deathDate ?? ""} className={INPUT_CLASS} />
              </Field>
            ) : null}
          </div>
        </>
      ) : null}
      <p className="text-xs text-[var(--color-ink-muted)]">
        No cargues diagnósticos ni historia clínica: este registro solo lleva lo necesario para los índices.
      </p>
    </fieldset>
  );
}

/** Todo el paso «Ficha de accidente» del alta de un incidente. */
export function NewIncidentFields({
  slug,
  sites,
  canManageHealth,
}: {
  slug: string;
  sites: SiteOption[];
  canManageHealth: boolean;
}) {
  const [classification, setClassification] = useState<IncidentClassification>("near_miss");
  return (
    <div className="flex flex-col gap-4">
      <HintCallout>
        Es el paso «Ficha de accidente». Evitá escribir diagnósticos en el título o la descripción: los ve toda la empresa.
      </HintCallout>
      <FactFields sites={sites} showDays={canManageHealth} onClassificationChange={setClassification} />
      {canManageHealth ? (
        <HealthFields slug={slug} classification={classification} />
      ) : (
        <p className="text-sm text-[var(--color-ink-muted)]">
          La persona afectada y la lesión las completa después el administrador o el responsable de proceso.
        </p>
      )}
    </div>
  );
}
