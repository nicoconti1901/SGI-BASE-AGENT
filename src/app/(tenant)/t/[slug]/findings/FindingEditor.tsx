"use client";

import { useActionState, useMemo, useState } from "react";
import { FiveWhysLab } from "@/app/(tenant)/t/[slug]/findings/FiveWhysLab";
import {
  saveOrPublishFindingAction,
  type FindingActionState,
} from "@/app/(tenant)/t/[slug]/findings/actions";
import {
  FINDING_TYPE_LABELS,
  MEASURE_KIND_LABELS,
  type FindingType,
  type MeasureKind,
  type RootCauseAnalysis,
} from "@/domain/findings/types";
import { getPublishBlockers } from "@/domain/findings/publish";

type MemberOption = { id: string; name: string; email: string };

type MeasureState = {
  kind: MeasureKind;
  title: string;
  description: string;
  ownerUserId: string;
  dueAt: string;
  linkedRootCause: boolean;
};

const initial: FindingActionState = {};

export function FindingEditor({
  slug,
  findingId,
  userId,
  members,
  initialValues,
}: {
  slug: string;
  findingId: string;
  userId: string;
  members: MemberOption[];
  initialValues: {
    type: FindingType;
    title: string;
    description: string;
    detectedAt: string;
    source: string;
    location: string;
    severity: string;
    rca: RootCauseAnalysis | null;
    measures: MeasureState[];
    notifyUserIds: string[];
  };
}) {
  const [type, setType] = useState(initialValues.type);
  const [title, setTitle] = useState(initialValues.title);
  const [description, setDescription] = useState(initialValues.description);
  const [detectedAt, setDetectedAt] = useState(initialValues.detectedAt);
  const [source, setSource] = useState(initialValues.source);
  const [location, setLocation] = useState(initialValues.location);
  const [severity, setSeverity] = useState(initialValues.severity);
  const [rca, setRca] = useState<RootCauseAnalysis | null>(initialValues.rca);
  const [measures, setMeasures] = useState<MeasureState[]>(
    initialValues.measures.length
      ? initialValues.measures
      : [
          {
            kind: "corrective",
            title: "",
            description: "",
            ownerUserId: members[0]?.id ?? "",
            dueAt: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
            linkedRootCause: true,
          },
        ],
  );
  const [notifyUserIds, setNotifyUserIds] = useState<string[]>(
    initialValues.notifyUserIds,
  );

  const saveAction = saveOrPublishFindingAction.bind(
    null,
    slug,
    findingId,
    "save",
  );
  const publishAction = saveOrPublishFindingAction.bind(
    null,
    slug,
    findingId,
    "publish",
  );
  const [saveState, saveFormAction, savePending] = useActionState(
    saveAction,
    initial,
  );
  const [publishState, publishFormAction, publishPending] = useActionState(
    publishAction,
    initial,
  );

  const blockers = useMemo(() => {
    if (!rca) return ["Confirmá la causa raíz en el laboratorio"];
    return getPublishBlockers({
      type,
      title,
      description,
      detectedAt: new Date(detectedAt),
      source,
      location,
      severity,
      rca,
      measures: measures.map((m) => ({
        ...m,
        dueAt: m.dueAt ? new Date(m.dueAt) : null,
      })),
      notifyUserIds,
    });
  }, [
    rca,
    type,
    title,
    description,
    detectedAt,
    source,
    location,
    severity,
    measures,
    notifyUserIds,
  ]);

  function toggleNotify(id: string) {
    setNotifyUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const sharedFields = (
    <>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="detectedAt" value={detectedAt} />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="location" value={location} />
      <input type="hidden" name="severity" value={severity} />
      <input
        type="hidden"
        name="rcaJson"
        value={rca ? JSON.stringify(rca) : ""}
      />
      <input type="hidden" name="measureCount" value={measures.length} />
      {measures.map((m, i) => (
        <span key={i}>
          <input type="hidden" name={`measureKind_${i}`} value={m.kind} />
          <input type="hidden" name={`measureTitle_${i}`} value={m.title} />
          <input type="hidden" name={`measureDesc_${i}`} value={m.description} />
          <input
            type="hidden"
            name={`measureOwner_${i}`}
            value={m.ownerUserId}
          />
          <input type="hidden" name={`measureDue_${i}`} value={m.dueAt} />
          {m.linkedRootCause ? (
            <input type="hidden" name={`measureLinked_${i}`} value="on" />
          ) : null}
        </span>
      ))}
      {notifyUserIds.map((id) => (
        <input key={id} type="hidden" name="notifyUserId" value={id} />
      ))}
    </>
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5">
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          1. Datos del hecho
        </h2>
        <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
          Tipo
          <select
            value={type}
            onChange={(e) => setType(e.target.value as FindingType)}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
          >
            {(Object.keys(FINDING_TYPE_LABELS) as FindingType[]).map((t) => (
              <option key={t} value={t}>
                {FINDING_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
          Título
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
          Descripción del hecho
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
            Detectado el
            <input
              type="date"
              value={detectedAt}
              onChange={(e) => setDetectedAt(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
            Origen
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
            />
          </label>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
          2. Análisis de causa
        </h2>
        <FiveWhysLab
          problemStatement={title || description}
          initial={rca}
          userId={userId}
          onConfirmed={setRca}
        />
        {rca?.status === "confirmed" ? (
          <p className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-success)]/30 bg-[var(--color-success-soft)] px-4 py-3 text-sm text-[var(--color-success)]">
            ★ Causa raíz confirmada: <strong>{rca.rootCause}</strong>
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            3. Medidas (responsable = usuario)
          </h2>
          <button
            type="button"
            onClick={() =>
              setMeasures((prev) => [
                ...prev,
                {
                  kind: "preventive",
                  title: "",
                  description: "",
                  ownerUserId: members[0]?.id ?? "",
                  dueAt: "",
                  linkedRootCause: false,
                },
              ])
            }
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-1.5 text-sm"
          >
            Agregar medida
          </button>
        </div>
        {measures.map((m, i) => (
          <div
            key={i}
            className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-3 sm:grid-cols-2"
          >
            <label className="flex flex-col gap-1 text-xs text-[var(--color-ink-muted)]">
              Tipo
              <select
                value={m.kind}
                onChange={(e) => {
                  const kind = e.target.value as MeasureKind;
                  setMeasures((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, kind } : x)),
                  );
                }}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-2 py-1.5 text-sm text-[var(--color-ink)]"
              >
                {(Object.keys(MEASURE_KIND_LABELS) as MeasureKind[]).map(
                  (k) => (
                    <option key={k} value={k}>
                      {MEASURE_KIND_LABELS[k]}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--color-ink-muted)]">
              Responsable
              <select
                value={m.ownerUserId}
                onChange={(e) =>
                  setMeasures((prev) =>
                    prev.map((x, idx) =>
                      idx === i ? { ...x, ownerUserId: e.target.value } : x,
                    ),
                  )
                }
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-2 py-1.5 text-sm text-[var(--color-ink)]"
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.email})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--color-ink-muted)] sm:col-span-2">
              Título
              <input
                value={m.title}
                onChange={(e) =>
                  setMeasures((prev) =>
                    prev.map((x, idx) =>
                      idx === i ? { ...x, title: e.target.value } : x,
                    ),
                  )
                }
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-2 py-1.5 text-sm text-[var(--color-ink)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--color-ink-muted)]">
              Vence
              <input
                type="date"
                value={m.dueAt}
                onChange={(e) =>
                  setMeasures((prev) =>
                    prev.map((x, idx) =>
                      idx === i ? { ...x, dueAt: e.target.value } : x,
                    ),
                  )
                }
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-2 py-1.5 text-sm text-[var(--color-ink)]"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
              <input
                type="checkbox"
                checked={m.linkedRootCause}
                onChange={(e) =>
                  setMeasures((prev) =>
                    prev.map((x, idx) =>
                      idx === i
                        ? { ...x, linkedRootCause: e.target.checked }
                        : x,
                    ),
                  )
                }
                className="size-4 accent-[var(--color-accent)]"
              />
              Ataca la causa raíz
            </label>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5">
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          4. Quién recibe la notificación
        </h2>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Solo estas personas (más los responsables de medidas) reciben el aviso
          al publicar.
        </p>
        <ul className="space-y-2">
          {members.map((member) => (
            <li key={member.id}>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifyUserIds.includes(member.id)}
                  onChange={() => toggleNotify(member.id)}
                  className="size-4 accent-[var(--color-accent)]"
                />
                {member.name} · {member.email}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <h3 className="font-medium">Revisión antes de publicar</h3>
        {blockers.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-success)]">
            Listo para publicar.
          </p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-warning)]">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <form action={saveFormAction}>
          {sharedFields}
          <button
            type="submit"
            disabled={savePending}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {savePending ? "Guardando…" : "Guardar borrador"}
          </button>
        </form>
        <form action={publishFormAction}>
          {sharedFields}
          <button
            type="submit"
            disabled={publishPending || blockers.length > 0}
            className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {publishPending ? "Publicando…" : "Publicar hallazgo"}
          </button>
        </form>
      </div>

      {saveState.error || publishState.error ? (
        <p className="text-sm text-[var(--color-danger)]">
          {saveState.error || publishState.error}
        </p>
      ) : null}
      {saveState.ok ? (
        <p className="text-sm text-[var(--color-success)]">{saveState.ok}</p>
      ) : null}
    </div>
  );
}
