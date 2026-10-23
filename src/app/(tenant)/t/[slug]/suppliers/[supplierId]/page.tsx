import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader, SectionBlock, StatGrid, StatTile, StatusChip, buttonClass } from "@/components/ui";
import { getSupplier, listSupplierPeople, searchLinkablePeople } from "@/lib/suppliers";
import { getSupplierEvaluation, listSupplierEvaluations } from "@/lib/supplier-evaluations";
import { listSupplierDocumentHistory, listSupplierDocuments } from "@/lib/supplier-documents";
import { DocumentsPanel, EvaluationsPanel } from "@/app/(tenant)/t/[slug]/suppliers/[supplierId]/Panels";
import { loadSupplierAccess } from "@/app/(tenant)/t/[slug]/suppliers/access";
import { SemaphoreChip } from "@/app/(tenant)/t/[slug]/suppliers/SemaphoreChip";
import { LinkPersonForm, SupplierActiveControl, UnlinkPersonButton } from "@/app/(tenant)/t/[slug]/suppliers/[supplierId]/SupplierControls";
import { formatCuit } from "@/domain/suppliers/cuit";
import { buenosAiresToday, isoDay } from "@/domain/suppliers/dates";
import { describeAttention, isEnabled } from "@/domain/suppliers/status";
import {
  SUPPLIER_CRITICALITY_LABELS,
  SUPPLIER_STATUS_LABELS,
  SUPPLIER_TYPE_LABELS,
  type SupplierStatusValue,
} from "@/domain/suppliers/types";

type Tab = "summary" | "evaluations" | "documents" | "findings" | "communications" | "people";

const TABS: { key: Tab; label: string; param: string }[] = [
  { key: "summary", label: "Resumen", param: "resumen" },
  { key: "evaluations", label: "Evaluaciones", param: "evaluaciones" },
  { key: "documents", label: "Documentos", param: "documentos" },
  { key: "findings", label: "Hallazgos y acciones", param: "hallazgos" },
  { key: "communications", label: "Comunicaciones", param: "comunicaciones" },
  { key: "people", label: "Personas", param: "personas" },
];

const dmy = (date: Date) => isoDay(date).split("-").reverse().join("/");

