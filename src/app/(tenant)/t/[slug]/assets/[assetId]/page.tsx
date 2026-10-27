import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAsset, listAssetInspections } from "@/lib/assets";
import { INSTRUMENT_TYPE_KEY } from "@/domain/calibration/types";
import { listSites } from "@/lib/masterdata";
import { loadInspectionsAccess } from "@/app/(tenant)/t/[slug]/inspections/access";
import { AssetForm, RenewDueDateForm, RetireAssetForm } from "@/app/(tenant)/t/[slug]/assets/AssetForms";
import { AssetStatusChip, ComplianceChip } from "@/app/(tenant)/t/[slug]/assets/status";
import { getAssetType } from "@/domain/inspections/asset-types";
import { dueState } from "@/domain/inspections/schedule";
import { formatDateEs, isoFromDate, todayIso } from "@/domain/inspections/dates";
import { OWNERSHIP_LABELS, RESULT_LABELS, type InspectionResult } from "@/domain/inspections/types";
import { STATUS_REASON_LABELS } from "@/domain/inspections/asset-status";
import { FormError, SectionBlock, StatusChip, buttonClass } from "@/components/ui";

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

const RESULT_CHIP: Record<InspectionResult, "ok" | "warning" | "danger"> = { fit: "ok", fit_with_observations: "warning", unfit: "danger" };

const DUE_CHIP = {
  ok: { status: "ok", label: "Vigente" },
  expiring: { status: "warning", label: "Por vencer" },
  overdue: { status: "overdue", label: "Vencido" },
} as const;

