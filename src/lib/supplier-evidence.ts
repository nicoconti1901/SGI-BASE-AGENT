import type { FindingStatus, Prisma, SupplierFindingKind } from "@prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient;

const EVIDENCE_LIMIT = 20;
const OPEN_FINDING: { notIn: FindingStatus[] } = { notIn: ["closed", "cancelled"] };

export type EvaluationEvidence = {
  /** Fecha de la última evaluación no anulada; `null` si todavía no hay (se muestra todo el historial). */
  since: Date | null;
  findings: { id: string; title: string; status: FindingStatus; detectedAt: Date; kind: SupplierFindingKind; open: boolean }[];
  /** Acciones abiertas o en curso que cuelgan de sus evaluaciones o de sus hallazgos. */
  openActions: { id: string; title: string; status: string; dueAt: Date | null }[];
  /** Hallazgos abiertos detectados después de la última evaluación (conteo exacto en la base). */
  openFindingsSinceLast: number;
  /** El plan de mejora de la última evaluación «con condiciones» existe y todas sus acciones están completadas. */
  planClosed: boolean;
};

/**
 * Lo que el evaluador necesita ver antes de calificar: hallazgos del proveedor, acciones abiertas y el estado del plan de
 * mejora anterior. Consultas acotadas (conteos en la base, listas de hasta 20) y siempre filtradas por empresa.
 */
export async function getEvaluationEvidence(tenantId: string, supplierId: string, db: Tx = prisma): Promise<EvaluationEvidence> {
  const last = await db.supplierEvaluation.findFirst({
    where: { tenantId, supplierId, voidedAt: null },
    orderBy: [{ evaluatedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, result: true, evaluatedAt: true },
  });
  const since = last?.evaluatedAt ?? null;
  // Un hallazgo cuenta si es posterior a la última evaluación o si todavía está abierto.
  const findingWhere: Prisma.SupplierFindingWhereInput = {
    tenantId,
    supplierId,
    finding: {
      tenantId,
      status: { not: "cancelled" },
      ...(since ? { OR: [{ detectedAt: { gte: since } }, { status: OPEN_FINDING }] } : {}),
    },
  };

  const [rows, openFindingsSinceLast, evaluationIds, planActions] = await Promise.all([
    db.supplierFinding.findMany({
      where: findingWhere,
      select: { kind: true, finding: { select: { id: true, title: true, status: true, detectedAt: true } } },
      orderBy: { finding: { detectedAt: "desc" } },
      take: EVIDENCE_LIMIT,
    }),
    db.supplierFinding.count({
      where: {
        tenantId,
        supplierId,
        finding: { tenantId, status: OPEN_FINDING, ...(since ? { detectedAt: { gte: since } } : {}) },
      },
    }),
    db.supplierEvaluation.findMany({ where: { tenantId, supplierId }, select: { id: true }, take: 100, orderBy: { evaluatedAt: "desc" } }),
    last && last.result === "conditional"
      ? db.action.findMany({
          where: { tenantId, links: { some: { targetType: "supplier_evaluation", targetId: last.id } } },
          select: { status: true },
          take: 20,
        })
      : Promise.resolve([] as { status: string }[]),
  ]);

  const findingIds = rows.map((r) => r.finding.id);
  const links: Prisma.ActionLinkWhereInput[] = [];
  if (evaluationIds.length) links.push({ targetType: "supplier_evaluation", targetId: { in: evaluationIds.map((e) => e.id) } });
  if (findingIds.length) links.push({ targetType: "finding", targetId: { in: findingIds } });
  const openActions = links.length
    ? await db.action.findMany({
        where: { tenantId, status: { in: ["open", "in_progress"] }, links: { some: { OR: links } } },
        select: { id: true, title: true, status: true, dueAt: true },
        orderBy: [{ dueAt: "asc" }],
        take: EVIDENCE_LIMIT,
      })
    : [];

  return {
    since,
    findings: rows.map((r) => ({ ...r.finding, kind: r.kind, open: r.finding.status !== "closed" })),
    openActions,
    openFindingsSinceLast,
    planClosed: planActions.length > 0 && planActions.every((a) => a.status === "completed"),
  };
}
