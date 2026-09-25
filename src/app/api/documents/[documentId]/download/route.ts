import { NextResponse } from "next/server";
import { getAppSessionContext } from "@/lib/session";
import { getMembership } from "@/lib/identity";
import { readDocumentFile } from "@/lib/documents";

type Params = Promise<{ documentId: string }>;

export async function GET(
  request: Request,
  { params }: { params: Params },
) {
  const ctx = await getAppSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { documentId } = await params;
  const url = new URL(request.url);
  const versionId = url.searchParams.get("versionId") ?? undefined;

  const file = await readDocumentFile(documentId, { versionId });
  if (!file) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (!ctx.isPlatformSuperuser) {
    const membership = await getMembership(ctx.userId, file.document.tenantId);
    if (!membership) {
      return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    }
  }

  return new NextResponse(new Uint8Array(file.body), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.version.fileName)}"`,
      "Content-Length": String(file.body.length),
      "Cache-Control": "private, no-store",
    },
  });
}
