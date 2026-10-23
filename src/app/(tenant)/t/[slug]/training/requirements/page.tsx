import { EmptyState, SectionBlock } from "@/components/ui";
import { loadTrainingAccess } from "@/app/(tenant)/t/[slug]/training/access";
import { RequirementGrid, type GridRow, type SavedCell } from "@/app/(tenant)/t/[slug]/training/requirements/RequirementGrid";
import { ReviewStamp } from "@/app/(tenant)/t/[slug]/training/requirements/ReviewStamp";
import { OwnerForm } from "@/app/(tenant)/t/[slug]/training/requirements/OwnerForm";
import { getMatrixReview, loadMatrix } from "@/lib/training-config";
import { getTrainingOwnerUserId } from "@/lib/training-followup";
import { listTenantMembers } from "@/lib/identity";
import { trainingToday } from "@/lib/training";
import { cellKey } from "@/domain/training/matrix";

export default async function RequirementsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, canManage } = await loadTrainingAccess(slug);
  const [matrix, review, members, ownerUserId] = await Promise.all([
    loadMatrix(tenant.id),
    getMatrixReview(tenant.id),
    canManage ? listTenantMembers(tenant.id) : Promise.resolve([]),
    canManage ? getTrainingOwnerUserId(tenant.id) : Promise.resolve(null),
  ]);

  if (matrix.courses.length === 0) {
    return (
      <EmptyState
        what="Todavía no hay cursos para exigir."
        next="cargá los cursos de la empresa o importá la lista de cursos típicos."
        action={{ href: `/t/${slug}/training/courses`, label: "Ir a Cursos" }}
      />
    );
  }

  const saved: SavedCell[] = matrix.requirements.map((r) => ({
    key: cellKey(r.targetKind, r.targetKind === "position" ? r.positionId : r.targetKind === "task" ? r.jobTaskId : null, r.courseId),
    state: r.mandatory ? "mandatory" : "recommended",
    graceDays: r.graceDays,
  }));
  const positionRows: GridRow[] = [
    { kind: "all", id: null, label: "Todo el personal" },
    ...matrix.positions.map((p) => ({ kind: "position" as const, id: p.id, label: p.name })),
  ];
  const taskRows: GridRow[] = matrix.tasks.map((t) => ({ kind: "task" as const, id: t.id, label: t.name, critical: t.critical }));

  return (
    <div className="flex flex-col gap-6">
      <RequirementGrid
        slug={slug}
        today={trainingToday()}
        canManage={canManage}
        courses={matrix.courses.map((c) => ({ id: c.id, name: c.name, category: c.category }))}
        groups={[
          {
            title: "Por puesto",
            what: "Lo que se le exige a quien ocupa el puesto. La fila «Todo el personal» sirve para inducción, toma de conciencia y evacuación.",
            rows: positionRows,
          },
          {
            title: "Por tarea",
            what: "Lo que se le exige a quien hace la tarea. En una tarea crítica, quien no tiene el curso vigente no queda habilitado.",
            rows: taskRows,
          },
        ]}
        saved={saved}
      />

      <SectionBlock
        title="Revisión de la matriz"
        what="Dejá constancia de cuándo se revisó la matriz y con quiénes. Es lo que suelen pedir en una auditoría de ISO 45001 (consulta y participación)."
      >
        {review ? (
          <p className="text-sm">
            <span className="font-semibold">Última revisión:</span>{" "}
            {new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(review.reviewedAt)}
            {review.reviewerName ? ` · ${review.reviewerName}` : ""}
            <span className="block text-[var(--color-ink-muted)]">{review.note}</span>
          </p>
        ) : (
          <p className="text-sm text-[var(--color-ink-muted)]">Todavía no se registró ninguna revisión.</p>
        )}
        {canManage ? <ReviewStamp slug={slug} /> : null}
      </SectionBlock>

      {canManage ? (
        <SectionBlock
          title="Avisos de vencimiento"
          what="Un aviso por persona con lo que vence o falta, no uno por curso. Se actualiza solo cuando se registra una capacitación."
        >
          <OwnerForm slug={slug} members={members.map((m) => ({ id: m.user.id, name: m.user.name }))} current={ownerUserId} />
        </SectionBlock>
      ) : null}
    </div>
  );
}
