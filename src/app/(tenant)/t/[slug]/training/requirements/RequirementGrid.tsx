"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, FormError, HintCallout, INPUT_CLASS, SectionBlock, StatusChip } from "@/components/ui";
import { previewRequirementImpactAction, saveRequirementsAction } from "@/app/(tenant)/t/[slug]/training/actions";
import { addDays } from "@/domain/training/dates";
import type { CourseCategoryValue } from "@/domain/training/courses";
import {
  cellKey,
  defaultGraceDays,
  diffMatrix,
  matrixWarnings,
  type CellState,
  type MatrixCell,
  type MatrixChange,
} from "@/domain/training/matrix";
import type { TargetKind } from "@/domain/training/types";
import type { ImpactRow } from "@/lib/training-config";

export type GridCourse = { id: string; name: string; category: CourseCategoryValue };
export type GridRow = { kind: TargetKind; id: string | null; label: string; critical?: boolean };
export type SavedCell = { key: string; state: Exclude<CellState, "none">; graceDays: number };

const STATE_LABELS: Record<CellState, string> = { none: "—", mandatory: "Obligatorio", recommended: "Recomendado" };

/**
 * Editor de la matriz: puestos y tareas en filas, cursos en columnas. Cada celda alterna entre
 * "—", "obligatorio" y "recomendado"; el plazo de gracia se edita por celda. Los cambios quedan en un
 * borrador: antes de guardar se muestra el impacto sobre las personas.
 */
