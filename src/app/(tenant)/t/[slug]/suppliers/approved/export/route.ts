import { NextResponse } from "next/server";
import { getAppSessionContext } from "@/lib/session";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getApprovedList, recordApprovedListExport } from "@/lib/suppliers";
import { approvedListToCsv } from "@/domain/suppliers/approved-list";
import { isoDay } from "@/domain/suppliers/dates";

/** Lista de aprobados en CSV (UTF-8 con BOM). La puede bajar quien puede ver el módulo; queda registrada. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getAppSessionContext();
  if (!ctx) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!ctx.isPlatformSuperuser && !(await getMembership(ctx.userId, tenant.id))) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }
  if (!(await getEnabledModulesCached(tenant.id)).has("suppliers")) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const now = new Date();
  const list = await getApprovedList(tenant.id, now);
  await recordApprovedListExport({
    tenantId: tenant.id,
    actorUserId: ctx.userId,
    count: list.entries.length,
    excluded: list.excludedForDocs,
    format: "csv",
  });
  const csv = approvedListToCsv(list, { tenantName: tenant.name, generatedBy: ctx.name, generatedAt: now });
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lista-de-aprobados-${isoDay(now)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
