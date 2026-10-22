"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FormError, INPUT_CLASS, StatusChip } from "@/components/ui";
import { PersonPicker } from "@/components/pickers/PersonPicker";
import {
  closeInspectionAction,
  deletePhotoAction,
  saveAnswerAction,
  saveMetaAction,
  uploadPhotoAction,
  type CaptureResult,
} from "@/app/(tenant)/t/[slug]/inspections/actions";
import { deriveInspectionResult, explainResult, itemOutcome } from "@/domain/inspections/result";
import { validateInspectionForClose, MAX_BACKDATED_DAYS, MAX_PHOTOS_PER_ANSWER } from "@/domain/inspections/close";
import { addDays, formatDateEs, todayIso } from "@/domain/inspections/dates";
import { CRITICALITY_LABELS, RESULT_LABELS, type AnswerValue, type EvalAnswer, type EvalItem, type InspectionResult } from "@/domain/inspections/types";

export type CaptureItem = {
  itemId: string;
  code: string;
  section: string;
  text: string;
  help: string | null;
  unit: string | null;
  evalItem: EvalItem;
  /** Solo en ítems automáticos: vencimiento del activo. */
  auto: { dueAt: string | null; conform: boolean } | null;
  value: AnswerValue | null;
  numberValue: number | null;
  textValue: string | null;
  comment: string | null;
  photos: { id: string; fileName: string }[];
};

type AnswerState = { value: AnswerValue | null; numberValue: number | null; textValue: string | null; comment: string | null };

export type CaptureProps = {
  slug: string;
  inspectionId: string;
  assetCode: string;
  assetSummary: string;
  siteName: string;
  inspectorName: string;
  inspectedAt: string;
  notes: string | null;
  performedBy: { id: string; name: string; employeeCode: string; siteName: string } | null;
  items: CaptureItem[];
};

const RESULT_CHIP: Record<InspectionResult, "ok" | "warning" | "danger"> = { fit: "ok", fit_with_observations: "warning", unfit: "danger" };

