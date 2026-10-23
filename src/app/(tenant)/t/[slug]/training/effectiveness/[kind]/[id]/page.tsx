import Link from "next/link";
import { notFound } from "next/navigation";
import { loadTrainingAccess } from "@/app/(tenant)/t/[slug]/training/access";
import { EvaluationForm } from "@/app/(tenant)/t/[slug]/training/effectiveness/[kind]/[id]/EvaluationForm";
import { getEffectivenessTarget } from "@/lib/training-followup";
import { listTenantMembers } from "@/lib/identity";
import { trainingToday } from "@/lib/training";
import { addDays } from "@/domain/training/dates";
import { EmptyState, SectionBlock } from "@/components/ui";

const day = (iso: string) => iso.split("-").reverse().join("/");

export default async function EvaluatePage({ params }: { params: Promise<{ slug: string; kind: string; id: string }> }) {
  const { slug, kind, id } = await params;
  if (kind !== "session" && kind !== "record") notFound();
  const { tenant, canRecord } = await loadTrainingAccess(slug);
  if (!canRecord) notFound();
  const [target, members] = await Promise.all([
    getEffectivenessTarget(tenant.id, kind === "session" ? { sessionId: id } : { recordId: id }),
    listTenantMembers(tenant.id),
  ]);
  const base = `/t/${slug}/training`;
  const today = trainingToday();

  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link href={`${base}/effectiveness`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a Eficacia
        </Link>
      </p>
      {target ? (
        <SectionBlock
          title={`Evaluar eficacia: ${target.courseName}`}
          what={`Dictado el ${day(target.heldAt)}${target.siteName ? ` en ${target.siteName}` : ""}. ${target.people.length} persona(s) por evaluar.`}
          next="indicá cómo lo evaluaste y el resultado general; si alguien difiere, marcalo como excepción."
        >
          <EvaluationForm
            slug={slug}
            kind={target.kind}
            id={target.id}
            today={today}
            suggestedReschedule={addDays(today, 30)}
            suggestedActionDue={addDays(today, 15)}
            people={target.people.map((p) => ({ recordId: p.recordId, name: p.name, employeeCode: p.employeeCode }))}
            members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
          />
        </SectionBlock>
      ) : (
        <EmptyState
          what="No hay evaluaciones pendientes para esta capacitación."
          next="ya se resolvieron o se anuló la sesión."
          action={{ href: `${base}/effectiveness`, label: "Volver a Eficacia" }}
        />
      )}
    </div>
  );
}