export function RequirementGrid({
  slug,
  today,
  canManage,
  courses,
  groups,
  saved,
}: {
  slug: string;
  today: string;
  canManage: boolean;
  courses: GridCourse[];
  groups: { title: string; what: string; rows: GridRow[] }[];
  saved: SavedCell[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const savedMap = useMemo(() => new Map<string, MatrixCell>(saved.map((s) => [s.key, { state: s.state, graceDays: s.graceDays }])), [saved]);
  const [draft, setDraft] = useState<Map<string, MatrixCell>>(new Map());
  const [impact, setImpact] = useState<ImpactRow[] | null>(null);
  const [message, setMessage] = useState<{ error?: string; ok?: string }>({});

  const effective = useMemo(() => {
    const map = new Map(savedMap);
    for (const [key, cell] of draft) map.set(key, cell);
    return map;
  }, [savedMap, draft]);
  const changes = useMemo(() => diffMatrix(savedMap, draft), [savedMap, draft]);
  const allRows = groups.flatMap((g) => g.rows);
  const warnings = useMemo(
    () =>
      matrixWarnings({
        tasks: allRows.filter((r) => r.kind === "task").map((r) => ({ id: r.id!, name: r.label, critical: Boolean(r.critical) })),
        courses,
        cells: effective,
      }),
    // allRows se arma desde `groups`, que no cambia entre renders del mismo servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, courses, effective],
  );

  function edit(row: GridRow, course: GridCourse, next: Partial<MatrixCell>) {
    const key = cellKey(row.kind, row.id, course.id);
    const current = effective.get(key) ?? { state: "none" as const, graceDays: 0 };
    let cell: MatrixCell = { ...current, ...next };
    if (next.state && next.state !== "none" && current.state === "none") {
      cell = { state: next.state, graceDays: defaultGraceDays({ category: course.category, targetKind: row.kind, taskCritical: Boolean(row.critical) }) };
    }
    setDraft((d) => new Map(d).set(key, cell));
    setImpact(null);
    setMessage({});
  }

  function review() {
    setMessage({});
    start(async () => {
      const res = await previewRequirementImpactAction(slug, changes);
      if ("error" in res) setMessage({ error: res.error });
      else setImpact(res.impact);
    });
  }

  function save() {
    start(async () => {
      const res = await saveRequirementsAction(slug, changes);
      setMessage(res);
      if (res.ok) {
        setDraft(new Map());
        setImpact(null);
        router.refresh();
      }
    });
  }

  function discard() {
    setDraft(new Map());
    setImpact(null);
    setMessage({});
  }

  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? "";
  const rowLabel = (c: MatrixChange) => allRows.find((r) => r.kind === c.targetKind && r.id === c.targetId)?.label ?? "";
  const impactOf = (c: MatrixChange) => impact?.find((i) => i.targetKind === c.targetKind && i.targetId === c.targetId && i.courseId === c.courseId);

  return (
    <div className="flex flex-col gap-6">
      {!canManage ? (
        <HintCallout>Solo lectura: quien administra o es responsable de proceso define qué se le exige a cada puesto y tarea.</HintCallout>
      ) : null}

      {warnings.length > 0 ? (
        <ul aria-label="Advertencias" className="flex flex-col gap-2">
          {warnings.map((w, i) => (
            <li key={`${w.kind}-${w.targetId}-${i}`} className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] px-3 py-2 text-sm text-[var(--color-warning)]">
              <span className="font-semibold">Atención:</span>
              <span>{w.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {groups.map((group) => (
        <SectionBlock key={group.title} title={group.title} what={group.what}>
          {group.rows.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-muted)]">Todavía no hay nada para mostrar acá. Cargalo en Datos maestros.</p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[var(--color-surface-sunken)]">
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 min-w-44 bg-[var(--color-surface-sunken)] px-3 py-2 text-left font-semibold">
                      {group.title === "Por tarea" ? "Tarea" : group.title === "Por puesto" ? "Puesto" : "Destino"}
                    </th>
                    {courses.map((c) => (
                      <th key={c.id} scope="col" className="min-w-36 px-3 py-2 text-left font-semibold">
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {group.rows.map((row) => (
                    <tr key={`${row.kind}-${row.id}`}>
                      <th scope="row" className="sticky left-0 z-10 bg-[var(--color-surface-raised)] px-3 py-2 text-left font-medium">
                        <span className="flex flex-wrap items-center gap-2">
                          {row.label}
                          {row.critical ? <StatusChip status="warning" label="Crítica" /> : null}
                        </span>
                      </th>
                      {courses.map((course) => {
                        const key = cellKey(row.kind, row.id, course.id);
                        const cell = effective.get(key) ?? { state: "none" as const, graceDays: 0 };
                        const edited = draft.has(key) && diffMatrix(savedMap, new Map([[key, cell]])).length > 0;
                        const name = `${row.label} — ${course.name}`;
                        return (
                          <td key={course.id} className={`px-3 py-2 align-top ${edited ? "bg-[var(--color-accent-soft)]" : ""}`}>
                            {canManage ? (
                              <div className="flex flex-col gap-1">
                                <select
                                  aria-label={`Exigencia: ${name}`}
                                  value={cell.state}
                                  onChange={(e) => edit(row, course, { state: e.target.value as CellState })}
                                  className={`${INPUT_CLASS} min-h-9 px-2 py-1`}
                                >
                                  {(Object.keys(STATE_LABELS) as CellState[]).map((s) => (
                                    <option key={s} value={s}>
                                      {STATE_LABELS[s]}
                                    </option>
                                  ))}
                                </select>
                                {cell.state !== "none" ? (
                                  <label className="flex items-center gap-1 text-xs text-[var(--color-ink-muted)]">
                                    Gracia
                                    <input
                                      type="number"
                                      min={0}
                                      max={365}
                                      step={1}
                                      aria-label={`Plazo de gracia en días: ${name}`}
                                      value={cell.graceDays}
                                      onChange={(e) => edit(row, course, { graceDays: Math.max(0, Math.min(365, Math.trunc(Number(e.target.value)) || 0)) })}
                                      className={`${INPUT_CLASS} min-h-8 w-16 px-2 py-0.5`}
                                    />
                                    días
                                  </label>
                                ) : null}
                              </div>
                            ) : cell.state === "none" ? (
                              <span className="text-[var(--color-ink-muted)]">—</span>
                            ) : (
                              <span>
                                {STATE_LABELS[cell.state]}
                                <span className="block text-xs text-[var(--color-ink-muted)]">Gracia: {cell.graceDays} días</span>
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionBlock>
      ))}

      {canManage ? (
        <section aria-label="Guardar cambios" className="sticky bottom-3 flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line-strong)] bg-[var(--color-surface-raised)] p-4 shadow-[var(--shadow-soft)]">
          {changes.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-muted)]">
              {message.ok ? <span role="status" className="text-[var(--color-success)]">{message.ok}</span> : "Elegí en la grilla qué se exige a cada puesto o tarea. Antes de guardar vas a ver a cuántas personas alcanza."}
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold">
                {changes.length} {changes.length === 1 ? "cambio sin guardar" : "cambios sin guardar"}
              </p>
              {impact ? (
                <ul aria-label="Impacto de los cambios" className="flex flex-col gap-1 text-sm">
                  {changes.map((c) => {
                    const where = `${courseName(c.courseId)} · ${rowLabel(c)}`;
                    if (c.state === "none") {
                      return <li key={cellKey(c.targetKind, c.targetId, c.courseId)}>{where}: se quita el requisito.</li>;
                    }
                    const i = impactOf(c);
                    if (!i) return <li key={cellKey(c.targetKind, c.targetId, c.courseId)}>{where}</li>;
                    const pendingPeople = i.affected - i.covered;
                    return (
                      <li key={cellKey(c.targetKind, c.targetId, c.courseId)}>
                        <strong>{where}:</strong>{" "}
                        {c.state === "mandatory" ? "exige" : "recomienda"} a {i.affected} {i.affected === 1 ? "persona" : "personas"}
                        {i.affected > 0
                          ? `: ${i.covered} ya lo ${i.covered === 1 ? "tiene" : "tienen"} vigente${
                              c.state === "mandatory" && pendingPeople > 0
                                ? `, ${pendingPeople} ${pendingPeople === 1 ? "queda" : "quedan"} con plazo hasta el ${addDays(today, c.graceDays).split("-").reverse().join("/")}`
                                : ""
                            }.`
                          : "."}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {message.error ? <FormError>{message.error}</FormError> : null}
              <div className="flex flex-wrap items-center gap-2">
                {impact ? (
                  <Button type="button" onClick={save} disabled={pending}>
                    {pending ? "Guardando…" : "Confirmar y guardar"}
                  </Button>
                ) : (
                  <Button type="button" onClick={review} disabled={pending}>
                    {pending ? "Calculando…" : "Ver el impacto"}
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={discard} disabled={pending}>
                  Descartar cambios
                </Button>
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
