import { EmptyState, HintCallout, SectionBlock, StatusChip } from "@/components/ui";
import { loadTrainingAccess } from "@/app/(tenant)/t/[slug]/training/access";
import {
  CourseActiveToggle,
  CourseForm,
  RecalculateValidity,
  SuggestedImport,
  type CourseView,
} from "@/app/(tenant)/t/[slug]/training/courses/CourseForms";
import { listCourses, listImportedSuggestions } from "@/lib/training-config";
import { COURSE_CATEGORY_LABELS, COURSE_MODALITY_LABELS } from "@/domain/training/courses";
import { SUGGESTED_CONFIDENCE_LABELS, SUGGESTED_COURSES } from "@/domain/training/suggested-catalog";

const CONFIDENCE_TONE = { verified: "ok", topic: "info", practice: "pending", to_validate: "warning" } as const;

function validityText(months: number | null) {
  return months === null ? "No vence" : `Vigencia: ${months} meses`;
}

export default async function CoursesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, canManage } = await loadTrainingAccess(slug);
  const [rows, imported] = await Promise.all([listCourses(tenant.id, { includeInactive: true }), listImportedSuggestions(tenant.id)]);
  const courses: CourseView[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    category: c.category,
    modality: c.modality,
    standards: c.standards,
    defaultHours: c.defaultHours === null ? null : Number(c.defaultHours),
    validityMonths: c.validityMonths,
    reminderDays: c.reminderDays,
    requiresEffectiveness: c.requiresEffectiveness,
    effectivenessDays: c.effectivenessDays,
    legalBasis: c.legalBasis,
    defaultProvider: c.defaultProvider,
    active: c.active,
  }));
  const active = courses.filter((c) => c.active);
  const inactive = courses.filter((c) => !c.active);

  return (
    <div className="flex flex-col gap-6">
      {canManage ? (
        <SectionBlock
          title="Nuevo curso"
          what="Lo que la empresa enseña o exige: cada curso define cuánto dura su vigencia."
          next="cargá el curso y después indicá, en Requisitos, a quién se le exige."
        >
          <CourseForm slug={slug} submitLabel="Registrar curso" />
        </SectionBlock>
      ) : (
        <HintCallout>Solo lectura: quien administra o es responsable de proceso es quien da de alta y modifica los cursos.</HintCallout>
      )}

      <SectionBlock title={`Cursos (${active.length})`}>
        {active.length === 0 ? (
          <EmptyState
            what="Todavía no hay cursos."
            next={canManage ? "registrá el primero arriba o importá una lista de cursos típicos más abajo." : "pedile a quien administra que los cargue."}
          />
        ) : (
          <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            {active.map((c) => (
              <CourseRow key={c.id} slug={slug} course={c} canManage={canManage} />
            ))}
          </ul>
        )}
      </SectionBlock>

      {inactive.length > 0 ? (
        <SectionBlock title={`Cursos dados de baja (${inactive.length})`} what="Conservan su historial pero no se pueden exigir ni registrar.">
          <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            {inactive.map((c) => (
              <CourseRow key={c.id} slug={slug} course={c} canManage={canManage} />
            ))}
          </ul>
        </SectionBlock>
      ) : null}

      {canManage ? (
        <SectionBlock
          title="Cursos típicos para importar"
          what="Una lista de partida: elegís cuáles sumar y todas las vigencias se pueden editar. Las vigencias son sugerencias, no asesoramiento legal."
          next="importá los que apliquen a tu empresa y confirmá con tu profesional de Higiene y Seguridad los marcados «A validar»."
        >
          <SuggestedImport
            slug={slug}
            suggestions={SUGGESTED_COURSES.map((s) => ({
              key: s.key,
              name: s.course.name,
              usualTarget: s.usualTarget,
              confidenceLabel: SUGGESTED_CONFIDENCE_LABELS[s.confidence].label,
              confidenceHint: SUGGESTED_CONFIDENCE_LABELS[s.confidence].hint,
              confidenceTone: CONFIDENCE_TONE[s.confidence],
              source: s.source,
              validity: validityText(s.course.validityMonths ?? null),
              imported: imported.has(s.key),
            }))}
          />
        </SectionBlock>
      ) : null}
    </div>
  );
}

function CourseRow({ slug, course, canManage }: { slug: string; course: CourseView; canManage: boolean }) {
  const meta = [
    COURSE_CATEGORY_LABELS[course.category],
    COURSE_MODALITY_LABELS[course.modality],
    validityText(course.validityMonths),
    course.code ? `Código ${course.code}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium">{course.name}</span>
          <span className="ml-2 text-sm text-[var(--color-ink-muted)]">· {meta}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {course.requiresEffectiveness ? <StatusChip status="info" label="Evalúa eficacia" /> : null}
          <StatusChip status={course.active ? "ok" : "pending"} label={course.active ? "Activo" : "De baja"} />
        </div>
      </div>
      {canManage ? (
        <div className="flex flex-col gap-3">
          {course.active ? (
            <details className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)]">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-[var(--color-accent)]">Editar {course.name}</summary>
              <div className="flex flex-col gap-4 border-t border-[var(--color-line)] p-3">
                <CourseForm slug={slug} course={course} submitLabel="Guardar cambios" />
                <RecalculateValidity slug={slug} course={course} />
              </div>
            </details>
          ) : null}
          <CourseActiveToggle slug={slug} course={course} />
        </div>
      ) : null}
    </li>
  );
}
