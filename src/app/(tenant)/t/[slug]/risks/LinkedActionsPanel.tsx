"use client";

import { useActionState, useRef, useState, type ChangeEvent } from "react";
import {
  createLinkedActionAction,
  completeActionAction,
  recordEffectivenessAction,
  uploadActionEvidenceAction,
  type RoActionState,
} from "@/app/(tenant)/t/[slug]/risks/actions";
import {
  ACTION_STATUS_LABELS,
  EFFECTIVENESS_STATUS_LABELS,
  type ActionStatus,
  type EffectivenessStatus,
} from "@/domain/actions/types";
import { Field, FilePicker, FormError, INPUT_CLASS, StatusChip } from "@/components/ui";

type Member = { id: string; name: string; email: string };
type ActionRow = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  ownerUserId: string;
  dueAt: Date | string | null;
  effectivenessStatus: string;
  attachments: { id: string; fileName: string }[];
};

const initial: RoActionState = {};

const STATUS_CHIP: Record<ActionStatus, "pending" | "info" | "ok" | "danger"> = {
  open: "pending",
  in_progress: "info",
  completed: "ok",
  cancelled: "danger",
};

function formatDay(d: Date | string): string {
  return new Date(d).toLocaleDateString("es-AR");
}

export function LinkedActionsPanel({
  slug,
  targetType,
  targetId,
  returnPath,
  members,
  actions,
  canWrite,
}: {
  slug: string;
  targetType: "risk" | "opportunity";
  targetId: string;
  returnPath: string;
  members: Member[];
  actions: ActionRow[];
  canWrite: boolean;
}) {
  const createBound = createLinkedActionAction.bind(null, slug);
  const [createState, createAction, createPending] = useActionState(createBound, initial);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "Sin asignar";
  // Fijo durante la vida de la vista: alcanza para marcar vencidas sin re-render impuro.
  const [now] = useState(() => Date.now());

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl">Acciones</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Cada acción tiene un responsable y una fecha límite. Se completa con evidencia y después se evalúa si
          fue eficaz.
        </p>
      </div>

      {actions.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line-strong)] px-4 py-3 text-sm text-[var(--color-ink-muted)]">
          Todavía no hay acciones. {canWrite ? "Cargá la primera con el formulario de abajo." : ""}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {actions.map((a) => {
            const status = a.status as ActionStatus;
            const overdue = Boolean(a.dueAt && new Date(a.dueAt).getTime() < now && status !== "completed" && status !== "cancelled");
            const workable = canWrite && status !== "completed" && status !== "cancelled";
            return (
              <li
                key={a.id}
                className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold break-words">{a.title}</p>
                    {a.description ? (
                      <p className="mt-0.5 text-sm text-[var(--color-ink-muted)] break-words">{a.description}</p>
                    ) : null}
                  </div>
                  <StatusChip label={ACTION_STATUS_LABELS[status] ?? a.status} status={STATUS_CHIP[status] ?? "pending"} />
                </div>
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-[var(--color-ink-muted)]">Responsable</dt>
                    <dd className="font-medium">{nameOf(a.ownerUserId)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--color-ink-muted)]">Fecha límite de ejecución</dt>
                    <dd className={overdue ? "font-semibold text-[var(--color-danger)]" : "font-medium"}>
                      {a.dueAt ? `${formatDay(a.dueAt)}${overdue ? " · vencida" : ""}` : "Sin fecha"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--color-ink-muted)]">Eficacia</dt>
                    <dd className="font-medium">
                      {EFFECTIVENESS_STATUS_LABELS[a.effectivenessStatus as EffectivenessStatus] ?? a.effectivenessStatus}
                    </dd>
                  </div>
                </dl>
                {a.attachments.length > 0 ? (
                  <div>
                    <p className="text-xs text-[var(--color-ink-muted)]">Evidencia</p>
                    <ul className="mt-1 flex flex-col gap-1 text-sm">
                      {a.attachments.map((att) => (
                        <li key={att.id}>
                          <a
                            className="break-all text-[var(--color-accent)] underline-offset-2 hover:underline"
                            href={`/api/actions/attachments/${att.id}/download`}
                          >
                            {att.fileName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {workable ? (
                  <div className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-3">
                    <UploadEvidenceForm slug={slug} actionId={a.id} returnPath={returnPath} />
                    <CompleteButton
                      slug={slug}
                      actionId={a.id}
                      returnPath={returnPath}
                      hasEvidence={a.attachments.length > 0}
                    />
                  </div>
                ) : null}

                {canWrite && status === "completed" && a.effectivenessStatus === "pending" ? (
                  <EffectivenessForm slug={slug} actionId={a.id} returnPath={returnPath} />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {canWrite ? (
        <form
          action={createAction}
          className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] p-4"
        >
          <h3 className="text-base font-semibold">Nueva acción</h3>
          {createState.error ? <FormError>{createState.error}</FormError> : null}
          {createState.ok ? (
            <p role="status" className="text-sm text-[var(--color-success)]">
              {createState.ok}
            </p>
          ) : null}
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <Field label="Qué se va a hacer" required>
            <input
              name="title"
              required
              placeholder={
                targetType === "risk"
                  ? "Ej.: Homologar un segundo proveedor de chapa"
                  : "Ej.: Probar la carga automática de pedidos con un cliente"
              }
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Detalle (opcional)" hint="Cómo se hace, con qué recursos.">
            <textarea name="description" rows={2} className={INPUT_CLASS} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Responsable" hint="Quién la ejecuta y la completa." required>
              <select name="ownerUserId" required defaultValue="" className={INPUT_CLASS}>
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
            <Field
              label="Fecha límite de ejecución"
              hint="Hasta cuándo tiene el responsable para completarla. Se avisa antes de que venza."
            >
              <input type="date" name="dueAt" className={INPUT_CLASS} />
            </Field>
          </div>
          <button
            type="submit"
            disabled={createPending}
            className="self-start rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-on-solid)] disabled:opacity-60"
          >
            {createPending ? "Guardando…" : "Agregar acción"}
          </button>
        </form>
      ) : null}
    </section>
  );
}

/** La evidencia se adjunta en cuanto se elige el archivo. */
function UploadEvidenceForm({
  slug,
  actionId,
  returnPath,
}: {
  slug: string;
  actionId: string;
  returnPath: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const bound = uploadActionEvidenceAction.bind(null, slug, actionId);
  const [state, formAction, pending] = useActionState(async (prev: RoActionState, data: FormData) => {
    const result = await bound(prev, data);
    if (result.ok) {
      setFile(null);
      formRef.current?.reset();
    }
    return result;
  }, initial);

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    if (picked) formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="returnPath" value={returnPath} />
      <p className="text-sm font-semibold">Evidencia de ejecución</p>
      <FilePicker
        name="file"
        required
        disabled={pending}
        file={file}
        fileStatus={pending ? "adjuntando…" : undefined}
        hint="Foto, PDF o planilla. Se adjunta al elegirlo."
        onChange={onChange}
      />
      {state.error ? (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {state.error}
        </p>
      ) : null}
      {state.ok && !pending ? (
        <p role="status" className="text-xs text-[var(--color-success)]">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}

function CompleteButton({
  slug,
  actionId,
  returnPath,
  hasEvidence,
}: {
  slug: string;
  actionId: string;
  returnPath: string;
  hasEvidence: boolean;
}) {
  const [state, setState] = useState<RoActionState>({});
  const [pending, setPending] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending || !hasEvidence}
        className="rounded-[var(--radius-md)] border border-[var(--color-success)] px-3 py-1.5 text-sm font-semibold text-[var(--color-success)] hover:bg-[var(--color-success-soft)] disabled:cursor-not-allowed disabled:border-[var(--color-line)] disabled:text-[var(--color-ink-muted)]"
        onClick={async () => {
          setPending(true);
          setState(await completeActionAction(slug, actionId, returnPath));
          setPending(false);
        }}
      >
        {pending ? "Guardando…" : "Marcar como completada"}
      </button>
      {!hasEvidence ? (
        <span className="text-xs text-[var(--color-ink-muted)]">Adjuntá la evidencia para poder completarla.</span>
      ) : null}
      {state.error ? <span className="text-xs text-[var(--color-danger)]">{state.error}</span> : null}
    </div>
  );
}

function EffectivenessForm({
  slug,
  actionId,
  returnPath,
}: {
  slug: string;
  actionId: string;
  returnPath: string;
}) {
  const bound = recordEffectivenessAction.bind(null, slug, actionId);
  const [state, formAction, pending] = useActionState(bound, initial);
  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-3">
      <input type="hidden" name="returnPath" value={returnPath} />
      <p className="text-sm font-semibold">¿La acción fue eficaz?</p>
      <Field label="Resultado">
        <select name="effectiveness" required className={INPUT_CLASS}>
          <option value="effective">Eficaz: logró lo que se buscaba</option>
          <option value="partially_effective">Parcialmente eficaz</option>
          <option value="not_effective">No eficaz</option>
          <option value="not_applicable">No aplica</option>
        </select>
      </Field>
      <Field label="Comentario" hint="Obligatorio si no fue plenamente eficaz.">
        <textarea name="note" rows={2} className={INPUT_CLASS} />
      </Field>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-on-solid)] disabled:opacity-60"
      >
        Guardar eficacia
      </button>
      {state.error ? (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-xs text-[var(--color-success)]">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}
