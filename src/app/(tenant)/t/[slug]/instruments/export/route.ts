import { NextResponse } from "next/server";
import { getAppSessionContext } from "@/lib/session";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { exportInstrumentRows, INSTRUMENTS_EXPORT_LIMIT } from "@/lib/instruments";
import { instrumentFilterFromParams } from "@/app/(tenant)/t/[slug]/instruments/filters";
import { instrumentsToCsv } from "@/domain/calibration/export";
import { todayIso } from "@/domain/inspections/dates";

/** Equipos en CSV con los mismos filtros de la lista (UTF-8 con BOM). Tope de 20.000 filas. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getAppSessionContext();
  if (!ctx) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!ctx.isPlatformSuperuser && !(await getMembership(ctx.userId, tenant.id))) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }
  if (!(await getEnabledModulesCached(tenant.id)).has("instruments")) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const filter = instrumentFilterFromParams(new URL(request.url).searchParams);
  const { rows, truncated } = await exportInstrumentRows(tenant.id, filter);
  return new NextResponse(instrumentsToCsv(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="equipos-de-medicion-${todayIso()}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Export-Rows": String(rows.length),
      ...(truncated ? { "X-Export-Truncated": String(INSTRUMENTS_EXPORT_LIMIT) } : {}),
    },
  });
}
