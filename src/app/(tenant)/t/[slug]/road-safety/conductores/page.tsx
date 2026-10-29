import Link from "next/link";
import { loadRoadAccess } from "@/app/(tenant)/t/[slug]/road-safety/access";
import { LicenseEditor } from "@/app/(tenant)/t/[slug]/road-safety/conductores/LicenseRow";
import { listDrivers } from "@/lib/road-drivers";
import { DRIVER_BLOCKER_LABELS } from "@/domain/road-safety/dashboard";
import { localDay } from "@/domain/safety-stats/period";
import { EmptyState, HintCallout, SectionBlock, StatusChip, buttonClass } from "@/components/ui";

export default async function RoadDriversPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, actor, canManage } = await loadRoadAccess(slug);
  const base = `/t/${slug}/road-safety`;

  // Los nombres de los conductores son de quien gestiona la seguridad vial (D24).
  if (!canManage) {
    return <EmptyState what="Esta lista es del administrador y del responsable de proceso." next="el tablero muestra cuántos conductores están habilitados, sin nombres." action={{ href: base, label: "Ir al tablero" }} />;
  }

  const result = await listDrivers({ tenantId: tenant.id, actor, today: localDay(new Date()) });

  return (
    <div className="flex flex-col gap-6">
      <SectionBlock
        title="Conductores habilitados"
        what="Licencia vigente y manejo defensivo vigente. La fecha de la licencia la cargás vos; el sistema no la valida por jurisdicción."
        next="cargá el vencimiento de la licencia de cada conductor. Consultar esta lista deja un registro."
      >
        {!result.configured ? (
          <EmptyState what="Todavía no elegiste la tarea de conducción." next="elegila en Ajustes para saber quiénes conducen." action={{ href: `${base}/ajustes`, label: "Ir a Ajustes" }} />
        ) : result.rows.length === 0 ? (
          <EmptyState what={`Nadie tiene asignada la tarea «${result.task.name}».`} next="asignala a quienes manejan en Datos maestros." action={{ href: `/t/${slug}/master-data`, label: "Ir a Datos maestros" }} />
        ) : (
          <>
            <p className="text-sm text-[var(--color-ink-muted)]">
              Tarea: <span className="font-semibold text-[var(--color-ink)]">{result.task.name}</span> · {result.rows.filter((r) => r.enabled).length} de {result.rows.length} habilitados
            </p>
            {result.truncated ? <HintCallout>Se muestran los primeros 500 conductores.</HintCallout> : null}
            <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <caption className="sr-only">Conductores y su habilitación</caption>
                <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Conductor</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Estado</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Licencia vence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {result.rows.map((r) => (
                    <tr key={r.personId} className="align-top">
                      <th scope="row" className="px-4 py-3 font-medium">
                        {r.name}
                        <span className="block text-xs font-normal text-[var(--color-ink-muted)]">Legajo {r.employeeCode}</span>
                      </th>
                      <td className="px-4 py-3">
                        {r.enabled ? (
                          <StatusChip status="ok" label="Habilitado" />
                        ) : (
                          <div className="flex flex-col gap-1">
                            <StatusChip status="warning" label="No habilitado" />
                            <ul className="text-xs text-[var(--color-ink-muted)]">
                              {r.blockers.map((b) => (
                                <li key={b}>{DRIVER_BLOCKER_LABELS[b]}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <LicenseEditor slug={slug} personId={r.personId} name={r.name} expiresOn={r.licenseExpiresOn} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              <Link href={`/t/${slug}/training`} className={buttonClass("secondary", "min-h-9")}>
                Ver capacitaciones
              </Link>
            </p>
          </>
        )}
      </SectionBlock>
    </div>
  );
}
