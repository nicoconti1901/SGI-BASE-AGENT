import { NextResponse } from "next/server";
import { getAppSessionContext } from "@/lib/session";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { exportComplianceBatches, trainingToday } from "@/lib/training";
import { COMPLIANCE_CSV_PREFIX, complianceCsvLine } from "@/domain/training/export";
import type { TrainingStatus } from "@/domain/training/types";

const STATES = new Set(["valid", "expiring", "expired", "missing", "in_grace"]);

/** Cumplimiento en formato largo (una fila por persona y curso), en streaming y con los filtros de la matriz. */
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

  const q = new URL(request.url).searchParams;
  const estado = q.get("estado");
  const today = trainingToday();
  const filter = {
    today,
    siteId: q.get("sede") || undefined,
    positionId: q.get("puesto") || undefined,
    jobTaskId: q.get("tarea") || undefined,
    q: q.get("q") || undefined,
    status: estado && STATES.has(estado) ? (estado as Exclude<TrainingStatus, "not_required">) : undefined,
  };

  const encoder = new TextEncoder();
  const batches = exportComplianceBatches(tenant.id, filter);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(COMPLIANCE_CSV_PREFIX));
    },
    async pull(controller) {
      const next = await batches.next();
      if (next.done) controller.close();
      else controller.enqueue(encoder.encode(`${next.value.map(complianceCsvLine).join("\r\n")}\r\n`));
    },
    async cancel() {
      await batches.return(undefined);
    },
  });
  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cumplimiento-capacitaciones-${today}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
