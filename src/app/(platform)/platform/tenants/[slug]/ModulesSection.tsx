import { Button, EntityList, SectionBlock, StatusChip } from "@/components/ui";
import { MODULE_CATALOG, MODULE_SECTIONS, clauseSummary } from "@/domain/modules/catalog";
import { getEnabledModules } from "@/lib/modules";
import { setTenantModuleAction } from "./module-actions";

/** Qué módulos ve la empresa en su menú. */
export async function ModulesSection({ slug, tenantId }: { slug: string; tenantId: string }) {
  const enabled = await getEnabledModules(tenantId);

  return (
    <SectionBlock
      title="Módulos de la empresa"
      eyebrow="Alcance del cliente"
      what="Lo que esta empresa ve en su menú. Al desactivar un módulo se oculta y sus páginas dejan de estar disponibles; los datos se conservan y vuelven al reactivarlo."
      next="activá solo lo que el cliente va a usar: un menú corto es más fácil de seguir."
    >
      {MODULE_SECTIONS.map((section) => {
        const modules = MODULE_CATALOG.filter((m) => m.section === section.key);
        if (modules.length === 0) return null;
        return (
          <div key={section.key} className="flex flex-col gap-2">
            <h3 className="font-[family-name:var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
              {section.label}
            </h3>
            <EntityList aria-label={`Módulos: ${section.label}`}>
              {modules.map((m) => {
                const isOn = enabled.has(m.key);
                return (
                  <li key={m.key} className="flex min-h-12 flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{m.label}</p>
                      {m.clauses.length > 0 ? (
                        <p className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                          {clauseSummary(m.clauses)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      {m.status === "planned" ? (
                        <StatusChip status="info" label="Próximamente" />
                      ) : (
                        <StatusChip status={isOn ? "ok" : "pending"} label={isOn ? "Activo" : "Inactivo"} />
                      )}
                      {m.status === "available" && !m.alwaysOn ? (
                        <form action={setTenantModuleAction.bind(null, slug, m.key, !isOn)}>
                          <Button type="submit" variant={isOn ? "ghost" : "secondary"}>
                            {isOn ? `Desactivar ${m.label}` : `Activar ${m.label}`}
                          </Button>
                        </form>
                      ) : null}
                      {m.alwaysOn ? (
                        <span className="text-xs text-[var(--color-ink-muted)]">Siempre activo</span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </EntityList>
          </div>
        );
      })}
    </SectionBlock>
  );
}
