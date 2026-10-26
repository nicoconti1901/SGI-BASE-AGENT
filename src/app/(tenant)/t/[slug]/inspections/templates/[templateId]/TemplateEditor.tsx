"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FormError, HintCallout, INPUT_CLASS, StatusChip } from "@/components/ui";
import { restoreTemplateAction, saveTemplateAction, type TemplateSaveResult } from "@/app/(tenant)/t/[slug]/inspections/templates/actions";
import { templateChanged, validateTemplateEdit, type ItemEdit, type TemplateEditContext } from "@/domain/inspections/templates/edit";
import { CRITICALITY_LABELS, type Criticality, type IntervalUnit, type TemplateItemDef } from "@/domain/inspections/types";
import type { EditorSnapshot } from "@/lib/inspection-templates";

type Props = {
  slug: string;
  templateId: string;
  initial: EditorSnapshot;
  context: TemplateEditContext;
  hasDefault: boolean;
  canEdit: boolean;
  canReinstate: boolean;
  retireOnUnfit: boolean;
  maxItems: number;
};

const CRITICALITIES: Criticality[] = ["critical", "major", "minor"];
/** Los ítems nuevos viven en el editor con un código provisorio; el servidor les asigna el definitivo. */
const NEW_PREFIX = "new_";
const isNew = (item: TemplateItemDef) => item.code.startsWith(NEW_PREFIX);

function toEdit(item: TemplateItemDef): ItemEdit {
  return {
    ...(isNew(item) ? {} : { code: item.code }),
    section: item.section,
    text: item.text,
    help: item.help ?? null,
    criticality: item.criticality,
    naAllowed: item.naAllowed,
    photoOnNc: item.photoOnNc,
  };
}

function describeCondition(item: TemplateItemDef): string | null {
  return item.appliesWhen ? "Aplica solo a algunos equipos (según sus datos)." : null;
}