/** Reduce la foto a 1.600 px (lado mayor) antes de subirla: el celular saca fotos de varios MB. */
async function resizeImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ? new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function InspectionCapture(props: CaptureProps) {
  const { slug, inspectionId, items } = props;
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() =>
    Object.fromEntries(items.map((i) => [i.itemId, { value: i.value, numberValue: i.numberValue, textValue: i.textValue, comment: i.comment }])),
  );
  const [photos, setPhotos] = useState<Record<string, { id: string; fileName: string }[]>>(() => Object.fromEntries(items.map((i) => [i.itemId, i.photos])));
  const [step, setStep] = useState<"checklist" | "review">("checklist");
  const [saving, setSaving] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [inspectedAt, setInspectedAt] = useState(props.inspectedAt);
  const [notes, setNotes] = useState(props.notes ?? "");
  const [closing, startClosing] = useTransition();
  const queue = useRef<Record<string, Promise<unknown>>>({});
  const today = todayIso();

  /** Cada respuesta se guarda sola, en orden por ítem, y el estado de guardado queda a la vista. */
  const persist = useCallback(
    (key: string, run: () => Promise<CaptureResult>) => {
      setSaving((n) => n + 1);
      const next = (queue.current[key] ?? Promise.resolve()).then(async () => {
        try {
          const result = await run();
          setSaveError(result.ok ? null : result.error);
        } catch {
          setSaveError("No se pudo guardar: revisá la conexión. Tus respuestas siguen en pantalla.");
        } finally {
          setSaving((n) => n - 1);
        }
      });
      queue.current[key] = next;
    },
    [],
  );

  function update(item: CaptureItem, patch: Partial<AnswerState>) {
    setAnswers((prev) => ({ ...prev, [item.itemId]: { ...prev[item.itemId], ...patch } }));
    persist(item.itemId, () => saveAnswerAction(slug, inspectionId, item.itemId, patch));
  }

  const evalAnswers: EvalAnswer[] = useMemo(
    () => items.map((i) => ({ itemId: i.itemId, value: i.auto ? undefined : answers[i.itemId].value, numberValue: answers[i.itemId].numberValue, textValue: answers[i.itemId].textValue, comment: answers[i.itemId].comment })),
    [items, answers],
  );
  const evalItems = useMemo(() => items.map((i) => i.evalItem), [items]);
  const derived = useMemo(() => {
    try {
      return deriveInspectionResult(evalItems, evalAnswers);
    } catch {
      return null;
    }
  }, [evalItems, evalAnswers]);
  const photoCounts = useMemo(() => Object.fromEntries(Object.entries(photos).map(([k, v]) => [k, v.length])), [photos]);
  const blockers = useMemo(
    () => validateInspectionForClose({ items: evalItems, answers: evalAnswers, photoCounts, inspectedAt, today }).blockers,
    [evalItems, evalAnswers, photoCounts, inspectedAt, today],
  );

  const manual = items.filter((i) => !i.auto);
  const answered = manual.filter((i) => derived && !derived.missingItemIds.includes(i.itemId)).length;
  const sections = useMemo(() => {
    const map = new Map<string, CaptureItem[]>();
    for (const item of items) map.set(item.section, [...(map.get(item.section) ?? []), item]);
    return [...map.entries()];
  }, [items]);
  const canClose = Boolean(derived?.complete && derived.result && blockers.length === 0);

  function close() {
    setCloseError(null);
    startClosing(async () => {
      await Promise.all(Object.values(queue.current)); // que no quede ningún guardado en camino
      const result = await closeInspectionAction(slug, inspectionId);
      if (result.ok) router.push(`/t/${slug}/inspections/${inspectionId}`);
      else setCloseError(result.error);
    });
  }

  const status = saveError ? (
    <span role="alert" className="text-[var(--color-danger)]">{saveError}</span>
  ) : saving > 0 ? (
    <span role="status">Guardando…</span>
  ) : (
    <span role="status" className="text-[var(--color-success)]">Guardado</span>
  );

  if (step === "review") {
    return (
      <div className="flex flex-col gap-5 pb-24">
        <section aria-label="Resultado" className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">Paso 3 · Revisar y cerrar</p>
          {derived?.result ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <StatusChip status={RESULT_CHIP[derived.result]} label={RESULT_LABELS[derived.result]} />
                <span className="font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums">{derived.scorePct?.toString().replace(".", ",")} %</span>
              </div>
              <p>{explainResult(derived)}</p>
              <p className="text-sm text-[var(--color-ink-muted)]">
                {derived.conform} conformes de {derived.applicable} aplicables. El resultado se calcula solo: no se edita.
              </p>
            </>
          ) : (
            <p className="font-semibold text-[var(--color-warning)]">
              Faltan responder {derived?.missingItemIds.length ?? 0} ítem(s). Volvé al listado: están marcados.
            </p>
          )}
          {derived?.result === "unfit" ? (
            <p className="text-sm text-[var(--color-ink-muted)]">Etiqueta celeste: recordá colocarla en el extintor después del control.</p>
          ) : null}
        </section>

        {blockers.length > 0 ? (
          <FormError>
            <ul className="list-disc pl-5">
              {blockers.map((b, i) => (
                <li key={i}>{b.message}</li>
              ))}
            </ul>
          </FormError>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2" aria-label="Datos de la inspección">
          <Field label="Fecha de la inspección" hint={`Hasta ${MAX_BACKDATED_DAYS} días atrás, para cargar lo hecho sin señal.`}>
            <input
              type="date"
              value={inspectedAt}
              min={addDays(today, -MAX_BACKDATED_DAYS)}
              max={today}
              onChange={(e) => {
                setInspectedAt(e.target.value);
                if (e.target.value) persist("meta", () => saveMetaAction(slug, inspectionId, { inspectedAt: e.target.value }));
              }}
              className={`${INPUT_CLASS} min-h-12`}
            />
          </Field>
          <PersonPicker
            slug={slug}
            name="performedByPersonId"
            label="Realizado por"
            hint="Opcional. Si lo hizo otra persona sin usuario."
            defaultPerson={props.performedBy}
            onChange={(p) => persist("meta", () => saveMetaAction(slug, inspectionId, { performedByPersonId: p?.id ?? null }))}
          />
          <div className="sm:col-span-2">
            <Field label="Observaciones generales" hint="Opcional.">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => persist("meta", () => saveMetaAction(slug, inspectionId, { notes }))}
                rows={3}
                className={INPUT_CLASS}
              />
            </Field>
          </div>
        </section>

        <p className="text-sm text-[var(--color-ink-muted)]">
          Al cerrar firmás como <strong>{props.inspectorName}</strong> el {formatDateEs(today)}. Una inspección cerrada no se edita.
        </p>
        {closeError ? <FormError>{closeError}</FormError> : null}

        <div className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center gap-3 border-t border-[var(--color-line-strong)] bg-[var(--color-surface-raised)] px-4 py-3 sm:static sm:border-0 sm:bg-transparent sm:p-0">
          <Button type="button" variant="ghost" className="min-h-12" onClick={() => setStep("checklist")}>
            Volver al listado
          </Button>
          <Button type="button" className="min-h-12 flex-1 sm:flex-none" disabled={!canClose || closing} onClick={close}>
            {closing ? "Cerrando…" : "Cerrar y firmar"}
          </Button>
          <span className="text-xs text-[var(--color-ink-muted)]">{status}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex flex-col gap-1">
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">Paso 2 · Control</p>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">{props.assetCode}</h2>
        <p className="text-sm text-[var(--color-ink-muted)]">
          {props.assetSummary} · {props.siteName}
        </p>
      </header>

      {sections.map(([section, sectionItems]) => {
        const hasCritical = sectionItems.some((i) => i.evalItem.criticality === "critical" && !i.auto);
        const pendingChecks = sectionItems.filter((i) => !i.auto && i.evalItem.kind === "check" && answers[i.itemId].value === null);
        return (
          <section key={section} aria-label={section} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] pb-2">
              <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">{section}</h3>
              {!hasCritical && pendingChecks.length > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-12"
                  onClick={() => pendingChecks.forEach((i) => update(i, { value: "conform" }))}
                >
                  Sección conforme
                </Button>
              ) : null}
            </div>
            {sectionItems.map((item) => (
              <ItemCard
                key={item.itemId}
                item={item}
                answer={answers[item.itemId]}
                photos={photos[item.itemId]}
                missing={Boolean(derived?.missingItemIds.includes(item.itemId))}
                onChange={(patch) => update(item, patch)}
                onUpload={async (file) => {
                  const data = new FormData();
                  data.set("file", await resizeImage(file));
                  const result = await uploadPhotoAction(slug, inspectionId, item.itemId, data);
                  if (result.ok) setPhotos((p) => ({ ...p, [item.itemId]: [...p[item.itemId], result.photo] }));
                  return result.ok ? null : result.error;
                }}
                onDeletePhoto={async (id) => {
                  const result = await deletePhotoAction(slug, inspectionId, id);
                  if (result.ok) setPhotos((p) => ({ ...p, [item.itemId]: p[item.itemId].filter((x) => x.id !== id) }));
                  return result.ok ? null : result.error;
                }}
              />
            ))}
          </section>
        );
      })}

      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-[var(--color-line-strong)] bg-[var(--color-surface-raised)] px-4 py-3 sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <div className="min-w-0 flex-1">
          <p className="font-[family-name:var(--font-mono)] text-sm tabular-nums">
            {answered} de {manual.length}
          </p>
          <p className="text-xs text-[var(--color-ink-muted)]">{status}</p>
        </div>
        <Button type="button" className="min-h-12" onClick={() => setStep("review")}>
          Revisar y cerrar
        </Button>
      </div>
    </div>
  );
}

