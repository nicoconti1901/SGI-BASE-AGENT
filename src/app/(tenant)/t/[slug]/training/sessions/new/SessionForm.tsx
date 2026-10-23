"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { registerSessionAction, searchAttendeesAction, uploadTrainingAttachmentAction } from "@/app/(tenant)/t/[slug]/training/records-actions";

type Option = { id: string; name: string };
type Candidate = { id: string; name: string; employeeCode: string; positionName: string; siteName: string };
type Attendance = { result: "passed" | "failed"; score: string };

export type SessionFormProps = {
  slug: string;
  today: string;
  courses: (Option & { defaultHours: number | null; requiresEffectiveness: boolean; defaultProvider: string | null })[];
  sites: Option[];
  positions: Option[];
  members: Option[];
};

/** Alta de una sesión: curso y datos, asistentes tildados por sede o puesto, resultado de cada uno y planilla. */
export function SessionForm({ slug, today, courses, sites, positions, members }: SessionFormProps) {
  const router = useRouter();
  const sheetRef = useRef<HTMLInputElement>(null);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [heldAt, setHeldAt] = useState(today);
  const [siteId, setSiteId] = useState("");
  const [level, setLevel] = useState("");
  const [instructorKind, setInstructorKind] = useState<"internal" | "external">("internal");
  const [instructorName, setInstructorName] = useState("");
  const [providerName, setProviderName] = useState("");
  const [hours, setHours] = useState("");
  const [evaluatorUserId, setEvaluatorUserId] = useState("");
  const [notes, setNotes] = useState("");

  const [filterSite, setFilterSite] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [attending, setAttending] = useState<Record<string, Attendance>>({});
  const [names, setNames] = useState<Record<string, string>>({});

  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const course = courses.find((c) => c.id === courseId);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchAttendeesAction(slug, { siteId: filterSite || undefined, positionId: filterPosition || undefined, q: query || undefined });
      if (!cancelled) {
        setCandidates(found);
        setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, filterSite, filterPosition, query]);

  const selectedIds = useMemo(() => Object.keys(attending), [attending]);
  const allVisible = candidates.length > 0 && candidates.every((c) => attending[c.id]);

  function toggle(c: Candidate) {
    setNames((n) => ({ ...n, [c.id]: c.name }));
    setAttending((prev) => {
      const next = { ...prev };
      if (next[c.id]) delete next[c.id];
      else next[c.id] = { result: "passed", score: "" };
      return next;
    });
  }

  function toggleAllVisible() {
    setNames((n) => ({ ...n, ...Object.fromEntries(candidates.map((c) => [c.id, c.name])) }));
    setAttending((prev) => {
      const next = { ...prev };
      for (const c of candidates) {
        if (allVisible) delete next[c.id];
        else next[c.id] ??= { result: "passed", score: "" };
      }
      return next;
    });
  }

  function submit() {
    setError(null);
    if (!course) return setError("Elegí el curso");
    start(async () => {
      const result = await registerSessionAction(slug, {
        courseId,
        heldAt,
        siteId: siteId || null,
        level: (level || null) as "senior" | "middle" | "operational" | null,
        instructorKind,
        instructorName,
        providerName: providerName || null,
        hours: hours ? Number(hours.replace(",", ".")) : null,
        evaluatorUserId: evaluatorUserId || null,
        notes: notes || null,
        attendees: selectedIds.map((personId) => ({
          personId,
          result: attending[personId].result,
          score: attending[personId].score === "" ? null : Number(attending[personId].score),
        })),
      });
      if (!result.ok) return setError(result.error);
      const file = sheetRef.current?.files?.[0];
      if (file) {
        const data = new FormData();
        data.set("file", file);
        await uploadTrainingAttachmentAction(slug, "session", result.sessionId, data);
      }
      router.push(`/t/${slug}/training/sessions/${result.sessionId}`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Datos de la sesión" className="grid gap-3 sm:grid-cols-2">
        <Field label="Curso" required>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={INPUT_CLASS}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha en que se dictó" required hint="No puede ser futura.">
          <input type="date" value={heldAt} max={today} onChange={(e) => setHeldAt(e.target.value)} className={INPUT_CLASS} />
        </Field>
        <Field label="Quién la dictó" required>
          <div className="flex gap-2">
            <select value={instructorKind} onChange={(e) => setInstructorKind(e.target.value as "internal" | "external")} className={`${INPUT_CLASS} w-36`} aria-label="Tipo de instructor">
              <option value="internal">Interno</option>
              <option value="external">Externo</option>
            </select>
            <input value={instructorName} onChange={(e) => setInstructorName(e.target.value)} placeholder="Nombre" className={`${INPUT_CLASS} min-w-0 flex-1`} />
          </div>
        </Field>
        <Field label="Proveedor o institución" hint="Opcional.">
          <input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder={course?.defaultProvider ?? ""} className={INPUT_CLASS} />
        </Field>
        <Field label="Sede donde se dictó" hint="Opcional.">
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={INPUT_CLASS}>
            <option value="">—</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Duración (horas)" hint={course?.defaultHours ? `Sugerida: ${course.defaultHours} h.` : "Opcional."}>
          <input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" className={INPUT_CLASS} />
        </Field>
        <Field label="Nivel" hint="Para el plan anual (Dec. 351 art. 210). Opcional.">
          <select value={level} onChange={(e) => setLevel(e.target.value)} className={INPUT_CLASS}>
            <option value="">—</option>
            <option value="senior">Superior</option>
            <option value="middle">Intermedio</option>
            <option value="operational">Operativo</option>
          </select>
        </Field>
        {course?.requiresEffectiveness ? (
          <Field label="Quién evalúa la eficacia" hint="Este curso pide evaluar si funcionó, más adelante.">
            <select value={evaluatorUserId} onChange={(e) => setEvaluatorUserId(e.target.value)} className={INPUT_CLASS}>
              <option value="">Sin designar</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <div className="sm:col-span-2">
          <Field label="Observaciones" hint="Contenido tratado u otro dato. Opcional.">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={INPUT_CLASS} />
          </Field>
        </div>
      </section>

      <section aria-label="Asistentes" className="flex flex-col gap-3">
        <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">Asistentes · {selectedIds.length} elegido(s)</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Buscar" hint="Nombre o legajo.">
            <input value={query} onChange={(e) => setQuery(e.target.value)} className={INPUT_CLASS} />
          </Field>
          <Field label="Sede">
            <select value={filterSite} onChange={(e) => setFilterSite(e.target.value)} className={INPUT_CLASS}>
              <option value="">Todas</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Puesto">
            <select value={filterPosition} onChange={(e) => setFilterPosition(e.target.value)} className={INPUT_CLASS}>
              <option value="">Todos</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-line)]">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Personas que se pueden tildar como asistentes</caption>
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] text-xs text-[var(--color-ink-muted)]">
              <tr>
                <th scope="col" className="w-12 px-3 py-2">
                  <input type="checkbox" checked={allVisible} onChange={toggleAllVisible} aria-label="Tildar a todas las personas de la lista" className="h-5 w-5" />
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">Persona</th>
                <th scope="col" className="px-3 py-2 font-semibold">Puesto · Sede</th>
                <th scope="col" className="px-3 py-2 font-semibold">Resultado</th>
                <th scope="col" className="w-24 px-3 py-2 font-semibold">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {candidates.map((c) => {
                const a = attending[c.id];
                return (
                  <tr key={c.id}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={Boolean(a)} onChange={() => toggle(c)} aria-label={`Asistió ${c.name}`} className="h-5 w-5" />
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {c.name}
                      <span className="block font-[family-name:var(--font-mono)] text-[11px] font-normal text-[var(--color-ink-muted)]">{c.employeeCode}</span>
                    </td>
                    <td className="px-3 py-2 text-[var(--color-ink-muted)]">
                      {c.positionName} · {c.siteName}
                    </td>
                    <td className="px-3 py-2">
                      {a ? (
                        <select value={a.result} onChange={(e) => setAttending((p) => ({ ...p, [c.id]: { ...a, result: e.target.value as "passed" | "failed" } }))} className={INPUT_CLASS} aria-label={`Resultado de ${c.name}`}>
                          <option value="passed">Aprobó</option>
                          <option value="failed">No aprobó</option>
                        </select>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {a ? <input value={a.score} onChange={(e) => setAttending((p) => ({ ...p, [c.id]: { ...a, score: e.target.value } }))} inputMode="numeric" placeholder="0–100" className={`${INPUT_CLASS} w-20`} aria-label={`Nota de ${c.name}`} /> : null}
                    </td>
                  </tr>
                );
              })}
              {!loading && candidates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-[var(--color-ink-muted)]">
                    Ninguna persona coincide.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {selectedIds.some((id) => !candidates.some((c) => c.id === id)) ? (
          <p className="text-xs text-[var(--color-ink-muted)]">
            También elegidos (fuera del filtro actual): {selectedIds.filter((id) => !candidates.some((c) => c.id === id)).map((id) => names[id]).join(", ")}.
          </p>
        ) : null}
      </section>

      <Field label="Planilla de asistencia firmada" hint="PDF, JPG o PNG, hasta 10 MB. Opcional ahora: la podés subir después desde la sesión.">
        <input ref={sheetRef} type="file" accept="application/pdf,image/jpeg,image/png" className="text-sm" />
      </Field>

      {error ? <FormError>{error}</FormError> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={submit} disabled={saving || selectedIds.length === 0 || !instructorName.trim()} className="min-h-12">
          {saving ? "Guardando…" : `Registrar sesión con ${selectedIds.length} asistente(s)`}
        </Button>
        <span className="text-sm text-[var(--color-ink-muted)]">Se crea un registro por persona y se calcula su vencimiento con la vigencia del curso.</span>
      </div>
    </div>
  );
}
