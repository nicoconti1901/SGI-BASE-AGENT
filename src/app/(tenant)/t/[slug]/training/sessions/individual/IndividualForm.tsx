"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { PersonPicker } from "@/components/pickers/PersonPicker";
import type { PersonOption } from "@/components/pickers/picker-actions";
import { addIndividualRecordAction, uploadTrainingAttachmentAction } from "@/app/(tenant)/t/[slug]/training/records-actions";

export type IndividualFormProps = {
  slug: string;
  today: string;
  courses: { id: string; name: string; validityMonths: number | null; requiresEffectiveness: boolean }[];
  members: { id: string; name: string }[];
  defaultPerson: PersonOption | null;
};

/** Carga de un certificado externo o de una capacitación individual, con su propia fecha de vencimiento si la trae. */
export function IndividualForm({ slug, today, courses, members, defaultPerson }: IndividualFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [person, setPerson] = useState<PersonOption | null>(defaultPerson);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [completedAt, setCompletedAt] = useState(today);
  const [result, setResult] = useState<"passed" | "failed">("passed");
  const [score, setScore] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [providerName, setProviderName] = useState("");
  const [certificateNumber, setCertificateNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [evaluatorUserId, setEvaluatorUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const course = courses.find((c) => c.id === courseId);

  function submit() {
    setError(null);
    if (!person) return setError("Elegí la persona");
    start(async () => {
      const done = await addIndividualRecordAction(slug, {
        personId: person.id,
        courseId,
        completedAt,
        result,
        score: score === "" ? null : Number(score),
        validUntil: result === "passed" && validUntil ? validUntil : null,
        providerName: providerName || null,
        certificateNumber: certificateNumber || null,
        notes: notes || null,
        evaluatorUserId: evaluatorUserId || null,
      });
      if (!done.ok) return setError(done.error);
      const file = fileRef.current?.files?.[0];
      if (file) {
        const data = new FormData();
        data.set("file", file);
        await uploadTrainingAttachmentAction(slug, "record", done.recordId, data);
      }
      router.push(`/t/${slug}/training/people/${person.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <PersonPicker slug={slug} name="personId" label="Persona" required defaultPerson={defaultPerson} onChange={setPerson} />
        <Field label="Curso" required>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={INPUT_CLASS}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha de la capacitación" required hint="No puede ser futura.">
          <input type="date" value={completedAt} max={today} onChange={(e) => setCompletedAt(e.target.value)} className={INPUT_CLASS} />
        </Field>
        <Field label="Resultado">
          <select value={result} onChange={(e) => setResult(e.target.value as "passed" | "failed")} className={INPUT_CLASS}>
            <option value="passed">Aprobó</option>
            <option value="failed">No aprobó</option>
          </select>
        </Field>
        {result === "passed" ? (
          <Field
            label="Vence (según el certificado)"
            hint={course?.validityMonths ? `Si lo dejás vacío se calcula con la vigencia del curso (${course.validityMonths} meses).` : "Si lo dejás vacío, el curso no vence."}
          >
            <input type="date" value={validUntil} min={completedAt} onChange={(e) => setValidUntil(e.target.value)} className={INPUT_CLASS} />
          </Field>
        ) : null}
        <Field label="Nota" hint="Opcional, de 0 a 100. Es informativa.">
          <input value={score} onChange={(e) => setScore(e.target.value)} inputMode="numeric" className={INPUT_CLASS} />
        </Field>
        <Field label="Proveedor o institución" hint="Opcional.">
          <input value={providerName} onChange={(e) => setProviderName(e.target.value)} className={INPUT_CLASS} />
        </Field>
        <Field label="N.º de certificado" hint="Opcional.">
          <input value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} className={INPUT_CLASS} />
        </Field>
        {course?.requiresEffectiveness && result === "passed" ? (
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
          <Field label="Observaciones" hint="Opcional.">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={INPUT_CLASS} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Certificado" hint="PDF, JPG o PNG, hasta 10 MB. Opcional ahora: lo podés subir después desde la ficha.">
            <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" className="text-sm" />
          </Field>
        </div>
      </div>
      {error ? <FormError>{error}</FormError> : null}
      <div>
        <Button type="button" onClick={submit} disabled={saving || !person} className="min-h-12">
          {saving ? "Guardando…" : "Registrar capacitación"}
        </Button>
      </div>
    </div>
  );
}
