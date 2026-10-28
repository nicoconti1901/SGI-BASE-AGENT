import { Button, EntityList, SectionBlock, StatusChip } from "@/components/ui";
import { AUDIT_STANDARD_LABELS } from "@/domain/audits/types";
import { OPT_IN_STANDARDS, UNVERIFIED_TAG } from "@/domain/ims/catalog";
import { listOfferedStandards } from "@/lib/ims-catalog";
import { adoptStandardAction } from "./standard-actions";

/** Normas que la empresa no recibe en su plantilla y se adoptan a pedido. */
export async function OptInStandardsSection({ slug, tenantId }: { slug: string; tenantId: string }) {
  const offered = new Set(await listOfferedStandards(tenantId));

  return (
    <SectionBlock
      title="Normas opcionales"
      eyebrow="Alcance del cliente"
      what="Normas que no vienen en la plantilla de una empresa nueva. Al adoptarla, sus requisitos se suman a la empresa y la norma pasa a ofrecerse en objetivos y auditorías."
      next="adoptala solo si el cliente la va a gestionar."
    >
      <EntityList aria-label="Normas opcionales">
        {OPT_IN_STANDARDS.map((standard) => {
          const adopted = offered.has(standard);
          return (
            <li key={standard} className="flex min-h-12 flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{AUDIT_STANDARD_LABELS[standard]}</p>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  Los requisitos figuran «{UNVERIFIED_TAG}» hasta confirmar el índice contra la norma licenciada.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusChip status={adopted ? "ok" : "pending"} label={adopted ? "Adoptada" : "No adoptada"} />
                {adopted ? null : (
                  <form action={adoptStandardAction.bind(null, slug, standard)}>
                    <Button type="submit" variant="secondary">
                      {`Adoptar ${AUDIT_STANDARD_LABELS[standard]}`}
                    </Button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </EntityList>
    </SectionBlock>
  );
}
