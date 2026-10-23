import Link from "next/link";
import { notFound } from "next/navigation";
import { getInstrument } from "@/lib/instruments";
import { listSites } from "@/lib/masterdata";
import { loadInstrumentsAccess } from "@/app/(tenant)/t/[slug]/instruments/access";
import { InstrumentForm, type InstrumentDefaults } from "@/app/(tenant)/t/[slug]/instruments/InstrumentForm";
import { isMagnitude } from "@/domain/calibration";
import { isoFromDate } from "@/domain/inspections/dates";
import { SectionBlock } from "@/components/ui";

const text = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function EditInstrumentPage({ params }: { params: Promise<{ slug: string; assetId: string }> }) {
  const { slug, assetId } = await params;
  const { tenant, canManage } = await loadInstrumentsAccess(slug);
  if (!canManage) notFound();
  const detail = await getInstrument(tenant.id, assetId, { historyPage: 1 });
  if (!detail || detail.asset.status === "retired") notFound();
  const sites = await listSites(tenant.id);
  const { asset, control } = detail;
  const attrs = asset.attributes as Record<string, unknown>;

  const defaults: InstrumentDefaults = {
    id: asset.id,
    code: asset.code,
    description: asset.description,
    siteId: asset.siteId,
    sector: asset.sector,
    assignedPerson: asset.assignedPerson
      ? { id: asset.assignedPerson.id, name: asset.assignedPerson.name, employeeCode: asset.assignedPerson.employeeCode, siteName: asset.assignedPerson.site.name }
      : null,
    brand: text(attrs.brand),
    model: text(attrs.model),
    serialNumber: text(attrs.serialNumber),
    inServiceSince: text(attrs.inServiceSince),
    magnitude: isMagnitude(control.magnitude) ? control.magnitude : "other",
    isReferenceStandard: control.isReferenceStandard,
    criticalUse: control.criticalUse,
    criticalUseReason: control.criticalUseReason ?? "",
    requiresCalibration: control.requiresCalibration,
    calibrationIntervalMonths: num(control.calibrationIntervalMonths),
    requiresVerification: control.requiresVerification,
    verificationIntervalMonths: num(control.verificationIntervalMonths),
    intervalReason: control.intervalReason ?? "",
    noControlReason: control.noControlReason ?? "",
    decisionRule: control.decisionRule,
    decisionRuleReason: control.decisionRuleReason ?? "",
    alertLeadDays: String(control.alertLeadDays),
    channels: detail.channels.map((c) => ({
      key: c.key,
      label: c.label,
      unit: c.unit,
      rangeMin: String(c.rangeMin),
      rangeMax: String(c.rangeMax),
      resolution: num(c.resolution),
      emp: { abs: String(c.emp.abs), pctReading: String(c.emp.pctReading), pctFullScale: String(c.emp.pctFullScale) },
      requiredPoints: num(c.requiredPoints),
      active: c.active,
    })),
  };

  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link href={`/t/${slug}/instruments/${asset.id}`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a {asset.code}
        </Link>
      </p>
      <SectionBlock
        title={`Editar ${asset.code}`}
        what="Cambiar la regla o el error máximo no modifica las calibraciones ya cerradas: cada una conserva la regla con la que se decidió."
        eyebrow={`Creado el ${isoFromDate(asset.createdAt).split("-").reverse().join("/")}`}
      >
        <InstrumentForm slug={slug} sites={sites.map((s) => ({ id: s.id, name: s.name }))} instrument={defaults} />
      </SectionBlock>
    </div>
  );
}
