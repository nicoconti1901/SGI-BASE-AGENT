"use client";

import { useActionState } from "react";
import { Button, Field, FormError, INPUT_CLASS, StatusChip } from "@/components/ui";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import {
  importSuggestedCoursesAction,
  recalculateCourseValidityAction,
  saveCourseAction,
  setCourseActiveAction,
  type TrainingActionState,
} from "@/app/(tenant)/t/[slug]/training/actions";
import {
  COURSE_CATEGORIES,
  COURSE_CATEGORY_LABELS,
  COURSE_MODALITIES,
  COURSE_MODALITY_LABELS,
  COURSE_STANDARDS,
} from "@/domain/training/courses";

const initial: TrainingActionState = {};

export type CourseView = {
  id: string;
  name: string;
  code: string | null;
  category: (typeof COURSE_CATEGORIES)[number];
  modality: (typeof COURSE_MODALITIES)[number];
  standards: string[];
  defaultHours: number | null;
  validityMonths: number | null;
  reminderDays: number;
  requiresEffectiveness: boolean;
  effectivenessDays: number;
  legalBasis: string | null;
  defaultProvider: string | null;
  active: boolean;
};

function Result({ state }: { state: TrainingActionState }) {
  return (
    <>
      {state.error ? <FormError>{state.error}</FormError> : null}
      {state.ok ? (
        <p role="status" className="text-sm text-[var(--color-success)]">
          {state.ok}
        </p>
      ) : null}
    </>
  );
}

