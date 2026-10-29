import { NextResponse } from "next/server";
import { getAppSessionContext } from "@/lib/session";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { defaultRoadAnchor, exportRoadCases, getRoadTotalsSeries, roadMonthOptions } from "@/lib/road-dashboard";
import type { RoadUser } from "@/lib/road-safety";
import { canManageRoadSafety } from "@/domain/road-safety/access";
import { roadTotalsToCsv } from "@/domain/road-safety/dashboard";
import { WINDOW_KINDS, resolveWindow, type WindowKind } from "@/domain/safety-stats/dashboard";
import { localDay } from "@/domain/safety-stats/period";

/**
 * CSV de seguridad vial con el período del tablero (UTF-8 con BOM).
 * `tipo=totales`: tasas por mes, sin nombres; lo baja cualquier rol. `tipo=casos`: con el conductor; solo
 * quien gestiona la seguridad vial (D24) y queda registro de quién lo bajó.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getAppSessionContext();
  if (!ctx) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const membership = await getMembership(ctx.userId, tenant.id);
  if (!ctx.isPlatformSuperuser && !membership) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  if (!(await getEnabledModulesCached(tenant.id)).has("road_safety")) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const sp = new URL(request.url).searchParams;
  const today = localDay(new Date());
  const kind: WindowKind = (WINDOW_KINDS as readonly string[]).includes(sp.get("ventana") ?? "") ? (sp.get("ventana") as WindowKind) : "rolling12";
  const mes = sp.get("mes") ?? "";
  const anchor = roadMonthOptions(today, 24).includes(mes) ? mes : defaultRoadAnchor(today);
  const months = resolveWindow(kind, anchor).months;
  const actor: RoadUser = { userId: ctx.userId, role: membership?.role, isPlatformSuperuser: ctx.isPlatformSuperuser };
  const filename = (name: string) => `${name}-${months[0]}${months.length > 1 ? `-a-${months[months.length - 1]}` : ""}.csv`;
  const headers = (name: string) => ({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename(name)}"`,
    "Cache-Control": "private, no-store",
  });

  if (sp.get("tipo") === "casos") {
    if (!canManageRoadSafety(actor)) return NextResponse.json({ error: "Tu rol no permite descargar los casos con nombre" }, { status: 403 });
    const { csv, rows, truncated } = await exportRoadCases({ tenantId: tenant.id, actor, months });
    return new NextResponse(csv, { status: 200, headers: { ...headers("seguridad-vial-casos"), "X-Export-Rows": String(rows), ...(truncated ? { "X-Export-Truncated": "true" } : {}) } });
  }

  const series = await getRoadTotalsSeries({ tenantId: tenant.id, months });
  return new NextResponse(roadTotalsToCsv(series), { status: 200, headers: { ...headers("seguridad-vial-por-mes"), "X-Export-Rows": String(series.length) } });
}
