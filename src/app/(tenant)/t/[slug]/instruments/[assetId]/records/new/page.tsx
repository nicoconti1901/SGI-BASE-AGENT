import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getInstrument, searchInstruments } from "@/lib/instruments";
import { loadInstrumentsAccess } from "@/app/(tenant)/t/[slug]/instruments/access";
import { RecordForm, type RecordFormDefaults } from "@/app/(tenant)/t/[slug]/instruments/[assetId]/records/RecordForm";
import { instrumentFormProps } from "@/app/(tenant)/t/[slug]/instruments/[assetId]/records/props";
import { SectionBlock } from "@/components/ui";
import { todayIso } from "@/domain/inspections/dates";

export default async function NewRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; assetId: string }>;
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { slug, assetId } = await params;
  const { tipo } = await searchParams;
  const { tenant, canWrite } = await loadInstrumentsAccess(slug);
  const base = `/t/${slug}/instruments/${assetId}`;
  if (!canWrite) redirect(base);
  const detail = await getInstrument(tenant.id, assetId);
  if (!detail) notFound();
  const { asset, control } = detail;
  if (asset.status === "retired" || (!control.requiresCalibration && !control.requiresVerification)) redirect(base);

  const kind = tipo === "verification" && control.requiresVerification ? "verification" : control.requiresCalibration ? "calibration" : "verification";
  const standards = (await searchInstruments(tenant.id, { take: 100 })).filter((s) => s.id !== assetId);
  const defaults: RecordFormDefaults = {
    kind,
    performedAt: todayIso(),
    certificateNumber: "",
    certificateIssuedAt: "",
    labName: "",
    traceability: kind === "verification" ? "in_house" : "accredited_lab",
    accreditationBody: "",
    accreditationNumber: "",
    accreditationScopeCovers: true,
    traceabilityBasis: "",
    referenceStandardAssetId: "",
    conditions: "",
    adjusted: false,
    basis: "points",
    labStatement: "",
    labStatementSpec: "",
    labDecisionRule: "",
    coverageK: "2",
    notes: "",
    asFound: [],
    asLeft: [],
  };

  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link href={base} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a {asset.code}
        </Link>
      </p>
      <SectionBlock title={`Cargar ${kind === "verification" ? "verificación" : "calibración"} · ${asset.code}`} what={`${asset.description}. El resultado se calcula con los puntos: nadie lo escribe.`}>
        <RecordForm
          slug={slug}
          assetId={assetId}
          recordId={null}
          instrument={instrumentFormProps(asset, control, detail.channels)}
          standards={standards}
          defaults={defaults}
          today={todayIso()}
        />
      </SectionBlock>
    </div>
  );
}
