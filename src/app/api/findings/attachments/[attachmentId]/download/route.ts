import { NextResponse } from "next/server";
import { getAppSessionContext } from "@/lib/session";
import { getMembership } from "@/lib/identity";
import { readFindingAttachmentFile } from "@/lib/finding-attachments";

type Params = Promise<{ attachmentId: string }>;

export async function GET(
  _request: Request,
  { params }: { params: Params },
) {
  const ctx = await getAppSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { attachmentId } = await params;
  const file = await readFindingAttachmentFile(attachmentId);
  if (!file) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (!ctx.isPlatformSuperuser) {
    const membership = await getMembership(
      ctx.userId,
      file.attachment.tenantId,
    );
    if (!membership) {
      return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    }
  }

  return new NextResponse(new Uint8Array(file.body), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.attachment.fileName)}"`,
      "Content-Length": String(file.body.length),
      "Cache-Control": "private, no-store",
    },
  });
}
