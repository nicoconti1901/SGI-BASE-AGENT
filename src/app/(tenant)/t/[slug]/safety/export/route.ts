import { NextResponse } from "next/server";
import { getAppSessionContext } from "@/lib/session";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { exportIncidentCases, getAggregateExport, windowMonths, CASES_EXPORT_LIMIT } from "@/lib/safety-export";
import { SafetyStatsError } from "@/lib/safety-stats";
import { parseSafetyFilter } from "@/app/(tenant)/t/[slug]/safety/filters";
import { aggregateRowsToCsv, casesToCsv } from "@/domain/safety-stats/export";
import { localDay } from "@/domain/safety-stats/period";

/**
 * CSV de accidentabilidad con el período y los filtros del tablero (UTF-8 con BOM).
 * `tipo=totales`: por sede y mes, sin nombres. `tipo=casos`: con la persona afectada; deja registro de quién lo bajó.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getAppSessionContext();
  if (!ctx) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const membership = await getMembership(ctx.userId, tenant.id);
  if (!ctx.isPlatformSuperuser && !membership) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  if (!(await getEnabledModulesCached(tenant.id)).has("safety_stats")) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const sp = new URL(request.url).searchParams;
  const filter = await parseSafetyFilter(
    tenant.id,
    { ventana: sp.get("ventana") ?? undefined, mes: sp.get("mes") ?? undefined, sede: sp.get("sede") ?? undefined, grupo: sp.get("grupo") ?? undefined },
    localDay(new Date()),
  );
  const scope = { tenantId: tenant.id, months: windowMonths(filter.kind, filter.anchor), siteId: filter.siteId };
  const headers = (name: string) => ({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${name}-${scope.months[0]}${scope.months.length > 1 ? `-a-${scope.months[scope.months.length - 1]}` : ""}.csv"`,
    "Cache-Control": "private, no-store",
  });

  if (sp.get("tipo") === "casos") {
    try {
      const { rows, truncated } = await exportIncidentCases({ ...scope, actor: { userId: ctx.userId, role: membership?.role, isPlatformSuperuser: ctx.isPlatformSuperuser } });
      return new NextResponse(casesToCsv(rows), {
        status: 200,
        headers: { ...headers("accidentes-casos"), "X-Export-Rows": String(rows.length), ...(truncated ? { "X-Export-Truncated": String(CASES_EXPORT_LIMIT) } : {}) },
      });
    } catch (error) {
      // D13: el personal de plataforma no recibe los datos de salud.
      if (error instanceof SafetyStatsError) return NextResponse.json({ error: error.message }, { status: 403 });
      throw error;
    }
  }

  const { rows, settings } = await getAggregateExport(scope);
  return new NextResponse(aggregateRowsToCsv(rows, settings), { status: 200, headers: { ...headers("accidentabilidad-por-sede"), "X-Export-Rows": String(rows.length) } });
}
