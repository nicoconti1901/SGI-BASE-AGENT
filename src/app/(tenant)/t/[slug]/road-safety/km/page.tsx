import { loadRoadAccess } from "@/app/(tenant)/t/[slug]/road-safety/access";
import { KmGrid, ResetForm, type KmRow } from "@/app/(tenant)/t/[slug]/road-safety/km/KmGrid";
import { SpeedingForm } from "@/app/(tenant)/t/[slug]/road-safety/km/SpeedingForm";
import { getKmGrid } from "@/lib/road-safety";
import { shiftMonth, monthLabel } from "@/domain/safety-stats/exposure-import";
import { localDay } from "@/domain/safety-stats/period";
import { Button, EmptyState, Field, HintCallout, INPUT_CLASS, SectionBlock } from "@/components/ui";

const MONTHS_BACK = 12;

export default async function KmPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { slug } = await params;
  const { mes } = await searchParams;
  const { tenant, canManage } = await loadRoadAccess(slug);
  const current = localDay(new Date()).slice(0, 7);
  // Solo los meses que ya cerraron: el más reciente primero.
  const options = Array.from({ length: MONTHS_BACK }, (_, i) => shiftMonth(current, -(i + 1)));
  const month = mes && options.includes(mes) ? mes : options[0];

  const grid = await getKmGrid(tenant.id, month);
  const rows: KmRow[] = grid.map((r) => ({
    assetId: r.assetId,
    code: r.code,
    description: r.description,
    state: r.state,
    computedKm: r.computed.km,
    storedKm: r.stored?.km ?? null,
    manualReason: r.stored?.source === "manual" ? r.stored.manualReason : null,
  }));
  const pending = rows.filter((r) => r.storedKm === null).length;

  return (
    <div className="flex flex-col gap-6">
      <SectionBlock
        title="Km del mes"
        what="Los km de cada vehículo salen de los odómetros de sus inspecciones. Sin km no hay tasa: el tablero dice «sin datos», nunca 0."
        next={
          canManage
            ? "elegí el mes y confirmá los km calculados. Si falta una lectura o está mal, cargalos a mano con el motivo."
            : "consultá lo cargado. Solo el administrador y el responsable de proceso confirman los km."
        }
      >
        <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Mes">
          <Field label="Mes">
            <select name="mes" defaultValue={month} className={INPUT_CLASS}>
              {options.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" variant="secondary">
            Ver
          </Button>
        </form>

        {rows.length === 0 ? (
          <EmptyState what="No hay vehículos livianos cargados." next="cargá los vehículos en Inspecciones y sus odómetros se usan acá." action={{ href: `/t/${slug}/assets`, label: "Ir a Equipos" }} />
        ) : (
          <>
            <HintCallout>
              {pending === 0
                ? `Los ${rows.length} vehículo(s) tienen ${monthLabel(month)} confirmado.`
                : `Faltan confirmar ${pending} de ${rows.length} vehículo(s) en ${monthLabel(month)}. Los vencimientos se avisan el día 10 del mes siguiente.`}
            </HintCallout>
            <KmGrid slug={slug} month={month} monthLabel={monthLabel(month)} rows={rows} canManage={canManage} />
          </>
        )}
      </SectionBlock>

      {canManage && rows.length > 0 ? (
        <SectionBlock title="Excesos de velocidad" what={`Si la empresa los mide, cargá los de ${monthLabel(month)} por vehículo. Aparecen en los resultados intermedios del tablero.`}>
          <SpeedingForm slug={slug} month={month} vehicles={rows.map((r) => ({ id: r.assetId, code: r.code }))} />
        </SectionBlock>
      ) : null}

      {canManage && rows.length > 0 ? (
        <SectionBlock title="Reinicio de odómetro" what="Si un vehículo cambió de tablero o se reinició el odómetro, marcalo para que los km no se calculen como una resta imposible.">
          <ResetForm slug={slug} vehicles={rows.map((r) => ({ id: r.assetId, code: r.code }))} />
        </SectionBlock>
      ) : null}
    </div>
  );
}
