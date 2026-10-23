import Link from "next/link";
import { EmptyState, HintCallout, PageHeader, SectionBlock, StatusChip, buttonClass } from "@/components/ui";
import { listTemplateVersions, listDocumentTypes, type TemplateWithCriteria } from "@/lib/supplier-criteria";
import { loadSupplierAccess } from "@/app/(tenant)/t/[slug]/suppliers/access";
import {
  DiscardDraftButton,
  DocumentTypeForm,
  DraftEditor,
  StartDraftButton,
  ToggleDocumentTypeButton,
} from "@/app/(tenant)/t/[slug]/suppliers/criteria/CriteriaControls";
import { isoDay } from "@/domain/suppliers/dates";
import { SUPPLIER_TYPES, SUPPLIER_TYPE_LABELS, type SupplierTypeValue } from "@/domain/suppliers/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const dmy = (date: Date) => isoDay(date).split("-").reverse().join("/");
const PHASE = { selection: "Al seleccionar", performance: "Al reevaluar", both: "Ambas" } as const;
const STATUS = { published: "Vigente", retired: "Anterior", draft: "Borrador" } as const;

function CriteriaTable({ template }: { template: TemplateWithCriteria }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="bg-[var(--color-surface-sunken)] text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
          <tr>
            <th scope="col" className="px-3 py-2">Criterio</th>
            <th scope="col" className="px-3 py-2 text-right">Peso</th>
            <th scope="col" className="px-3 py-2">Cuándo</th>
            <th scope="col" className="px-3 py-2">Marcas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-line)]">
          {template.criteria.map((c) => (
            <tr key={c.id}>
              <td className="px-3 py-2">
                <span className="font-medium">{c.name}</span>
                {c.description ? <span className="block text-xs text-[var(--color-ink-muted)]">{c.description}</span> : null}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{c.weight}</td>
              <td className="px-3 py-2">{PHASE[c.phase]}</td>
              <td className="px-3 py-2 text-xs">
                {[c.excluding ? "Excluyente" : null, c.allowNA ? "Admite N/A" : null, c.basic ? "Simplificada" : null].filter(Boolean).join(" · ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function SupplierCriteriaPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: SearchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant, canEditCriteria } = await loadSupplierAccess(slug);

  const tab = first(sp.tab) === "documentos" ? "documentos" : "criterios";
  const requested = first(sp.tipo) as SupplierTypeValue | undefined;
  const type: SupplierTypeValue = requested && SUPPLIER_TYPES.includes(requested) ? requested : "product";
  const base = `/t/${slug}/suppliers/criteria`;

  const versions = tab === "criterios" ? await listTemplateVersions(tenant.id, type) : [];
  const published = versions.find((v) => v.status === "published") ?? null;
  const draft = versions.find((v) => v.status === "draft") ?? null;
  const wanted = first(sp.ver);
  const shown =
    (wanted && wanted !== "borrador" ? versions.find((v) => String(v.version) === wanted && v.status !== "draft") : null) ?? published;
  const editing = canEditCriteria && draft && wanted === "borrador" ? draft : null;
  const docTypes = tab === "documentos" ? await listDocumentTypes(tenant.id) : [];

  return (
    <>
      <PageHeader
        eyebrow="Proveedores · ISO 9001 §8.4.1"
        title="Criterios y documentos"
        purpose="Con qué criterios se evalúa a cada tipo de proveedor y qué documentos se le piden."
        actions={
          <Link href={`/t/${slug}/suppliers`} className={buttonClass("ghost")}>
            Volver a la lista
          </Link>
        }
      />

      {!canEditCriteria ? <p className="text-sm text-[var(--color-ink-muted)]">Solo lectura: los criterios los edita el administrador de la empresa.</p> : null}
      {sp.publicada ? (
        <p role="status" className="text-sm text-[var(--color-success)]">Versión publicada. Rige para las evaluaciones nuevas; las anteriores no cambian.</p>
      ) : null}

      <nav aria-label="Secciones" className="flex flex-wrap gap-1 border-b border-[var(--color-line)]">
        {[
          { key: "criterios", label: "Criterios de evaluación", href: `${base}?tipo=${type}` },
          { key: "documentos", label: "Tipos de documento", href: `${base}?tab=documentos` },
        ].map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.key === tab ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${
              t.key === tab ? "border-[var(--color-accent)] text-[var(--color-accent)]" : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "criterios" ? (
        <>
          <nav aria-label="Tipo de proveedor" className="flex flex-wrap gap-2">
            {SUPPLIER_TYPES.map((t) => (
              <Link key={t} href={`${base}?tipo=${t}`} aria-current={t === type ? "page" : undefined} className={buttonClass(t === type ? "primary" : "secondary")}>
                {SUPPLIER_TYPE_LABELS[t]}
              </Link>
            ))}
          </nav>

          {editing ? (
            <SectionBlock
              title={`Borrador de la versión ${editing.version}`}
              what="Ajustá los criterios, los pesos y los umbrales. Hasta publicarla, las evaluaciones nuevas siguen usando la versión vigente."
              actions={<DiscardDraftButton slug={slug} templateId={editing.id} supplierType={type} />}
            >
              <DraftEditor
                slug={slug}
                templateId={editing.id}
                supplierType={type}
                version={editing.version}
                approvedMin={editing.approvedMin}
                conditionalMin={editing.conditionalMin}
                changeNote={editing.changeNote ?? ""}
                initialCriteria={editing.criteria.map((c) => ({
                  name: c.name, description: c.description, descriptor1: c.descriptor1, descriptor3: c.descriptor3, descriptor5: c.descriptor5,
                  weight: c.weight, excluding: c.excluding, allowNA: c.allowNA, phase: c.phase, basic: c.basic,
                }))}
              />
            </SectionBlock>
          ) : shown ? (
            <SectionBlock
              title={`Versión ${shown.version} (${STATUS[shown.status].toLowerCase()})`}
              what={`Criterios con los que se evalúa a un proveedor de tipo ${SUPPLIER_TYPE_LABELS[type].toLowerCase()}. Aprobado desde ${shown.approvedMin} puntos, con condiciones desde ${shown.conditionalMin}.`}
              next={canEditCriteria ? "para cambiar algo, creá un borrador de la próxima versión; la vigente no se edita." : undefined}
              actions={
                canEditCriteria ? (
                  draft ? (
                    <Link href={`${base}?tipo=${type}&ver=borrador`} className={buttonClass("secondary")}>
                      Seguir el borrador v{draft.version}
                    </Link>
                  ) : (
                    <StartDraftButton slug={slug} supplierType={type} label="Crear borrador de la próxima versión" />
                  )
                ) : undefined
              }
            >
              {shown.changeNote ? <p className="mb-3 text-sm text-[var(--color-ink-muted)]">Qué cambió: {shown.changeNote}</p> : null}
              <CriteriaTable template={shown} />
              <HintCallout>
                Un 1 en un criterio excluyente deja al proveedor «no aprobado»; un 2, «con condiciones» como mucho, sea cual sea el puntaje total.
              </HintCallout>
            </SectionBlock>
          ) : (
            <EmptyState what="Todavía no hay criterios publicados para este tipo." next="se cargan solos la primera vez que se abre el módulo." />
          )}

          {versions.length > 1 || (versions.length === 1 && draft) ? (
            <SectionBlock title="Versiones" what="Cada evaluación guarda la versión con la que se hizo.">
              <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
                {versions.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`${base}?tipo=${type}&ver=${v.status === "draft" ? "borrador" : v.version}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-[var(--color-accent-soft)]"
                    >
                      <span>
                        <span className="font-medium">Versión {v.version}</span>
                        <span className="ml-2 text-xs text-[var(--color-ink-muted)]">
                          {v.publishedAt ? `publicada el ${dmy(v.publishedAt)}` : "sin publicar"}
                          {v.changeNote ? ` · ${v.changeNote}` : ""}
                        </span>
                      </span>
                      <StatusChip status={v.status === "published" ? "ok" : v.status === "draft" ? "info" : "pending"} label={STATUS[v.status]} />
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionBlock>
          ) : null}
        </>
      ) : (
        <>
          <SectionBlock
            title="Tipos de documento"
            what="Lo que se le pide a cada proveedor. Los que impiden la habilitación dejan al contratista «no habilitado» si faltan o vencen. Los sugeridos son orientativos: conviene validarlos con su asesor legal y de seguridad e higiene."
          >
            {docTypes.length === 0 ? (
              <EmptyState what="Todavía no hay tipos de documento." next="se cargan solos la primera vez que se abre el módulo." />
            ) : (
              <ul className="flex flex-col gap-3">
                {docTypes.map((t) => (
                  <li key={t.id} className={`rounded-[var(--radius-md)] border border-[var(--color-line)] ${t.active ? "" : "opacity-70"}`}>
                    <details>
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                        <span>
                          <span className="font-medium">{t.name}</span>
                          <span className="block text-xs text-[var(--color-ink-muted)]">
                            {t.appliesTo.map((a) => SUPPLIER_TYPE_LABELS[a]).join(", ")}
                            {t.blocksEnablement ? " · impide la habilitación" : t.required ? " · obligatorio" : " · opcional"}
                            {t.recurrence === "monthly" ? " · mensual" : ""}
                          </span>
                        </span>
                        {t.active ? null : <StatusChip status="pending" label="Desactivado" />}
                      </summary>
                      {canEditCriteria ? (
                        <div className="flex flex-col gap-3 border-t border-[var(--color-line)] p-4">
                          <DocumentTypeForm
                            slug={slug}
                            value={{ id: t.id, name: t.name, appliesTo: t.appliesTo, required: t.required, blocksEnablement: t.blocksEnablement, validityMonths: t.validityMonths, recurrence: t.recurrence, note: t.note }}
                          />
                          <ToggleDocumentTypeButton slug={slug} id={t.id} active={t.active} name={t.name} />
                        </div>
                      ) : t.note ? (
                        <p className="border-t border-[var(--color-line)] px-4 py-3 text-xs text-[var(--color-ink-muted)]">{t.note}</p>
                      ) : null}
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </SectionBlock>
          {canEditCriteria ? (
            <SectionBlock title="Agregar un tipo de documento" what="Por ejemplo, una habilitación propia de su rubro.">
              <DocumentTypeForm slug={slug} />
            </SectionBlock>
          ) : null}
        </>
      )}
    </>
  );
}