const BUTTON_BASE =
  "min-h-12 rounded-[var(--radius-md)] border px-2 py-2 text-sm font-semibold transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]";
const BUTTON_TONE = {
  conform: "border-[var(--color-success)] bg-[var(--color-success)] text-[var(--color-on-solid)]",
  nonconform: "border-[var(--color-danger)] bg-[var(--color-danger)] text-[var(--color-on-solid)]",
  na: "border-[var(--color-ink-muted)] bg-[var(--color-ink-muted)] text-[var(--color-on-solid)]",
} as const;
const BUTTON_IDLE = "border-[var(--color-line-strong)] bg-[var(--color-field-fill)] text-[var(--color-ink)] hover:bg-[var(--color-surface-sunken)]";

function ItemCard({
  item,
  answer,
  photos,
  missing,
  onChange,
  onUpload,
  onDeletePhoto,
}: {
  item: CaptureItem;
  answer: AnswerState;
  photos: { id: string; fileName: string }[];
  missing: boolean;
  onChange: (patch: Partial<AnswerState>) => void;
  onUpload: (file: File) => Promise<string | null>;
  onDeletePhoto: (id: string) => Promise<string | null>;
}) {
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [comment, setComment] = useState(answer.comment ?? "");
  const e = item.evalItem;
  const scoring = e.kind === "check" || e.kind === "number";
  const outcome = scoring ? itemOutcome(e, { itemId: item.itemId, value: item.auto ? undefined : answer.value, numberValue: answer.numberValue }) : null;
  const nc = outcome === "nonconform" && !item.auto;
  const photoRequired = Boolean(e.photoOnNc);

  return (
    <article
      aria-label={item.text}
      className={`flex flex-col gap-3 rounded-[var(--radius-lg)] border bg-[var(--color-surface-raised)] p-4 ${
        nc ? "border-[var(--color-danger)]" : missing ? "border-[var(--color-warning)]" : "border-[var(--color-line)]"
      }`}
    >
      <div className="flex flex-col gap-1">
        <p className="font-semibold leading-snug">{item.text}</p>
        {scoring ? (
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">{CRITICALITY_LABELS[e.criticality]}</p>
        ) : null}
        {item.help ? <p className="text-xs text-[var(--color-ink-muted)]">{item.help}</p> : null}
      </div>

      {item.auto ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusChip status={item.auto.conform ? "ok" : "danger"} label={item.auto.conform ? "Vigente" : "Vencido"} />
          <span className="text-[var(--color-ink-muted)]">
            {item.auto.dueAt ? `Vence el ${formatDateEs(item.auto.dueAt)}. ` : "Sin fecha cargada. "}Lo completa el sistema.
          </span>
        </div>
      ) : null}

      {!item.auto && e.kind === "check" ? (
        <div role="group" aria-label="Respuesta" className={`grid gap-2 ${e.naAllowed ? "grid-cols-3" : "grid-cols-2"}`}>
          {(["conform", "nonconform", ...(e.naAllowed ? ["na"] : [])] as AnswerValue[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={answer.value === v}
              onClick={() => onChange({ value: v })}
              className={`${BUTTON_BASE} ${answer.value === v ? BUTTON_TONE[v] : BUTTON_IDLE}`}
            >
              {v === "conform" ? "Conforme" : v === "nonconform" ? "No conforme" : "No aplica"}
            </button>
          ))}
        </div>
      ) : null}

      {!item.auto && (e.kind === "number" || e.kind === "reading") ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field
            label={e.kind === "number" ? `Valor${item.unit ? ` (${item.unit})` : ""}` : `Lectura${item.unit ? ` (${item.unit})` : ""}`}
            hint={e.kind === "number" && (e.minValue != null || e.maxValue != null) ? `Rango: ${e.minValue ?? "—"} a ${e.maxValue ?? "—"}` : undefined}
          >
            <input
              type="number"
              inputMode="decimal"
              step="any"
              disabled={answer.value === "na"}
              defaultValue={answer.numberValue ?? ""}
              onBlur={(ev) => {
                const raw = ev.target.value.trim();
                onChange({ numberValue: raw === "" ? null : Number(raw.replace(",", ".")) });
              }}
              className={`${INPUT_CLASS} min-h-12 w-40`}
            />
          </Field>
          {e.kind === "number" && e.naAllowed ? (
            <button
              type="button"
              aria-pressed={answer.value === "na"}
              onClick={() => onChange({ value: answer.value === "na" ? null : "na" })}
              className={`${BUTTON_BASE} ${answer.value === "na" ? BUTTON_TONE.na : BUTTON_IDLE}`}
            >
              No aplica
            </button>
          ) : null}
        </div>
      ) : null}

      {!item.auto && e.kind === "text" ? (
        <textarea
          aria-label={item.text}
          defaultValue={answer.textValue ?? ""}
          onBlur={(ev) => onChange({ textValue: ev.target.value })}
          rows={3}
          className={INPUT_CLASS}
        />
      ) : null}

      {nc ? (
        <div className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-3">
          <Field label="Qué encontraste" required hint="Describí la no conformidad para que se pueda corregir.">
            <textarea
              value={comment}
              onChange={(ev) => setComment(ev.target.value)}
              onBlur={() => comment !== (answer.comment ?? "") && onChange({ comment })}
              rows={2}
              className={INPUT_CLASS}
              aria-invalid={comment.trim() === ""}
            />
          </Field>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">
              Foto <span className="font-normal text-[var(--color-ink-muted)]">{photoRequired ? "(obligatoria; si no se puede, explicalo arriba)" : "(opcional)"}</span>
            </p>
            {photos.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {photos.map((p) => (
                  <li key={p.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/inspections/attachments/${p.id}/download`} alt={`Foto de la no conformidad: ${p.fileName}`} className="h-20 w-20 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] object-cover" />
                    <button
                      type="button"
                      aria-label={`Quitar la foto ${p.fileName}`}
                      onClick={async () => setPhotoError(await onDeletePhoto(p.id))}
                      className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-line-strong)] bg-[var(--color-surface-raised)] text-sm font-bold"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {photos.length < MAX_PHOTOS_PER_ANSWER ? (
              <label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]">
                {uploading ? "Subiendo…" : "Sacar o elegir foto"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  disabled={uploading}
                  aria-label="Sacar o elegir foto"
                  onChange={async (ev) => {
                    const file = ev.target.files?.[0];
                    ev.target.value = "";
                    if (!file) return;
                    setUploading(true);
                    setPhotoError(await onUpload(file));
                    setUploading(false);
                  }}
                />
              </label>
            ) : null}
            {photoError ? <FormError>{photoError}</FormError> : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
