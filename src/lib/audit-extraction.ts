import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AuditGateError, createExternalFinding } from "@/lib/audits";
import { readExternalAuditReport } from "@/lib/audit-checklist";
import type { ObjectStorage } from "@/lib/storage/types";
import {
  EXTRACTION_PROMPT,
  EXTRACTION_TOOL,
  findingDescription,
  normalizeTitle,
  parseProposals,
  type ProposedFinding,
} from "@/domain/audits/extraction";

/** Envía el PDF al modelo y devuelve la salida cruda de la herramienta. */
export type ExtractionClient = (pdf: Buffer) => Promise<unknown>;

const DEFAULT_MODEL = "claude-sonnet-5-5";

export function isExtractionEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export const anthropicExtractionClient: ExtractionClient = async (pdf) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AuditGateError(["La extracción automática no está configurada"]);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
      max_tokens: 8000,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: EXTRACTION_TOOL.name },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new AuditGateError([`El servicio de extracción respondió con error (${response.status})`]);
  }
  const data = (await response.json()) as { content?: { type: string; input?: { findings?: unknown } }[] };
  const block = data.content?.find((c) => c.type === "tool_use");
  return block?.input?.findings ?? [];
};

/** Propone hallazgos a partir del informe adjunto. No persiste nada. */
export async function extractFindingsFromReport(
  input: { tenantId: string; auditId: string; attachmentId: string },
  options?: { db?: PrismaClient; storage?: ObjectStorage; client?: ExtractionClient },
): Promise<ProposedFinding[]> {
  const db = options?.db ?? prisma;
  const file = await readExternalAuditReport(input.attachmentId, options);
  if (
    !file ||
    file.attachment.tenantId !== input.tenantId ||
    file.attachment.auditId !== input.auditId
  ) {
    throw new AuditGateError(["No se encontró el informe"]);
  }
  if (file.contentType !== "application/pdf") {
    throw new AuditGateError(["La extracción automática solo funciona con informes en PDF"]);
  }
  const audit = await db.audit.findFirst({
    where: { id: input.auditId, tenantId: input.tenantId, kind: "external" },
  });
  if (!audit || audit.status === "cancelled") {
    throw new AuditGateError(["La auditoría externa no admite extracción"]);
  }
  const client = options?.client ?? anthropicExtractionClient;
  return parseProposals(await client(file.body));
}

/** Crea como borrador los hallazgos que el usuario confirmó; omite los ya cargados con el mismo título. */
export async function confirmExtractedFindings(
  input: { tenantId: string; auditId: string; userId: string; proposals: unknown },
  db: PrismaClient = prisma,
) {
  const proposals = parseProposals(input.proposals);
  if (proposals.length === 0) throw new AuditGateError(["No hay hallazgos para registrar"]);
  const existing = await db.finding.findMany({
    where: { tenantId: input.tenantId, auditId: input.auditId, status: { not: "cancelled" } },
    select: { title: true },
  });
  const seen = new Set(existing.map((f) => normalizeTitle(f.title)));
  let created = 0;
  let skipped = 0;
  for (const p of proposals) {
    const key = normalizeTitle(p.title);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    await createExternalFinding(
      {
        tenantId: input.tenantId,
        auditId: input.auditId,
        userId: input.userId,
        result: p.kind,
        title: p.title,
        description: findingDescription(p),
        detectedAt: new Date(),
      },
      db,
    );
    seen.add(key);
    created++;
  }
  return { created, skipped };
}