const STATUS_CHIP: Record<SupplierStatusValue, "ok" | "warning" | "danger" | "pending"> = {
  approved: "ok",
  conditional: "warning",
  not_approved: "danger",
  potential: "pending",
  inactive: "pending",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-[var(--color-line)] py-2 sm:flex-row sm:gap-4">
      <dt className="w-48 shrink-0 text-sm text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

export default async function SupplierPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; supplierId: string }>;
  searchParams: Promise<{ tab?: string; eval?: string }>;
}) {
  const { slug, supplierId } = await params;
  const sp = await searchParams;
  const { tenant, canManage, canEvaluate, canUpload } = await loadSupplierAccess(slug);
  const supplier = await getSupplier(tenant.id, supplierId);
  if (!supplier) notFound();

  const today = buenosAiresToday(new Date());
  const isContractor = supplier.type === "contractor";
  const tabs = TABS.filter((t) => t.key !== "people" || isContractor);
  const tab = tabs.find((t) => t.param === sp.tab)?.key ?? "summary";
  const base = `/t/${slug}/suppliers`;

  const activeStatus = supplier.status === "approved" || supplier.status === "conditional";
  const enabled = isEnabled(supplier.status, supplier.missingBlockingDocs, supplier.blockingDocExpiresAt, today);
  const notEnabledWhy = !activeStatus
    ? "Solo se habilita un proveedor aprobado o con condiciones."
    : supplier.missingBlockingDocs > 0
      ? `Falta ${supplier.missingBlockingDocs === 1 ? "un documento" : `${supplier.missingBlockingDocs} documentos`} obligatorio${supplier.missingBlockingDocs === 1 ? "" : "s"} para habilitarlo.`
      : supplier.blockingDocExpiresAt && supplier.blockingDocExpiresAt < today
        ? `Hay documentación vencida desde el ${dmy(supplier.blockingDocExpiresAt)}.`
        : "";

  const people = tab === "people" ? await listSupplierPeople(tenant.id, supplier.id) : [];
  const linkable = tab === "people" && canManage ? await searchLinkablePeople(tenant.id, supplier.id) : [];
  const evaluations = tab === "evaluations" ? await listSupplierEvaluations(tenant.id, supplier.id) : [];
  const selectedEvaluation = tab === "evaluations" && sp.eval ? await getSupplierEvaluation(tenant.id, supplier.id, sp.eval) : null;
  const [documentRows, documentHistory] =
    tab === "documents"
      ? await Promise.all([listSupplierDocuments(tenant.id, supplier.id), listSupplierDocumentHistory(tenant.id, supplier.id)])
      : [[], []];

  return (
    <>
      <PageHeader
        eyebrow={`Proveedor · ${SUPPLIER_TYPE_LABELS[supplier.type]} · ISO 9001 §8.4`}
        title={supplier.legalName}
        purpose={[supplier.tradeName, supplier.taxId ? `CUIT ${formatCuit(supplier.taxId)}` : "Sin CUIT", supplier.category].filter(Boolean).join(" · ")}
        actions={
          <>
            {canEvaluate && supplier.status !== "inactive" ? (
              <Link href={`${base}/${supplier.id}/evaluate`} className={buttonClass("primary")}>
                {supplier.lastEvaluationId ? "Reevaluar" : "Evaluar"}
              </Link>
            ) : null}
            {canManage ? (
              <Link href={`${base}/${supplier.id}/edit`} className={buttonClass("secondary")}>
                Editar
              </Link>
            ) : null}
            <Link href={base} className={buttonClass("ghost")}>
              Volver a la lista
            </Link>
          </>
        }
      />

      <StatGrid cols={4} aria-label="Resumen del proveedor">
        <StatTile
          label="Estado"
          value={SUPPLIER_STATUS_LABELS[supplier.status]}
          chip={<SemaphoreChip status={supplier.status} attentionAt={supplier.attentionAt} missingRequiredDocs={supplier.missingRequiredDocs} today={today} />}
        />
        <StatTile label="Criticidad" value={SUPPLIER_CRITICALITY_LABELS[supplier.criticality]} />
        <StatTile
          label="Habilitación"
          value={enabled ? "Habilitado" : "No habilitado"}
          tone={activeStatus && !enabled ? "danger" : "default"}
        />
        <StatTile label="Próxima atención" value={describeAttention({ ...supplier, today }) || "—"} />
      </StatGrid>

      {!enabled && notEnabledWhy ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          <span className="font-semibold text-[var(--color-ink)]">¿Por qué no está habilitado?</span> {notEnabledWhy}
        </p>
      ) : null}

      <nav aria-label="Secciones de la ficha" className="flex flex-wrap gap-1 border-b border-[var(--color-line)]">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`${base}/${supplier.id}?tab=${t.param}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${
              t.key === tab
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "summary" ? (
        <SectionBlock title="Resumen" what="Lo esencial del proveedor en una pantalla.">
          <dl>
            <Row label="Estado">
              <StatusChip status={STATUS_CHIP[supplier.status]} label={SUPPLIER_STATUS_LABELS[supplier.status]} />
              {supplier.status === "inactive" && supplier.inactiveReason ? <span className="ml-2 text-[var(--color-ink-muted)]">{supplier.inactiveReason}</span> : null}
            </Row>
            <Row label="Criticidad">
              {SUPPLIER_CRITICALITY_LABELS[supplier.criticality]}
              {supplier.criticalityReason ? <span className="block text-[var(--color-ink-muted)]">{supplier.criticalityReason}</span> : null}
            </Row>
            <Row label="Responsable interno">{supplier.owner?.name ?? <span className="text-[var(--color-ink-muted)]">Sin responsable</span>}</Row>
            <Row label="Último puntaje">
              {supplier.lastScore !== null ? (
                <span className="tabular-nums">
                  {supplier.lastScore.toFixed(1).replace(".", ",")}
                  {supplier.lastEvaluatedAt ? ` · evaluado el ${dmy(supplier.lastEvaluatedAt)}` : ""}
                </span>
              ) : (
                <span className="text-[var(--color-ink-muted)]">Todavía sin evaluar</span>
              )}
            </Row>
            <Row label="Próxima reevaluación">
              {supplier.nextEvaluationDueAt ? dmy(supplier.nextEvaluationDueAt) : <span className="text-[var(--color-ink-muted)]">Sin fecha</span>}
            </Row>
            <Row label="Documentación">
              {supplier.missingRequiredDocs === 0 ? (
                "Sin faltantes obligatorios"
              ) : (
                <>
                  Faltan {supplier.missingRequiredDocs} documento{supplier.missingRequiredDocs === 1 ? "" : "s"} obligatorio{supplier.missingRequiredDocs === 1 ? "" : "s"}
                  {supplier.missingBlockingDocs > 0 ? ` (${supplier.missingBlockingDocs} impide${supplier.missingBlockingDocs === 1 ? "" : "n"} la habilitación)` : ""}
                </>
              )}
            </Row>
            <Row label="Sedes que atiende">
              {supplier.siteList.length ? supplier.siteList.map((s) => s.name).join(", ") : "Todas"}
            </Row>
            <Row label="Contacto">
              {[supplier.contactName, supplier.contactEmail, supplier.contactPhone].filter(Boolean).join(" · ") || <span className="text-[var(--color-ink-muted)]">Sin datos</span>}
            </Row>
            {supplier.notes ? <Row label="Notas"><span className="whitespace-pre-line">{supplier.notes}</span></Row> : null}
          </dl>
        </SectionBlock>
      ) : null}

      {tab === "evaluations" ? (
        <EvaluationsPanel slug={slug} supplierId={supplier.id} rows={evaluations} selected={selectedEvaluation} canEvaluate={canEvaluate && supplier.status !== "inactive"} />
      ) : null}
      {tab === "documents" ? (
        <DocumentsPanel slug={slug} supplierId={supplier.id} rows={documentRows} history={documentHistory} canUpload={canUpload} canVoid={canManage} />
      ) : null}
      {tab === "findings" ? (
        <SectionBlock title="Hallazgos y acciones" what="Lo que se detectó en este proveedor y cómo se está resolviendo.">
          <EmptyState what="No hay hallazgos registrados para este proveedor." />
        </SectionBlock>
      ) : null}
      {tab === "communications" ? (
        <SectionBlock title="Comunicaciones" what="Qué se le pidió y qué resultado se le comunicó al proveedor (ISO 9001 §8.4.3).">
          <EmptyState what="Todavía no se registró ninguna comunicación." />
        </SectionBlock>
      ) : null}

      {tab === "people" ? (
        <SectionBlock
          title={`Personas del contratista (${people.length})`}
          what="Quienes trabajan en sus instalaciones, cargados en Datos maestros como personal de contratista."
          next={canManage ? "vinculá a cada persona con este contratista." : undefined}
        >
          {people.length === 0 ? (
            <EmptyState what="Ninguna persona está vinculada a este contratista." />
          ) : (
            <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
              {people.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span>
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 tabular-nums text-[var(--color-ink-muted)]">{p.employeeCode}</span>
                    <span className="block text-xs text-[var(--color-ink-muted)]">
                      {p.position.name} · {p.site.name}
                      {p.status === "inactive" ? " · De baja" : ""}
                    </span>
                  </span>
                  {canManage ? <UnlinkPersonButton slug={slug} supplierId={supplier.id} personId={p.id} name={p.name} /> : null}
                </li>
              ))}
            </ul>
          )}
          {canManage ? <LinkPersonForm slug={slug} supplierId={supplier.id} people={linkable} /> : null}
        </SectionBlock>
      ) : null}

      {canManage ? (
        <SectionBlock
          title={supplier.status === "inactive" ? "Reactivar" : "Dar de baja"}
          what={supplier.status === "inactive" ? "El proveedor está de baja y no figura en la lista de aprobados." : "Un proveedor de baja deja de figurar en la lista de aprobados. No se borra su historial."}
        >
          <SupplierActiveControl slug={slug} supplierId={supplier.id} inactive={supplier.status === "inactive"} />
        </SectionBlock>
      ) : null}
    </>
  );
}