/** Alta (sin `course`) o edición de un curso. */
export function CourseForm({ slug, course, submitLabel }: { slug: string; course?: CourseView; submitLabel: string }) {
  const action = saveCourseAction.bind(null, slug, course?.id ?? null);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state, { resetOnSuccess: !course });
  return (
    <form {...keep} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" required>
          <input name="name" required minLength={2} defaultValue={course?.name} placeholder="Ej.: Trabajo en altura" className={INPUT_CLASS} />
        </Field>
        <Field label="Código" hint="Opcional. Sirve para importar el histórico por código.">
          <input name="code" defaultValue={course?.code ?? ""} placeholder="Ej.: ALT-01" className={INPUT_CLASS} />
        </Field>
        <Field label="Categoría">
          <select name="category" defaultValue={course?.category ?? "other"} className={INPUT_CLASS}>
            {COURSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {COURSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Modalidad">
          <select name="modality" defaultValue={course?.modality ?? "in_person"} className={INPUT_CLASS}>
            {COURSE_MODALITIES.map((m) => (
              <option key={m} value={m}>
                {COURSE_MODALITY_LABELS[m]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Vigencia (meses)" hint="De 1 a 120. Dejalo vacío si el curso no vence.">
          <input name="validityMonths" type="number" min={1} max={120} step={1} defaultValue={course?.validityMonths ?? ""} placeholder="Ej.: 12" className={INPUT_CLASS} />
        </Field>
        <Field label="Avisar antes del vencimiento (días)" hint="De 15 a 90. Con proveedor externo conviene más margen.">
          <input name="reminderDays" type="number" min={15} max={90} step={1} required defaultValue={course?.reminderDays ?? 30} className={INPUT_CLASS} />
        </Field>
        <Field label="Duración (horas)" hint="Opcional.">
          <input name="defaultHours" type="number" min={0.5} step={0.5} defaultValue={course?.defaultHours ?? ""} placeholder="Ej.: 4" className={INPUT_CLASS} />
        </Field>
        <Field label="Proveedor habitual" hint="Opcional.">
          <input name="defaultProvider" defaultValue={course?.defaultProvider ?? ""} placeholder="Ej.: Instituto Sur" className={INPUT_CLASS} />
        </Field>
        <Field label="Base normativa" hint="Opcional. Ej.: Res. SRT 905/15 Anexo II 9.3">
          <input name="legalBasis" defaultValue={course?.legalBasis ?? ""} className={INPUT_CLASS} />
        </Field>
        <fieldset className="flex flex-col gap-1.5 text-sm">
          <legend className="font-semibold">Ayuda a cumplir</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {COURSE_STANDARDS.map((s) => (
              <label key={s} className="flex items-center gap-2">
                <input type="checkbox" name="standards" value={s} defaultChecked={course?.standards.includes(s)} className="h-4 w-4 accent-[var(--color-accent)]" />
                {s.replace("ISO", "ISO ")}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="requiresEffectiveness" defaultChecked={course?.requiresEffectiveness} className="mt-1 h-4 w-4 accent-[var(--color-accent)]" />
          <span>
            <span className="font-semibold">Hay que evaluar la eficacia</span>
            <span className="block text-xs text-[var(--color-ink-muted)]">
              Después de dar el curso, alguien verifica que funcionó (p. ej. observando la tarea). Si no es eficaz, deja de habilitar para una tarea crítica.
            </span>
          </span>
        </label>
        <Field label="Plazo para evaluar la eficacia (días)" hint="De 30 a 180. Solo si el curso requiere eficacia.">
          <input name="effectivenessDays" type="number" min={30} max={180} step={1} required defaultValue={course?.effectivenessDays ?? 90} className={INPUT_CLASS} />
        </Field>
      </div>
      <Result state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Baja lógica o reactivación; muestra el motivo si la baja está bloqueada. */
export function CourseActiveToggle({ slug, course }: { slug: string; course: CourseView }) {
  const action = setCourseActiveAction.bind(null, slug, course.id, !course.active);
  const [state, formAction, pending] = useActionState(action, initial);
  const label = course.active ? "Dar de baja" : "Reactivar";
  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state.error ? <FormError>{state.error}</FormError> : null}
      <div>
        <Button type="submit" variant={course.active ? "danger" : "secondary"} disabled={pending} aria-label={`${label}: ${course.name}`}>
          {pending ? "Procesando…" : label}
        </Button>
      </div>
    </form>
  );
}

/** Acción explícita y separada de la edición: cambiar la vigencia no toca lo ya cargado. */
export function RecalculateValidity({ slug, course }: { slug: string; course: CourseView }) {
  const action = recalculateCourseValidityAction.bind(null, slug, course.id);
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <p className="text-xs text-[var(--color-ink-muted)]">
        Cambiar la vigencia no modifica las capacitaciones ya cargadas. Si querés que sus vencimientos usen la vigencia actual
        ({course.validityMonths === null ? "no vence" : `${course.validityMonths} meses`}), recalculalos acá. Los que traen la fecha de su certificado no se tocan.
      </p>
      <Result state={state} />
      <div>
        <Button type="submit" variant="secondary" disabled={pending} aria-label={`Recalcular vigencias: ${course.name}`}>
          {pending ? "Recalculando…" : "Recalcular vigencias"}
        </Button>
      </div>
    </form>
  );
}

export type SuggestionView = {
  key: string;
  name: string;
  usualTarget: string;
  confidenceLabel: string;
  confidenceHint: string;
  confidenceTone: "ok" | "info" | "pending" | "warning";
  source: string;
  validity: string;
  imported: boolean;
};

/** Lista del catálogo sugerido: el cliente elige qué importar; nada se activa solo. */
export function SuggestedImport({ slug, suggestions }: { slug: string; suggestions: SuggestionView[] }) {
  const action = importSuggestedCoursesAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state, { resetOnSuccess: true });
  const available = suggestions.filter((s) => !s.imported);
  return (
    <form {...keep} className="flex flex-col gap-3">
      <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
        {suggestions.map((s) => (
          <li key={s.key} className="flex items-start gap-3 px-4 py-3">
            <input
              type="checkbox"
              name="key"
              value={s.key}
              id={`sug-${s.key}`}
              disabled={s.imported}
              aria-label={`Importar ${s.name}`}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
            />
            <label htmlFor={`sug-${s.key}`} className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.name}</span>
                <span title={s.confidenceHint}>
                  <StatusChip status={s.confidenceTone} label={s.confidenceLabel} />
                </span>
                {s.imported ? <StatusChip status="ok" label="Ya cargado" /> : null}
              </span>
              <span className="text-xs text-[var(--color-ink-muted)]">
                {s.validity} · Suele exigirse: {s.usualTarget}
              </span>
              <span className="text-xs text-[var(--color-ink-muted)]">{s.source}</span>
            </label>
          </li>
        ))}
      </ul>
      <Result state={state} />
      <div>
        <Button type="submit" disabled={pending || available.length === 0}>
          {pending ? "Importando…" : "Importar los elegidos"}
        </Button>
      </div>
    </form>
  );
}
