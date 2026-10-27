import { NextResponse } from "next/server";
import { getAppSessionContext } from "@/lib/session";
import { getMembership } from "@/lib/identity";
import { getEnabledModules } from "@/lib/modules";
import { getCommunicationTenant, readCommunicationFile } from "@/lib/supplier-followup";

type Params = Promise<{ communicationId: string }>;

/** Descarga del adjunto de una comunicación: sesión, integrante de la empresa dueña del archivo y módulo activo. */
export async function GET(_request: Request, { params }: { params: Params }) {
  const ctx = await getAppSessionContext();
  if (!ctx) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { communicationId } = await params;
  const tenantId = await getCommunicationTenant(communicationId);
  if (!tenantId) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (!ctx.isPlatformSuperuser && !(await getMembership(ctx.userId, tenantId))) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }
  if (!(await getEnabledModules(tenantId)).has("suppliers")) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const file = await readCommunicationFile(tenantId, communicationId);
  if (!file) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return new NextResponse(new Uint8Array(file.body), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.fileName)}"`,
      "Content-Length": String(file.body.length),
      "Cache-Control": "private, no-store",
    },
  });
}
