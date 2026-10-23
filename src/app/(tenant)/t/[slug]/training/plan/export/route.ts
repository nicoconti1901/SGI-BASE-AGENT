import { NextResponse } from "next/server";
import { getAppSessionContext } from "@/lib/session";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { trainingToday } from "@/lib/training";
import { PLAN_EXPORT_LIMIT, listPlanSessions, planToCsv } from "@/lib/training-plan";

/** CSV del plan anual para imprimir y firmar. Cualquier integrante de la empresa puede exportarlo. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getAppSessionContext();
  if (!ctx) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!ctx.isPlatformSuperuser && !(await getMembership(ctx.userId, tenant.id))) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }
  if (!(await getEnabledModulesCached(tenant.id)).has("training")) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const requested = Number(new URL(request.url).searchParams.get("anio"));
  const year = Number.isInteger(requested) && requested >= 2000 && requested <= 2100 ? requested : Number(trainingToday().slice(0, 4));
  const rows = await listPlanSessions(tenant.id, { year, take: PLAN_EXPORT_LIMIT });
  return new NextResponse(planToCsv(rows, "Toda la empresa"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="plan-capacitacion-${year}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
