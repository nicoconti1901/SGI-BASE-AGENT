"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { planSessionAction } from "@/app/(tenant)/t/[slug]/training/followup-actions";
import { PLAN_LEVEL_LABELS } from "@/domain/training/plan-labels";

type Option = { id: string; name: string };

/** Agrega una sesión al plan anual: curso, fecha, sede y nivel. */
export function PlanForm({ slug, today, courses, sites }: { slug: string; today: string; courses: Option[]; sites: Option[] }) {
  const router = useRouter();
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [plannedFor, setPlannedFor] = useState(today);
  const [siteId, setSiteId] = useState("");
  const [level, setLevel] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await planSessionAction(slug, {
        courseId,
        plannedFor,
        siteId: siteId || null,
        level: (level || null) as "senior" | "middle" | "operational" | null,
        notes: notes || null,
      });
      if (!result.ok) return setError(result.error);
      setNotes("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Planificar una sesión">
      <Field label="Curso" required>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={INPUT_CLASS}>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Fecha prevista" required>
        <input type="date" value={plannedFor} onChange={(e) => setPlannedFor(e.target.value)} className={INPUT_CLASS} />
      </Field>
      <Field label="Sede">
        <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={INPUT_CLASS}>
          <option value="">Toda la empresa</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Nivel" hint="A quién va dirigida.">
        <select value={level} onChange={(e) => setLevel(e.target.value)} className={INPUT_CLASS}>
          <option value="">Sin definir</option>
          {Object.entries(PLAN_LEVEL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2 lg:col-span-3">
        <Field label="Notas">
          <input value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} className={INPUT_CLASS} />
        </Field>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={saving || !courseId}>
          {saving ? "Agregando…" : "Agregar al plan"}
        </Button>
      </div>
      {error ? (
        <div className="sm:col-span-2 lg:col-span-4">
          <FormError>{error}</FormError>
        </div>
      ) : null}
    </form>
  );
}
