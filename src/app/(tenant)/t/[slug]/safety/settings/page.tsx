import { notFound } from "next/navigation";
import { loadSafetyAccess } from "@/app/(tenant)/t/[slug]/safety/access";
import { SettingsForm } from "@/app/(tenant)/t/[slug]/safety/settings/SettingsForm";
import { getIndicatorLinks, listLinkableIndicators, METRIC_LABELS, SAFETY_METRICS } from "@/lib/safety-dashboard";
import { getSafetySettings } from "@/lib/safety-stats";
import { listTenantMembers } from "@/lib/identity";
import { SectionBlock } from "@/components/ui";

export default async function SafetySettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, canManage } = await loadSafetyAccess(slug);
  if (!canManage) notFound();
  const [settings, members, indicators, links] = await Promise.all([
    getSafetySettings(tenant.id),
    listTenantMembers(tenant.id),
    listLinkableIndicators(tenant.id),
    getIndicatorLinks(tenant.id),
  ]);
  return (
    <SectionBlock title="Ajustes" what="Cómo se calculan los índices, quién carga las horas y qué metas se comparan." next="cambiá lo que necesites y guardá. Los índices ya calculados se recalculan solos.">
      <SettingsForm
        slug={slug}
        settings={settings}
        members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
        indicators={indicators.map((i) => ({ id: i.id, name: i.name }))}
        links={links}
        metrics={SAFETY_METRICS.map((key) => ({ key, label: METRIC_LABELS[key] }))}
      />
    </SectionBlock>
  );
}
