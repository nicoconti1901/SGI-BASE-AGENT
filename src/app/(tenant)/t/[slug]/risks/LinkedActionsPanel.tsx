"use client";

import { useActionState } from "react";
import {
  createLinkedActionAction,
  completeActionAction,
  recordEffectivenessAction,
  uploadActionEvidenceAction,
  type RoActionState,
} from "@/app/(tenant)/t/[slug]/risks/actions";
import {
  EFFECTIVENESS_STATUS_LABELS,
  type EffectivenessStatus,
} from "@/domain/actions/types";

type Member = { id: string; name: string; email: string };
type ActionRow = {
  id: string;
  title: string;
  status: string;
  dueAt: Date | string | null;
  effectivenessStatus: string;
  attachments: { id: string; fileName: string }[];
};

const initial: RoActionState = {};

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
  const [createState, createAction, createPending] = useActionState(
    createBound,
    initial,
  );

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-[family-name:var(--font-display)] text-xl">
        Acciones
      </h2>
      <p className="text-sm text-[var(--color-ink-muted)]">
        Completar ≠ efectividad. Sin evidencia no se cierra; sin efectividad no
        hay aprendizaje.
      </p>

      <ul className="flex flex-col gap-4">
        {actions.map((a) => (
          <li
            key={a.id}
            className="rounded-md border border-[var(--color-border)] p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <strong>{a.title}</strong>
              <span className="text-xs text-[var(--color-ink-muted)]">
                {a.status}
                {a.dueAt
                  ? ` · vence ${new Date(a.dueAt).toLocaleDateString("es-AR")}`
                  : ""}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Efectividad:{" "}
              {EFFECTIVENESS_STATUS_LABELS[
                a.effectivenessStatus as EffectivenessStatus
              ] ?? a.effectivenessStatus}
            </p>
            {a.attachments.length > 0 ? (
              <ul className="mt-2 text-sm">
                {a.attachments.map((att) => (
                  <li key={att.id}>
                    <a
                      className="text-[var(--color-accent)] underline"
                      href={`/api/actions/attachments/${att.id}/download`}
                    >
                      {att.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}

            {canWrite && a.status !== "completed" && a.status !== "cancelled" ? (
              <div className="mt-3 flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
                <UploadEvidenceForm
                  slug={slug}
                  actionId={a.id}
                  returnPath={returnPath}
                />
                <CompleteButton
                  slug={slug}
                  actionId={a.id}
                  returnPath={returnPath}
                />
              </div>
            ) : null}

            {canWrite &&
            a.status === "completed" &&
            a.effectivenessStatus === "pending" ? (
              <EffectivenessForm
                slug={slug}
                actionId={a.id}
                returnPath={returnPath}
              />
            ) : null}
          </li>
        ))}
        {actions.length === 0 ? (
          <li className="text-sm text-[var(--color-ink-muted)]">
            Todavía no hay acciones vinculadas.
          </li>
        ) : null}
      </ul>

      {canWrite ? (
        <form action={createAction} className="flex flex-col gap-3 rounded-md border border-dashed border-[var(--color-border)] p-4">
          <h3 className="text-sm font-medium">Nueva acción</h3>
          {createState.error ? (
            <p className="text-sm text-[var(--color-danger)]">
              {createState.error}
            </p>
          ) : null}
          {createState.ok ? (
            <p className="text-sm text-[var(--color-success)]">{createState.ok}</p>
          ) : null}
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <input
            name="title"
            required
            placeholder="Qué se va a hacer"
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
          <textarea
            name="description"
            rows={2}
            placeholder="Detalle (opcional)"
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
          <select
            name="ownerUserId"
            required
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
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
            name="dueAt"
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={createPending}
            className="self-start rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm text-white disabled:opacity-60"
          >
            Agregar acción
          </button>
        </form>
      ) : null}
    </section>
  );
}

function UploadEvidenceForm({
  slug,
  actionId,
  returnPath,
}: {
  slug: string;
  actionId: string;
  returnPath: string;
}) {
  const bound = uploadActionEvidenceAction.bind(null, slug, actionId);
  const [state, formAction, pending] = useActionState(bound, initial);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="returnPath" value={returnPath} />
      <input type="file" name="file" required className="text-sm" />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
      >
        Adjuntar evidencia
      </button>
      {state.error ? (
        <span className="text-xs text-[var(--color-danger)]">{state.error}</span>
      ) : null}
    </form>
  );
}

function CompleteButton({
  slug,
  actionId,
  returnPath,
}: {
  slug: string;
  actionId: string;
  returnPath: string;
}) {
  return (
    <button
      type="button"
      className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
      onClick={async () => {
        await completeActionAction(slug, actionId, returnPath);
      }}
    >
      Marcar completada
    </button>
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
    <form
      action={formAction}
      className="mt-3 flex flex-col gap-2 border-t border-[var(--color-border)] pt-3"
    >
      <input type="hidden" name="returnPath" value={returnPath} />
      <label className="text-xs font-medium">Evaluar efectividad</label>
      <select
        name="effectiveness"
        required
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm"
      >
        <option value="effective">Efectiva</option>
        <option value="partially_effective">Parcialmente efectiva</option>
        <option value="not_effective">No efectiva</option>
        <option value="not_applicable">No aplica</option>
      </select>
      <textarea
        name="note"
        rows={2}
        placeholder="Comentario (obligatorio si no es plena)"
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-[var(--color-accent)] px-2 py-1 text-xs text-white"
      >
        Guardar efectividad
      </button>
      {state.error ? (
        <span className="text-xs text-[var(--color-danger)]">{state.error}</span>
      ) : null}
      {state.ok ? (
        <span className="text-xs text-[var(--color-success)]">{state.ok}</span>
      ) : null}
    </form>
  );
}