export default async function AssetPage({ params }: { params: Promise<{ slug: string; assetId: string }> }) {
  const { slug, assetId } = await params;
  const { tenant, canManageAssets, canWrite } = await loadInspectionsAccess(slug);
  const asset = await getAsset(tenant.id, assetId);
  if (!asset) notFound();
  // Los equipos de medición se ven y se editan en su módulo.
  if (asset.typeKey === INSTRUMENT_TYPE_KEY) redirect(`/t/${slug}/instruments/${asset.id}`);

  const type = getAssetType(asset.typeKey);
  const inspections = await listAssetInspections(tenant.id, asset.id);
  const attributes = asset.attributes as Record<string, unknown>;
  const retired = asset.status === "retired";
  const sites = canManageAssets && !retired ? await listSites(tenant.id) : [];
  const today = todayIso();
  const specs = type.dueKinds(attributes);
  // Arneses y cabos: con la vida útil vencida no se mutan solos, se muestra el pedido de baja (SPEC, decisión 7).
  const lifeExpired = !retired && asset.dueDates.some((d) => d.kind === "service_life_end" && isoFromDate(d.dueAt) < today);
  const kinds = [...asset.dueDates.map((d) => d.kind), ...specs.map((s) => s.kind).filter((k) => !asset.dueDates.some((d) => d.kind === k))];

  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link href={`/t/${slug}/assets`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a activos
        </Link>
      </p>

      <SectionBlock
        title={asset.code}
        eyebrow={`${type.label} · ${type.summarize(attributes)}`}
        what={asset.description}
        actions={
          <>
            <AssetStatusChip status={asset.status} />
            {retired ? null : <ComplianceChip compliance={asset.compliance} />}
            {canWrite && !retired ? (
              <Link href={`/t/${slug}/inspections/new?assetId=${asset.id}`} className={buttonClass("primary")}>
                Inspeccionar
              </Link>
            ) : null}
          </>
        }
      >
        <dl className="grid gap-4 sm:grid-cols-3">
          <Item label="Sede">
            {asset.site.name}
            {asset.sector ? ` · ${asset.sector}` : ""}
          </Item>
          <Item label="Propiedad">
            {OWNERSHIP_LABELS[asset.ownership]}
            {asset.contractorName ? ` · ${asset.contractorName}` : ""}
          </Item>
          <Item label="Persona a cargo">{asset.assignedPerson ? `${asset.assignedPerson.name} (${asset.assignedPerson.employeeCode})` : "Sin asignar"}</Item>
          <Item label="Estado">
            {asset.statusReason ?? (asset.status === "in_service" ? "Sin novedades" : "—")}
            <span className="block text-xs text-[var(--color-ink-muted)]">desde {formatDateEs(isoFromDate(asset.statusChangedAt))}</span>
          </Item>
        </dl>
      </SectionBlock>

      {lifeExpired ? (
        <FormError>Vida útil vencida: dar de baja. Un equipo anticaídas vencido no puede usarse ni declararse apto; registrá la baja más abajo y destruilo.</FormError>
      ) : null}

      <SectionBlock title="Vencimientos" what="Mantenimiento y pruebas del equipo. Cada uno avisa antes de vencer." next={canManageAssets && !retired ? "renová el vencimiento cuando se haga el trabajo." : undefined}>
        {kinds.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Este activo no lleva vencimientos.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {kinds.map((kind) => {
              const due = asset.dueDates.find((d) => d.kind === kind);
              const label = specs.find((s) => s.kind === kind)?.label ?? type.dueKindLabels[kind] ?? kind;
              const dueIso = due ? isoFromDate(due.dueAt) : null;
              const state = due && dueIso ? DUE_CHIP[dueState({ dueAt: dueIso, leadDays: due.leadDays }, today)] : null;
              return (
                <li key={kind} className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{label}</p>
                      <p className="text-sm text-[var(--color-ink-muted)]">
                        {dueIso ? `Vence el ${formatDateEs(dueIso)}` : "Sin fecha cargada"}
                        {due?.lastDoneAt ? ` · última vez el ${formatDateEs(isoFromDate(due.lastDoneAt))}` : ""}
                        {due?.reference ? ` · comprobante ${due.reference}` : ""}
                        {due?.blocking ? " · vencido impide el uso" : ""}
                      </p>
                    </div>
                    {state ? <StatusChip status={state.status} label={state.label} /> : null}
                  </div>
                  {canManageAssets && !retired && kind !== "service_life_end" ? <RenewDueDateForm slug={slug} assetId={asset.id} kind={kind} label={label} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </SectionBlock>

      {canManageAssets && !retired ? (
        <SectionBlock title="Editar datos" what="El código no se cambia: es la identidad del activo.">
          <AssetForm
            slug={slug}
            typeKey={type.key}
            fields={type.fields}
            dueKindLabels={type.dueKindLabels}
            sites={sites.map((s) => ({ id: s.id, name: s.name }))}
            asset={{
              id: asset.id,
              code: asset.code,
              description: asset.description,
              siteId: asset.siteId,
              sector: asset.sector,
              ownership: asset.ownership,
              contractorName: asset.contractorName,
              assignedPerson: asset.assignedPerson
                ? { id: asset.assignedPerson.id, name: asset.assignedPerson.name, employeeCode: asset.assignedPerson.employeeCode, siteName: asset.assignedPerson.site.name }
                : null,
              attributes,
            }}
          />
        </SectionBlock>
      ) : null}

      <SectionBlock title="Inspecciones" what="Los últimos controles de este equipo, con su resultado." next={canWrite && !retired ? "tocá «Inspeccionar» para registrar un control nuevo." : undefined}>
        {inspections.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Todavía no se inspeccionó este equipo.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
            {inspections.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <Link href={`/t/${slug}/inspections/${i.id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                  {i.template.name} · {formatDateEs(isoFromDate(i.inspectedAt))}
                </Link>
                {i.status === "draft" || !i.result ? <StatusChip status="pending" label="Borrador" /> : <StatusChip status={RESULT_CHIP[i.result]} label={RESULT_LABELS[i.result]} />}
              </li>
            ))}
          </ul>
        )}
      </SectionBlock>

      <SectionBlock title="Historial de estado" what="Por qué está como está y quién lo dijo.">
        <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
          {asset.statusEvents.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span>
                {(STATUS_REASON_LABELS as Record<string, string>)[e.reasonCode] ?? e.reasonCode}
                {e.note ? <span className="block text-xs text-[var(--color-ink-muted)]">{e.note}</span> : null}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">{formatDateEs(isoFromDate(e.createdAt))}</span>
            </li>
          ))}
        </ul>
      </SectionBlock>

      {canManageAssets && !retired ? (
        <SectionBlock title="Dar de baja" what="Para equipos vendidos, destruidos o fuera de uso. No se borra: conserva su historial.">
          <RetireAssetForm slug={slug} assetId={asset.id} code={asset.code} />
        </SectionBlock>
      ) : null}
    </div>
  );
}