export function TemplateEditor({ slug, templateId, initial, context, hasDefault, canEdit, canReinstate, retireOnUnfit, maxItems }: Props) {
  const router = useRouter();
  const [baseline, setBaseline] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit | null>(initial.intervalUnit);
  const [intervalValue, setIntervalValue] = useState<number | null>(initial.intervalValue);
  const [findingOnCritical, setFindingOnCritical] = useState(initial.findingOnCritical);
  const [items, setItems] = useState<TemplateItemDef[]>(initial.items);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [done, setDone] = useState<{ text: string; warnings: string[] } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [counter, setCounter] = useState(1);

  const draft = useMemo(() => ({ name, intervalUnit, intervalValue, findingOnCritical, items }), [name, intervalUnit, intervalValue, findingOnCritical, items]);
  const dirty = useMemo(() => templateChanged(baseline, draft), [baseline, draft]);
  const { errors, warnings } = useMemo(() => validateTemplateEdit(draft, context), [draft, context]);
  const sections = useMemo(() => [...new Set(items.map((i) => i.section).filter(Boolean))], [items]);

  function load(snapshot: EditorSnapshot) {
    setBaseline(snapshot);
    setName(snapshot.name);
    setIntervalUnit(snapshot.intervalUnit);
    setIntervalValue(snapshot.intervalValue);
    setFindingOnCritical(snapshot.findingOnCritical);
    setItems(snapshot.items);
  }

  function finish(result: TemplateSaveResult, verb: string) {
    if (!result.ok) {
      setError(result.error);
      setConflict(Boolean(result.conflict));
      setDone(null);
      return;
    }
    load(result.snapshot);
    setError(null);
    setConflict(false);
    setConfirmRestore(false);
    setDone({
      text: result.changed ? `${verb} como versión ${result.version}. Las inspecciones que empiecen desde ahora usan esta versión.` : "No había cambios para guardar.",
      warnings: result.warnings,
    });
    router.refresh();
  }

  function save() {
    setError(null);
    startTransition(async () => {
      finish(
        await saveTemplateAction(slug, templateId, {
          expectedVersionId: baseline.versionId,
          name,
          intervalUnit,
          intervalValue,
          findingOnCritical,
          items: items.map(toEdit),
        }),
        "Guardada",
      );
    });
  }

  function restore() {
    setError(null);
    startTransition(async () => {
      finish(await restoreTemplateAction(slug, templateId, baseline.versionId), "Restaurada");
    });
  }

  const patch = (code: string, change: Partial<TemplateItemDef>) => setItems((list) => list.map((i) => (i.code === code ? { ...i, ...change } : i)));
  const move = (index: number, delta: -1 | 1) =>
    setItems((list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const remove = (code: string) => setItems((list) => list.filter((i) => i.code !== code));
  function add() {
    const section = items.at(-1)?.section ?? "General";
    setItems((list) => [...list, { code: `${NEW_PREFIX}${counter}`, section, text: "", criticality: "minor", kind: "check", naAllowed: true, photoOnNc: false, required: true }]);
    setCounter((n) => n + 1);
  }

  const scoring = items.filter((i) => i.kind === "check" || i.kind === "number").length;
  const disabled = !canEdit || pending;

  return (
    <div className="flex flex-col gap-6">
      {canEdit ? (
        <HintCallout>Las inspecciones ya hechas no cambian: cada una guarda los ítems con los que se hizo. Lo que edites rige para las inspecciones que empiecen después.</HintCallout>
      ) : (
        <p className="text-sm font-semibold text-[var(--color-ink-muted)]">Solo lectura: las plantillas las edita el administrador.</p>
      )}

      <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Datos de la plantilla</legend>
        <div className="sm:col-span-2">
          <Field label="Nombre" required>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={INPUT_CLASS} />
          </Field>
        </div>
        {context.hasCalendar ? (
          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <Field label="Cada" hint={context.maxIntervalDays <= 90 ? "Como máximo cada 3 meses (IRAM 3517-2)." : "Hasta 24 meses."} required>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={intervalValue ?? ""}
                onChange={(e) => setIntervalValue(e.target.value === "" ? null : Number(e.target.value))}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Unidad">
              <select value={intervalUnit ?? "months"} onChange={(e) => setIntervalUnit(e.target.value as IntervalUnit)} className={INPUT_CLASS}>
                <option value="days">Días</option>
                <option value="months">Meses</option>
              </select>
            </Field>
          </div>
        ) : (
          <p className="self-end text-sm text-[var(--color-ink-muted)]">Control previo al uso: se hace antes de cada uso, no tiene frecuencia.</p>
        )}
        <label className="flex min-h-10 items-start gap-2 self-end rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm">
          <input type="checkbox" checked={findingOnCritical} onChange={(e) => setFindingOnCritical(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]" />
          <span>
            <span className="font-semibold">Abrir un hallazgo borrador</span> cuando haya una no conformidad crítica. La acción de seguimiento se crea siempre.
          </span>
        </label>
      </fieldset>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-ink-muted)]">
        <span>
          {canReinstate ? "Una inspección apta de esta plantilla puede devolver el equipo a servicio (si la cierra un responsable de proceso o el administrador)." : "Esta plantilla nunca libera un equipo que quedó fuera de servicio."}
        </span>
        {retireOnUnfit ? <span>Un equipo no apto se da de baja.</span> : null}
        <span>Estos dos puntos los fija el tipo de control; no se editan.</span>
      </p>

      <section aria-labelledby="items-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="items-title" className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
            Ítems ({items.length})
          </h2>
          <p className="text-xs text-[var(--color-ink-muted)]">
            {scoring} puntúan · aviso a los {context.maxApplicableItems}, tope de {maxItems}
          </p>
        </div>

        <ol className="flex flex-col gap-3">
          {items.map((item, index) => {
            const auto = Boolean(item.autoSource);
            const condition = describeCondition(item);
            const scores = item.kind === "check" || item.kind === "number";
            const label = item.text.trim() || "Ítem nuevo";
            return (
              <li key={item.code}>
                <article aria-label={label} className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4">
                  <header className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-[family-name:var(--font-mono)] tabular-nums text-[var(--color-ink-muted)]">{index + 1}.</span>
                    {isNew(item) ? <StatusChip status="info" label="Nuevo" /> : <span className="font-[family-name:var(--font-mono)] text-[var(--color-ink-muted)]">{item.code}</span>}
                    {auto ? <StatusChip status="pending" label="Lo completa el sistema" /> : null}
                    {condition ? <span className="text-[var(--color-ink-muted)]">{condition}</span> : null}
                  </header>

                  <Field label="Texto del ítem" required>
                    <textarea
                      value={item.text}
                      onChange={(e) => patch(item.code, { text: e.target.value })}
                      disabled={disabled}
                      rows={2}
                      maxLength={300}
                      className={INPUT_CLASS}
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Sección" required>
                      <input list="template-sections" value={item.section} onChange={(e) => patch(item.code, { section: e.target.value })} disabled={disabled} className={INPUT_CLASS} />
                    </Field>
                    {scores ? (
                      <Field label="Criticidad">
                        <select value={item.criticality} onChange={(e) => patch(item.code, { criticality: e.target.value as Criticality })} disabled={disabled} className={INPUT_CLASS}>
                          {CRITICALITIES.map((c) => (
                            <option key={c} value={c}>
                              {CRITICALITY_LABELS[c]}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : (
                      <p className="self-end text-xs text-[var(--color-ink-muted)]">Este ítem no puntúa.</p>
                    )}
                    <Field label="Ayuda (opcional)">
                      <input value={item.help ?? ""} onChange={(e) => patch(item.code, { help: e.target.value })} disabled={disabled} className={INPUT_CLASS} />
                    </Field>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={item.photoOnNc} onChange={(e) => patch(item.code, { photoOnNc: e.target.checked })} disabled={disabled} className="h-4 w-4 accent-[var(--color-accent)]" />
                      Pide foto si no cumple
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={item.naAllowed && !auto} onChange={(e) => patch(item.code, { naAllowed: e.target.checked })} disabled={disabled || auto} className="h-4 w-4 accent-[var(--color-accent)]" />
                      Admite «No aplica»
                    </label>
                    {canEdit ? (
                      <span className="ml-auto flex flex-wrap gap-2">
                        <Button variant="ghost" onClick={() => move(index, -1)} disabled={disabled || index === 0} aria-label={`Subir: ${label}`}>
                          Subir
                        </Button>
                        <Button variant="ghost" onClick={() => move(index, 1)} disabled={disabled || index === items.length - 1} aria-label={`Bajar: ${label}`}>
                          Bajar
                        </Button>
                        <Button variant="danger" onClick={() => remove(item.code)} disabled={disabled || auto} aria-label={`Quitar: ${label}`} title={auto ? "Lo completa el sistema con un vencimiento del equipo" : undefined}>
                          Quitar
                        </Button>
                      </span>
                    ) : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
        <datalist id="template-sections">
          {sections.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        {canEdit ? (
          <div>
            <Button variant="secondary" onClick={add} disabled={disabled || items.length >= maxItems}>
              Agregar ítem
            </Button>
          </div>
        ) : null}
      </section>

      {errors.length > 0 && canEdit ? (
        <ul className="flex flex-col gap-1 text-sm text-[var(--color-danger)]" aria-label="Cosas para corregir">
          {errors.map((e) => (
            <li key={`${e.code}-${e.message}`}>• {e.message}</li>
          ))}
        </ul>
      ) : null}
      {warnings.length > 0 && canEdit ? <HintCallout>{warnings[0].message}</HintCallout> : null}
      {error ? <FormError>{error}</FormError> : null}
      {conflict ? (
        <div>
          <Button variant="secondary" onClick={() => router.refresh()}>
            Ver la última versión
          </Button>
        </div>
      ) : null}
      {done ? (
        <div role="status" className="flex flex-col gap-1 text-sm text-[var(--color-success)]">
          <p>{done.text}</p>
          {done.warnings.map((w) => (
            <p key={w} className="text-[var(--color-ink-muted)]">
              {w}
            </p>
          ))}
        </div>
      ) : null}

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-line)] pt-4">
          <Button onClick={save} disabled={pending || !dirty || errors.length > 0}>
            {pending ? "Guardando…" : "Guardar como versión nueva"}
          </Button>
          {dirty ? (
            <span className="text-sm text-[var(--color-ink-muted)]">Hay cambios sin guardar.</span>
          ) : null}
          {hasDefault ? (
            <span className="ml-auto flex flex-wrap items-center gap-2">
              {confirmRestore ? (
                <>
                  <span className="text-sm">Vuelve a los ítems y la frecuencia originales como una versión nueva.</span>
                  <Button variant="danger" onClick={restore} disabled={pending}>
                    Sí, restaurar la original
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmRestore(false)} disabled={pending}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button variant="ghost" onClick={() => setConfirmRestore(true)} disabled={pending}>
                  Restaurar la original
                </Button>
              )}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
