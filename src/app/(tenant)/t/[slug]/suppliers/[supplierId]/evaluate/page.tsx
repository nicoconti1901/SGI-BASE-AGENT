import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, SectionBlock, buttonClass } from "@/components/ui";
import { listTenantMemberOptions } from "@/lib/findings";
import { getSupplier } from "@/lib/suppliers";
import { getPublishedTemplate } from "@/lib/supplier-criteria";
import { listSupplierDocuments } from "@/lib/supplier-documents";
import { loadSupplierAccess } from "@/app/(tenant)/t/[slug]/suppliers/access";
import { EvaluateForm } from "@/app/(tenant)/t/[slug]/suppliers/[supplierId]/evaluate/EvaluateForm";
import { EvidencePanel } from "@/app/(tenant)/t/[slug]/suppliers/[supplierId]/evaluate/EvidencePanel";
import { getEvaluationEvidence } from "@/lib/supplier-evidence";
import { eventReevaluationReasons } from "@/domain/suppliers/schedule";
import { addDays, buenosAiresToday, isoDay } from "@/domain/suppliers/dates";
import { SUPPLIER_CRITICALITY_LABELS, SUPPLIER_TYPE_LABELS } from "@/domain/suppliers/types";
import type { EvaluationKindValue } from "@/domain/suppliers/evaluation";

const DOC_STATUS_TEXT = { missing: "falta", expired: "vencido", expiring: "por vencer", valid: "vigente" } as const;

export default async function EvaluateSupplierPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; supplierId: string }>;
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { slug, supplierId } = await params;
  const sp = await searchParams;
  const { ctx, tenant, canEvaluate } = await loadSupplierAccess(slug);
  if (!canEvaluate) notFound();
  const supplier = await getSupplier(tenant.id, supplierId);
  if (!supplier) notFound();

  const back = `/t/${slug}/suppliers/${supplier.id}`;
  const header = (
    <p>
      <Link href={back} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
        ← Volver a la ficha
      </Link>
    </p>
  );

  if (supplier.status === "inactive") {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState what="El proveedor está de baja." next="reactivalo desde su ficha para poder evaluarlo." />
      </div>
    );
  }

  const now = new Date();
  const [template, members, docs, evidence] = await Promise.all([
    getPublishedTemplate(tenant.id, supplier.type),
    listTenantMemberOptions(tenant.id),
    listSupplierDocuments(tenant.id, supplier.id, now),
    getEvaluationEvidence(tenant.id, supplier.id),
  ]);
  // El resumen guarda la última evaluación no anulada: si no hay, toca la inicial.
  const hasEvaluation = supplier.lastEvaluationId !== null;
  const kinds: EvaluationKindValue[] = hasEvaluation ? ["periodic", "event"] : ["initial"];

  if (!template) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState what="No hay criterios publicados para este tipo de proveedor." next="publicalos en «Criterios y documentos»." />
      </div>
    );
  }

  const docLines = docs.filter((d) => d.status !== "valid").map((d) => `${d.type.name.split(" (")[0]}: ${DOC_STATUS_TEXT[d.status]}`);
  const today = buenosAiresToday(now);
  // Sin evaluación previa no hay a qué reevaluar: los motivos solo aplican a una reevaluación.
  const reasons = hasEvaluation
    ? eventReevaluationReasons({
        openFindingsSinceLast: evidence.openFindingsSinceLast,
        planClosed: evidence.planClosed,
        blockingDocsIssue: supplier.missingBlockingDocs > 0 || (supplier.blockingDocExpiresAt !== null && supplier.blockingDocExpiresAt < today),
      })
    : [];
  const defaultKind: EvaluationKindValue | undefined = sp.tipo === "event" ? "event" : undefined;

  return (
    <div className="flex flex-col gap-4">
      {header}
      <SectionBlock
        eyebrow="Proveedores · ISO 9001 §8.4.1 · §8.4.2"
        title={`${hasEvaluation ? "Reevaluar" : "Evaluar"}: ${supplier.legalName}`}
        what={`${SUPPLIER_TYPE_LABELS[supplier.type]} · criticidad ${SUPPLIER_CRITICALITY_LABELS[supplier.criticality].toLowerCase()}. Cada criterio se califica de 1 a 5; el puntaje y el resultado se calculan solos.`}
        next="calificá cada criterio y, si la nota es baja, explicá por qué."
      >
        <EvidencePanel slug={slug} evidence={evidence} reasons={reasons} documents={docLines} />
        <EvaluateForm
          slug={slug}
          supplierId={supplier.id}
          criticality={supplier.criticality}
          kinds={kinds}
          defaultKind={defaultKind}
          template={{
            version: template.version,
            approvedMin: template.approvedMin,
            conditionalMin: template.conditionalMin,
            criteria: template.criteria.map((c) => ({
              id: c.id, name: c.name, description: c.description, descriptor1: c.descriptor1, descriptor3: c.descriptor3,
              descriptor5: c.descriptor5, weight: c.weight, excluding: c.excluding, allowNA: c.allowNA, phase: c.phase, basic: c.basic,
            })),
          }}
          members={members.map((m) => ({ id: m.id, name: m.name }))}
          currentUserId={ctx.userId}
          evidence={[]}
          defaultPlanDue={isoDay(addDays(today, 30))}
        />
      </SectionBlock>
      <p>
        <Link href={`/t/${slug}/suppliers/criteria?tipo=${supplier.type}`} className={buttonClass("ghost")}>
          Ver los criterios completos
        </Link>
      </p>
    </div>
  );
}
