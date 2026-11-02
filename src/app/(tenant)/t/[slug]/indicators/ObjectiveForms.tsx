"use client";

import { Field, GuidedSteps, INPUT_CLASS, type GuidedStep } from "@/components/ui";

import { useActionState, useState } from "react";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import {
  closeObjectiveAction,
  createIndicatorAction,
  createObjectiveAction,
  setIndicatorActiveAction,
  updateIndicatorAction,
  updateObjectiveAction,
  type IndicatorActionState,
} from "@/app/(tenant)/t/[slug]/indicators/actions";
import { AUDIT_STANDARD_LABELS, type AuditStandard } from "@/domain/audits/types";
import {
  FREQUENCY_LABELS,
  KIND_HINTS,
  KIND_LABELS,
  MEASUREMENT_STATUS_LABELS,
  MEASUREMENT_STATUS_TONE,
  type IndicatorDirection,
  type IndicatorFrequency,
  type IndicatorKind,
} from "@/domain/indicators/types";
import {
  EVALUATION_SUGGESTIONS,
  MAX_PLAN_STEPS,
  RESOURCE_SUGGESTIONS,
  type PlanStep,
} from "@/domain/indicators/plan";
import { statusBands, suggestAlertThreshold, UNIT_SUGGESTIONS } from "@/domain/indicators/bands";
import { indicatorDefinitionIssues } from "@/domain/indicators/rules";

const initial: IndicatorActionState = {};
export const primary =
  "self-start rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-on-solid)] disabled:opacity-60";
export const saveChanges =
  "self-start rounded-md border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-4 py-2 text-sm font-medium text-[var(--color-accent)] disabled:opacity-60";
export const secondary =
  "self-start rounded-md border border-[var(--color-card-line)] px-4 py-2 text-sm font-medium disabled:opacity-60";

const chipButton =
  "rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-[var(--color-surface-raised)] px-2 py-1 text-xs font-medium hover:border-[var(--color-accent)] hover:text-[var(--color-accent-ink)]";
const radioCard =
  "flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-2.5 hover:border-[var(--color-accent)] has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent-soft)]";
const group = "sgi-form flex flex-col gap-4 p-5";
const legend = "px-1 font-[family-name:var(--font-display)] text-lg";

export type MemberOption = { id: string; name: string };

export function Feedback({ state }: { state: IndicatorActionState }) {
  if (state.issues?.length) {
    return (
      <div
        role="alert"
        className="rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] px-3 py-2 text-sm text-[var(--color-warning)]"
      >
        <p className="font-medium">Falta:</p>
        <ul className="mt-1 list-disc pl-5">
          {state.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]"
      >
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p role="status" className="text-sm text-[var(--color-success)]">
        {state.ok}
      </p>
    );
  }
  return null;
}


