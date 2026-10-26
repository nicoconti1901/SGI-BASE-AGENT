import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemplateForEdit } from "@/lib/inspection-templates";
import { loadInspectionsAccess } from "@/app/(tenant)/t/[slug]/inspections/access";
import { TemplateEditor } from "@/app/(tenant)/t/[slug]/inspections/templates/[templateId]/TemplateEditor";
import { MAX_TEMPLATE_ITEMS } from "@/domain/inspections/templates/validate";
import { formatDateEs, isoFromDate } from "@/domain/inspections/dates";
import { SectionBlock } from "@/components/ui";

export default async function TemplatePage({ params }: { params: Promise<{ slug: string; templateId: string }> }) {
  const { slug, templateId } = await params;
  const { tenant, canViewTemplates, canManageTemplates } = await loadInspectionsAccess(slug);
  if (!canViewTemplates) notFound();
  const editor = await getTemplateForEdit(tenant.id, templateId);
  if (!editor || !editor.context) notFound();
  const { template, snapshot, versions } = editor;

  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link href={`/t/${slug}/inspections/templates`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a plantillas
        </Link>
      </p>
      <SectionBlock
        title={template.name}
        eyebrow={`Plantilla · versión ${versions[0]?.version ?? 1}`}
        what="Lo que se controla en esta inspección. Ordená los ítems, ajustá su criticidad o agregá los que tu empresa necesite."
        next={canManageTemplates ? "editá lo que haga falta y guardalo como versión nueva." : "consultá los ítems; el administrador es quien los edita."}
      >
        <TemplateEditor
          slug={slug}
          templateId={template.id}
          initial={snapshot}
          context={editor.context}
          hasDefault={editor.hasDefault}
          canEdit={canManageTemplates}
          canReinstate={template.canReinstate}
          retireOnUnfit={template.retireOnUnfit}
          maxItems={MAX_TEMPLATE_ITEMS}
        />
      </SectionBlock>

      <SectionBlock title="Versiones" what="Cada edición queda guardada. Cada inspección conserva la versión con la que se hizo.">
        <ol className="divide-y divide-[var(--color-line)] rounded-[var(--radius-lg)] border border-[var(--color-line)] text-sm">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
              <span className="font-semibold tabular-nums">Versión {v.version}</span>
              <span className="text-[var(--color-ink-muted)]">{formatDateEs(isoFromDate(v.createdAt))}</span>
              <span className="text-[var(--color-ink-muted)]">{v.note ?? ""}</span>
              <span className="ml-auto tabular-nums text-[var(--color-ink-muted)]">
                {v._count.inspections} {v._count.inspections === 1 ? "inspección" : "inspecciones"}
              </span>
            </li>
          ))}
        </ol>
      </SectionBlock>
    </div>
  );
}
