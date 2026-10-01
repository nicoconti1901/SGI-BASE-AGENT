import { EmptyState, HintCallout, SectionBlock, StatusChip } from "@/components/ui";
import { ActiveToggle, CatalogForm, type CatalogItemView } from "@/app/(tenant)/t/[slug]/master-data/CatalogForms";
import { SITE_KIND_LABELS, type MasterDataEntity, type SiteKindValue } from "@/domain/masterdata/types";

const COPY: Record<
  MasterDataEntity,
  { title: string; activeTitle: string; inactiveTitle: string; what: string; next: string; createTitle: string; createLabel: string; empty: string; one: string }
> = {
  site: {
    title: "Sedes",
    activeTitle: "Sedes activas",
    inactiveTitle: "Sedes dadas de baja",
    what: "Dónde trabaja la empresa: oficinas, bases, obradores, yacimientos, campamentos y plantas.",
    next: "cargá cada lugar donde haya personas, equipos o inspecciones. Después asignalas a su gente.",
    createTitle: "Nueva sede",
    createLabel: "Registrar sede",
    empty: "Todavía no hay sedes.",
    one: "sede",
  },
  position: {
    title: "Puestos",
    activeTitle: "Puestos activos",
    inactiveTitle: "Puestos dados de baja",
    what: "El rol de cada persona en la organización (operario, supervisor, conductor…).",
    next: "cargá los puestos de la nómina. Las capacitaciones y los controles se definen por puesto.",
    createTitle: "Nuevo puesto",
    createLabel: "Registrar puesto",
    empty: "Todavía no hay puestos.",
    one: "puesto",
  },
  task: {
    title: "Tareas",
    activeTitle: "Tareas activas",
    inactiveTitle: "Tareas dadas de baja",
    what: "Lo que hace la gente en campo. Una tarea crítica exige personal habilitado.",
    next: "cargá las tareas y marcá cuáles son críticas (altura, izaje, conducción, espacio confinado).",
    createTitle: "Nueva tarea",
    createLabel: "Registrar tarea",
    empty: "Todavía no hay tareas.",
    one: "tarea",
  },
};

function meta(entity: MasterDataEntity, item: CatalogItemView): string | null {
  if (entity === "site") {
    const kind = SITE_KIND_LABELS[(item.kind ?? "office") as SiteKindValue];
    return item.address ? `${kind} · ${item.address}` : kind;
  }
  return null;
}

/** Lista + alta + edición + baja de sedes, puestos o tareas. */
export function CatalogSection({
  slug,
  entity,
  items,
  canManage,
}: {
  slug: string;
  entity: MasterDataEntity;
  items: CatalogItemView[];
  canManage: boolean;
}) {
  const copy = COPY[entity];
  const active = items.filter((i) => i.active);
  const inactive = items.filter((i) => !i.active);

  return (
    <div className="flex flex-col gap-6">
      {canManage ? (
        <SectionBlock title={copy.createTitle} what={copy.what} next={copy.next}>
          <CatalogForm slug={slug} entity={entity} submitLabel={copy.createLabel} />
        </SectionBlock>
      ) : (
        <HintCallout>
          Solo lectura: el administrador de la organización es quien da de alta y modifica {copy.title.toLowerCase()}.
        </HintCallout>
      )}

      <SectionBlock title={`${copy.activeTitle} (${active.length})`}>
        {active.length === 0 ? (
          <EmptyState what={copy.empty} next={canManage ? `usá el formulario de arriba para registrar la primera ${copy.one}.` : "pedile al administrador que la cargue."} />
        ) : (
          <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            {active.map((item) => (
              <CatalogRow key={item.id} slug={slug} entity={entity} item={item} canManage={canManage} />
            ))}
          </ul>
        )}
      </SectionBlock>

      {inactive.length > 0 ? (
        <SectionBlock title={`${copy.inactiveTitle} (${inactive.length})`} what="Conservan su historial pero no aparecen en los selectores.">
          <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            {inactive.map((item) => (
              <CatalogRow key={item.id} slug={slug} entity={entity} item={item} canManage={canManage} />
            ))}
          </ul>
        </SectionBlock>
      ) : null}
    </div>
  );
}

function CatalogRow({
  slug,
  entity,
  item,
  canManage,
}: {
  slug: string;
  entity: MasterDataEntity;
  item: CatalogItemView;
  canManage: boolean;
}) {
  const detail = meta(entity, item);
  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium">{item.name}</span>
          {detail ? <span className="ml-2 text-sm text-[var(--color-ink-muted)]">· {detail}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {entity === "task" && item.critical ? <StatusChip status="warning" label="Crítica" /> : null}
          <StatusChip status={item.active ? "ok" : "pending"} label={item.active ? "Activa" : "De baja"} />
        </div>
      </div>
      {canManage ? (
        <div className="flex flex-col gap-3">
          {item.active ? (
            <details className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)]">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-[var(--color-accent)]">
                Editar {item.name}
              </summary>
              <div className="border-t border-[var(--color-line)] p-3">
                <CatalogForm slug={slug} entity={entity} item={item} submitLabel="Guardar cambios" />
              </div>
            </details>
          ) : null}
          <ActiveToggle slug={slug} entity={entity} item={item} label={item.active ? "Dar de baja" : "Reactivar"} />
        </div>
      ) : null}
    </li>
  );
}