function MemberSelect({
  name,
  label,
  hint,
  members,
  defaultValue,
}: {
  name: string;
  label: string;
  hint?: string;
  members: MemberOption[];
  defaultValue?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <select name={name} required defaultValue={defaultValue ?? ""} className={INPUT_CLASS}>
        <option value="" disabled>
          Elegí una persona
        </option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

// ─── Objetivo ───────────────────────────────────────────────────────────────

export type ObjectiveDefaults = {
  title: string;
  description: string;
  standards: AuditStandard[];
  ownerUserId: string;
  dueDate: string;
  /** Texto libre de objetivos anteriores al plan estructurado; se conserva tal cual. */
  plan: string;
  planSteps: PlanStep[];
  planResources: string;
  planEvaluation: string;
};

const EMPTY_STEP: PlanStep = { what: "", ownerUserId: "", dueDate: "" };

/** Texto con sugerencias de un clic: cada sugerencia se agrega como renglón. */
function SuggestedText({
  name,
  label,
  hint,
  placeholder,
  suggestions,
  defaultValue,
}: {
  name: string;
  label: string;
  hint: string;
  placeholder: string;
  suggestions: string[];
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const lines = value.split("\n").map((l) => l.trim());
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label htmlFor={`f-${name}`} className="font-semibold">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((sug) => (
          <button
            key={sug}
            type="button"
            disabled={lines.includes(sug)}
            onClick={() => setValue((v) => (v.trim() ? `${v.trimEnd()}\n${sug}` : sug))}
            className={`${chipButton} disabled:opacity-50`}
          >
            + {sug}
          </button>
        ))}
      </div>
      <textarea
        id={`f-${name}`}
        name={name}
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={INPUT_CLASS}
      />
      <span className="text-xs text-[var(--color-ink-muted)]">{hint}</span>
    </div>
  );
}

/** Plan del objetivo (§6.2.2): una fila por acción con responsable y fecha, más recursos y evaluación. */
function PlanFields({ members, defaults }: { members: MemberOption[]; defaults?: ObjectiveDefaults }) {
  const [steps, setSteps] = useState<PlanStep[]>(() =>
    defaults?.planSteps.length ? defaults.planSteps : [EMPTY_STEP],
  );
  const patch = (i: number, p: Partial<PlanStep>) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...p } : s)));

  return (
    <div className="flex flex-col gap-5">
      <input type="hidden" name="planSteps" value={JSON.stringify(steps)} />
      <input type="hidden" name="plan" value={defaults?.plan ?? ""} />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">¿Qué se va a hacer?</p>
        <p className="-mt-1 text-xs text-[var(--color-ink-muted)]">
          Una fila por acción, con quién la hace y para cuándo. Podés dejarlo vacío y completarlo después.
        </p>
        <ol className="flex flex-col gap-2">
          {steps.map((step, i) => (
            <li
              key={i}
              className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-card-line)] bg-[var(--color-surface)] p-3 sm:grid-cols-[1.5rem_minmax(0,1fr)_11rem_9.5rem_auto] sm:items-center"
            >
              <span aria-hidden className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                {i + 1}
              </span>
              <input
                value={step.what}
                onChange={(e) => patch(i, { what: e.target.value })}
                aria-label={`Acción ${i + 1}: qué se va a hacer`}
                placeholder="Ej.: Relevar los reclamos del último año"
                className={INPUT_CLASS}
              />
              <select
                value={step.ownerUserId}
                onChange={(e) => patch(i, { ownerUserId: e.target.value })}
                aria-label={`Acción ${i + 1}: responsable`}
                className={INPUT_CLASS}
              >
                <option value="">Responsable…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={step.dueDate}
                onChange={(e) => patch(i, { dueDate: e.target.value })}
                aria-label={`Acción ${i + 1}: fecha límite`}
                className={INPUT_CLASS}
              />
              <button
                type="button"
                onClick={() => setSteps((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [EMPTY_STEP]))}
                aria-label={`Quitar la acción ${i + 1}`}
                className="justify-self-start rounded-[var(--radius-md)] px-2 py-1 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-danger)]"
              >
                Quitar
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          disabled={steps.length >= MAX_PLAN_STEPS}
          onClick={() => setSteps((prev) => [...prev, EMPTY_STEP])}
          className="self-start rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-3 py-1.5 text-sm font-medium hover:border-[var(--color-accent)] disabled:opacity-50"
        >
          + Agregar acción
        </button>
      </div>
      <SuggestedText
        name="planResources"
        label="¿Con qué recursos?"
        hint="Personas, tiempo, dinero o herramientas que hacen falta."
        placeholder="Ej.: 20 horas del analista de calidad"
        suggestions={RESOURCE_SUGGESTIONS}
        defaultValue={defaults?.planResources}
      />
      <SuggestedText
        name="planEvaluation"
        label="¿Cómo se van a evaluar los resultados?"
        hint="Lo habitual es con los indicadores que cargás en el paso siguiente."
        placeholder="Ej.: Con los indicadores del objetivo, en la revisión trimestral"
        suggestions={EVALUATION_SUGGESTIONS}
        defaultValue={defaults?.planEvaluation}
      />
      {defaults?.plan ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line-strong)] px-3 py-2 text-xs text-[var(--color-ink-muted)]">
          <span className="font-semibold">Plan anterior (texto libre):</span> {defaults.plan}
        </p>
      ) : null}
    </div>
  );
}

type ObjectiveBlockProps = {
  members: MemberOption[];
  defaults?: ObjectiveDefaults;
  standards: AuditStandard[];
};

function GoalFields({ defaults, standards }: ObjectiveBlockProps) {
  return (
    <>
      <Field label="Objetivo" hint="Que se pueda medir. Ej.: Reducir los reclamos de clientes a menos del 2 % de los pedidos.">
        <input name="title" required defaultValue={defaults?.title} className={INPUT_CLASS} />
      </Field>
      <Field label="Por qué importa (opcional)" hint="El motivo: un reclamo, un riesgo, una decisión de la dirección.">
        <textarea name="description" rows={2} defaultValue={defaults?.description} className={INPUT_CLASS} />
      </Field>
      <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <legend className="mb-1 font-semibold">Normas a las que aporta</legend>
        {standards.map((s) => (
          <label key={s} className="flex items-center gap-2">
            <input
              type="checkbox"
              name="standards"
              value={s}
              defaultChecked={defaults ? defaults.standards.includes(s) : standards.length === 1}
              className="size-4 accent-[var(--color-accent)]"
            />
            {AUDIT_STANDARD_LABELS[s]}
          </label>
        ))}
      </fieldset>
    </>
  );
}

function OwnerFields({ members, defaults }: ObjectiveBlockProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <MemberSelect
        name="ownerUserId"
        label="Responsable del objetivo"
        hint="Rinde cuentas por el resultado."
        members={members}
        defaultValue={defaults?.ownerUserId}
      />
      <Field label="Fecha de cumplimiento" hint="Cuándo se tiene que haber logrado.">
        <input type="date" name="dueDate" required defaultValue={defaults?.dueDate} className={INPUT_CLASS} />
      </Field>
    </div>
  );
}

/** Edición: las tres secciones juntas, en un solo formulario. */
function ObjectiveFields(props: ObjectiveBlockProps) {
  return (
    <>
      <fieldset className={group}>
        <legend className={legend}>1. ¿Qué querés lograr?</legend>
        <GoalFields {...props} />
      </fieldset>
      <fieldset className={group}>
        <legend className={legend}>2. ¿Quién responde y para cuándo?</legend>
        <OwnerFields {...props} />
      </fieldset>
      <fieldset className={group}>
        <legend className={legend}>3. Plan: ¿cómo se va a lograr?</legend>
        <PlanFields members={props.members} defaults={props.defaults} />
      </fieldset>
    </>
  );
}

const dateLabel = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "");

function objectiveSteps({ members, defaults, standards }: ObjectiveBlockProps): GuidedStep[] {
  return [
    {
      key: "goal",
      label: "Qué lograr",
      title: "¿Qué querés lograr?",
      content: <GoalFields members={members} defaults={defaults} standards={standards} />,
      validate: (r) => (r.all("standards").length === 0 ? "Elegí al menos una norma a la que aporta el objetivo." : null),
      summarize: (r) => [
        { label: "Objetivo", value: r.get("title") },
        { label: "Normas", value: r.all("standards").join(", ") },
      ],
    },
    {
      key: "owner",
      label: "Quién y cuándo",
      title: "¿Quién responde y para cuándo?",
      content: <OwnerFields members={members} defaults={defaults} standards={standards} />,
      summarize: (r) => [
        { label: "Responsable", value: r.get("ownerUserId") },
        { label: "Cumplimiento", value: dateLabel(r.get("dueDate")) },
      ],
    },
    {
      key: "plan",
      label: "Plan",
      title: "Plan: ¿cómo se va a lograr?",
      hint: "Podés dejarlo vacío y completarlo después, desde el objetivo.",
      content: <PlanFields members={members} defaults={defaults} />,
      summarize: (r) => {
        let count = 0;
        try {
          count = (JSON.parse(r.get("planSteps") || "[]") as { what?: string }[]).filter((x) => x.what?.trim()).length;
        } catch {
          count = 0;
        }
        return [
          { label: "Acciones", value: count ? String(count) : "Sin acciones cargadas" },
          { label: "Recursos", value: r.get("planResources") },
          { label: "Cómo se evalúa", value: r.get("planEvaluation") },
        ];
      },
    },
  ];
}

export function CreateObjectiveForm({
  slug,
  members,
  standards,
}: {
  slug: string;
  members: MemberOption[];
  standards: AuditStandard[];
}) {
  const [state, action, pending] = useActionState(createObjectiveAction.bind(null, slug), initial);
  const form = useKeepInputs(action, state);
  return (
    <form {...form} className="flex flex-col gap-5">
      <GuidedSteps
        steps={objectiveSteps({ members, standards })}
        submitLabel="Guardar y seguir con los indicadores"
        pending={pending}
      />
      <Feedback state={state} />
    </form>
  );
}

export function EditObjectiveForm({
  slug,
  objectiveId,
  members,
  defaults,
  standards,
  onSaved,
}: {
  slug: string;
  objectiveId: string;
  members: MemberOption[];
  defaults: ObjectiveDefaults;
  standards: AuditStandard[];
  onSaved?: () => void;
}) {
  const [state, action, pending] = useActionState(async (prev: IndicatorActionState, fd: FormData) => {
    const result = await updateObjectiveAction(slug, objectiveId, prev, fd);
    if (result.ok) onSaved?.();
    return result;
  }, initial);
  const form = useKeepInputs(action, state);
  return (
    <form {...form} className="flex flex-col gap-5">
      <ObjectiveFields members={members} defaults={defaults} standards={standards} />
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={saveChanges}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

export function CloseObjectiveForm({ slug, objectiveId }: { slug: string; objectiveId: string }) {
  const [state, action, pending] = useActionState(
    closeObjectiveAction.bind(null, slug, objectiveId),
    initial,
  );
  const form = useKeepInputs(action, state);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium text-[var(--color-ink-muted)]">Cerrar objetivo</summary>
      <form {...form} className="mt-3 flex flex-col gap-3">
        <Field label="Resultado">
          <select name="result" defaultValue="achieved" className={INPUT_CLASS}>
            <option value="achieved">Cumplido</option>
            <option value="not_achieved">No cumplido</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </Field>
        <Field label="Comentario" hint="Qué pasó, o el motivo si se cancela.">
          <textarea name="note" rows={2} required className={INPUT_CLASS} />
        </Field>
        <Feedback state={state} />
        <button type="submit" disabled={pending} className={secondary}>
          Confirmar cierre
        </button>
      </form>
    </details>
  );
}

// ─── Indicador ──────────────────────────────────────────────────────────────

export type IndicatorDefaults = {
  name: string;
  formula: string;
  unit: string;
  direction: IndicatorDirection;
  target: string;
  alertThreshold: string;
  frequency: IndicatorFrequency;
  kind: IndicatorKind;
  ownerUserId: string;
};

const DIRECTION_CHOICES: { value: IndicatorDirection; label: string; hint: string }[] = [
  { value: "higher_better", label: "Cuanto más alto, mejor", hint: "Ej.: % de entregas a tiempo, horas de capacitación." },
  { value: "lower_better", label: "Cuanto más bajo, mejor", hint: "Ej.: reclamos, accidentes, días de demora." },
];

function toNumber(text: string): number {
  const t = text.trim().replace(",", ".");
  return t === "" ? Number.NaN : Number(t);
}

/**
 * Indicador guiado: unidad con un clic, qué resultado es bueno, meta y aviso previo,
 * y el semáforo resultante en palabras antes de guardar.
 */
function IndicatorFields({
  members,
  defaults,
  guided = false,
  pending = false,
  submitLabel = "Guardar indicador",
}: {
  members: MemberOption[];
  defaults?: IndicatorDefaults;
  /** Alta por pasos; la edición muestra las tres secciones juntas. */
  guided?: boolean;
  pending?: boolean;
  submitLabel?: string;
}) {
  const [unit, setUnit] = useState(defaults?.unit ?? "");
  const [direction, setDirection] = useState<IndicatorDirection>(defaults?.direction ?? "higher_better");
  const [target, setTarget] = useState(defaults?.target ?? "");
  const [useAlert, setUseAlert] = useState(Boolean(defaults?.alertThreshold));
  const [alert, setAlert] = useState(defaults?.alertThreshold ?? "");
  const targetNumber = toNumber(target);
  const suggestion = suggestAlertThreshold(direction, targetNumber);
  const bands = statusBands({
    direction,
    target: targetNumber,
    alertThreshold: useAlert ? toNumber(alert) : null,
    unit: unit.trim(),
  });

  const measureSection = (
    <>
      <Field label="¿Qué vas a medir?" hint="El nombre del indicador. Ej.: Reclamos por cada 100 pedidos.">
        <input name="name" required defaultValue={defaults?.name} className={INPUT_CLASS} />
      </Field>
      <Field
        label="¿Cómo se calcula y de dónde sale el dato?"
        hint="Ej.: reclamos del mes ÷ pedidos del mes × 100, del registro de reclamos."
      >
        <textarea name="formula" rows={2} defaultValue={defaults?.formula} className={INPUT_CLASS} />
      </Field>

      <div className="flex flex-col gap-1.5 text-sm">
        <label htmlFor="f-unit" className="font-semibold">
          Unidad
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          {UNIT_SUGGESTIONS.map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={unit === u}
              onClick={() => setUnit(u)}
              className={`${chipButton} aria-pressed:border-[var(--color-accent)] aria-pressed:bg-[var(--color-accent-soft)] aria-pressed:text-[var(--color-accent-ink)]`}
            >
              {u}
            </button>
          ))}
          <input
            id="f-unit"
            name="unit"
            required
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="u otra: litros, km…"
            className={`${INPUT_CLASS} w-40`}
          />
        </div>
      </div>

    </>
  );
  const goalSection = (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">¿Qué resultado es bueno?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {DIRECTION_CHOICES.map((d) => (
            <label key={d.value} className={radioCard}>
              <input
                type="radio"
                name="direction"
                value={d.value}
                checked={direction === d.value}
                onChange={() => setDirection(d.value)}
                className="mt-1 size-4 accent-[var(--color-accent)]"
              />
              <span>
                <span className="block text-sm font-semibold">{d.label}</span>
                <span className="block text-xs text-[var(--color-ink-muted)]">{d.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Meta"
          hint={
            Number.isFinite(targetNumber)
              ? `Se cumple con ${direction === "higher_better" ? "este valor o más" : "este valor o menos"}.`
              : "El valor a alcanzar, solo el número."
          }
        >
          <input
            name="target"
            inputMode="decimal"
            required
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={direction === "higher_better" ? "Ej.: 95" : "Ej.: 2"}
            className={INPUT_CLASS}
          />
        </Field>
        <div className="flex flex-col gap-1.5 text-sm">
          <label className="flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={useAlert}
              onChange={(e) => setUseAlert(e.target.checked)}
              className="size-4 accent-[var(--color-accent)]"
            />
            Avisarme antes de no cumplir la meta
          </label>
          {useAlert ? (
            <>
              <input
                name="alertThreshold"
                inputMode="decimal"
                aria-label="Valor que dispara el aviso"
                value={alert}
                onChange={(e) => setAlert(e.target.value)}
                placeholder={suggestion !== null ? `Ej.: ${suggestion}` : "Primero definí la meta"}
                className={INPUT_CLASS}
              />
              <span className="text-xs text-[var(--color-ink-muted)]">
                Avisa cuando el valor {direction === "higher_better" ? "baja de" : "supera"} este número, todavía dentro
                de la meta.
                {suggestion !== null ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => setAlert(String(suggestion))}
                      className="font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
                    >
                      Usar {suggestion.toLocaleString("es-AR")}
                    </button>
                  </>
                ) : null}
              </span>
            </>
          ) : (
            <span className="text-xs text-[var(--color-ink-muted)]">
              Opcional: marca el indicador en amarillo antes de que salga de la meta.
            </span>
          )}
        </div>
      </div>

      {bands.length > 0 ? (
        <div
          aria-live="polite"
          className="rounded-[var(--radius-md)] border border-[var(--color-card-line)] bg-[var(--color-surface)] px-3 py-2.5 text-sm"
        >
          <p className="text-xs font-semibold text-[var(--color-ink-muted)]">Así se va a ver cada valor cargado</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {bands.map((b) => (
              <li key={b.status} className="flex flex-wrap items-center gap-2">
                <span className={`rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-semibold ${MEASUREMENT_STATUS_TONE[b.status]}`}>
                  {MEASUREMENT_STATUS_LABELS[b.status]}
                </span>
                {b.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

    </>
  );
  const loadSection = (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">¿Cada cuánto se carga?</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FREQUENCY_LABELS) as IndicatorFrequency[]).map((f) => (
            <label key={f} className={`${radioCard} items-center py-2`}>
              <input
                type="radio"
                name="frequency"
                value={f}
                defaultChecked={(defaults?.frequency ?? "monthly") === f}
                className="size-4 accent-[var(--color-accent)]"
              />
              <span className="text-sm font-medium">{FREQUENCY_LABELS[f]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">¿Qué mide?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(KIND_LABELS) as IndicatorKind[]).map((k) => (
            <label key={k} className={radioCard}>
              <input
                type="radio"
                name="kind"
                value={k}
                defaultChecked={(defaults?.kind ?? "lagging") === k}
                className="mt-1 size-4 accent-[var(--color-accent)]"
              />
              <span>
                <span className="block text-sm font-semibold">{KIND_LABELS[k]}</span>
                <span className="block text-xs text-[var(--color-ink-muted)]">{KIND_HINTS[k]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <MemberSelect
        name="ownerUserId"
        label="Responsable del indicador"
        hint="Carga los valores en cada período; recibe el aviso cuando toca."
        members={members}
        defaultValue={defaults?.ownerUserId}
      />
    </>
  );

  if (!guided) {
    return (
      <>
        {measureSection}
        {goalSection}
        {loadSection}
      </>
    );
  }

  const steps: GuidedStep[] = [
    {
      key: "measure",
      label: "Qué medir",
      title: "¿Qué vas a medir?",
      content: measureSection,
      validate: (r) => (r.get("name").length < 3 ? "Poné un nombre al indicador." : null),
      summarize: (r) => [
        { label: "Indicador", value: r.get("name") },
        { label: "Unidad", value: r.get("unit") },
      ],
    },
    {
      key: "goal",
      label: "Meta",
      title: "¿Qué resultado es bueno?",
      content: goalSection,
      validate: (r) => {
        const alertText = r.get("alertThreshold");
        return (
          indicatorDefinitionIssues({
            // El nombre y la unidad ya se validaron en el paso anterior: acá solo importa la meta.
            name: "indicador",
            unit: "u",
            direction: r.get("direction") === "lower_better" ? "lower_better" : "higher_better",
            target: toNumber(r.get("target")),
            alertThreshold: alertText ? toNumber(alertText) : null,
          })[0] ?? null
        );
      },
      summarize: (r) => {
        const lower = r.get("direction") === "lower_better";
        const unitText = r.get("unit");
        return [
          { label: "Resultado bueno", value: lower ? "Cuanto más bajo, mejor" : "Cuanto más alto, mejor" },
          { label: "Meta", value: `${lower ? "≤" : "≥"} ${r.get("target")} ${unitText}`.trim() },
          { label: "Aviso previo", value: r.get("alertThreshold") ? `${r.get("alertThreshold")} ${unitText}`.trim() : "Sin aviso" },
        ];
      },
    },
    {
      key: "load",
      label: "Quién carga",
      title: "¿Cada cuánto y quién lo carga?",
      content: loadSection,
      summarize: (r) => [
        { label: "Frecuencia", value: FREQUENCY_LABELS[r.get("frequency") as IndicatorFrequency] ?? "" },
        { label: "Tipo", value: KIND_LABELS[r.get("kind") as IndicatorKind] ?? "" },
        { label: "Responsable", value: r.get("ownerUserId") },
      ],
    },
  ];

  return <GuidedSteps steps={steps} submitLabel={submitLabel} pending={pending} />;
}

export function CreateIndicatorForm({
  slug,
  objectiveId,
  members,
}: {
  slug: string;
  objectiveId: string;
  members: MemberOption[];
}) {
  const [state, action, pending] = useActionState(
    createIndicatorAction.bind(null, slug, objectiveId),
    initial,
  );
  const form = useKeepInputs(action, state);
  return (
    <form {...form} className="flex flex-col gap-4">
      <IndicatorFields members={members} guided pending={pending} submitLabel="Guardar indicador" />
      <Feedback state={state} />
    </form>
  );
}

export function EditIndicatorForm({
  slug,
  objectiveId,
  indicatorId,
  members,
  defaults,
}: {
  slug: string;
  objectiveId: string;
  indicatorId: string;
  members: MemberOption[];
  defaults: IndicatorDefaults;
}) {
  const [state, action, pending] = useActionState(
    updateIndicatorAction.bind(null, slug, objectiveId, indicatorId),
    initial,
  );
  const form = useKeepInputs(action, state);
  return (
    <form {...form} className="flex flex-col gap-4">
      <IndicatorFields members={members} defaults={defaults} />
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={saveChanges}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

export function ToggleIndicatorButton({
  slug,
  objectiveId,
  indicatorId,
  active,
}: {
  slug: string;
  objectiveId: string;
  indicatorId: string;
  active: boolean;
}) {
  const [state, action, pending] = useActionState(
    setIndicatorActiveAction.bind(null, slug, objectiveId, indicatorId, !active),
    initial,
  );
  const form = useKeepInputs(action, state);
  return (
    <form {...form} className="flex flex-col gap-1">
      <button type="submit" disabled={pending} className={secondary}>
        {active ? "Desactivar indicador" : "Reactivar indicador"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
