import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createAction } from "@/lib/actions";
import { cleanName } from "@/domain/masterdata/roster";
import { buenosAiresToday } from "@/domain/suppliers/dates";
import {
  EVALUATION_KINDS,
  criteriaForEvaluation,
  lowScoresWithoutComment,
  type EvaluationKindValue,
} from "@/domain/suppliers/evaluation";
import { SCORE_ERROR_MESSAGES, evaluateSupplier, type ScoreItem } from "@/domain/suppliers/scoring";
import { DEFAULT_THRESHOLDS, type EvaluationModeValue } from "@/domain/suppliers/types";
import { SupplierError, asClient, audit, recomputeSupplierSummary } from "@/lib/suppliers";
import { getPublishedTemplate } from "@/lib/supplier-criteria";

type Tx = Prisma.TransactionClient;

export type EvaluationAnswer = { criterionId: string; score: number | null; comment?: string };

export type ImprovementPlanInput = {
  title?: string;
  description?: string;
  ownerUserId: string;
  dueAt: Date;
};

export type SaveEvaluationInput = {
  tenantId: string;
  actorUserId: string;
  supplierId: string;
  kind: EvaluationKindValue;
  mode: EvaluationModeValue;
  /** Día de la evaluación; por defecto hoy (Buenos Aires). */
  evaluatedAt?: Date;
  periodFrom?: Date | null;
  periodTo?: Date | null;
  /** Comentario general. En la aceptación con motivo es el motivo y es obligatorio. */
  comment?: string;
  answers?: EvaluationAnswer[];
  /** Obligatorio si el resultado es «con condiciones». */
  plan?: ImprovementPlanInput;
  now?: Date;
};

const MODES: EvaluationModeValue[] = ["full", "simplified", "declared"];

/**
 * Guarda una evaluación. El total, la cobertura y el resultado se **calculan acá** con las mismas funciones
 * puras que usa la pantalla: nada de eso se recibe del cliente. La evaluación es inmutable; guarda una copia fija
 * de los criterios, los pesos y los umbrales. Si el resultado es condicional, exige y crea el plan de mejora.
 */
export async function saveEvaluation(input: SaveEvaluationInput, db: PrismaClient = prisma) {
  if (!EVALUATION_KINDS.includes(input.kind)) throw new SupplierError("Elegí el tipo de evaluación");
  if (!MODES.includes(input.mode)) throw new SupplierError("Elegí cómo evaluar");
  const now = input.now ?? new Date();
  const today = buenosAiresToday(now);
  const evaluatedAt = input.evaluatedAt ?? today;
  if (Number.isNaN(evaluatedAt.getTime()) || evaluatedAt.getTime() > today.getTime()) {
    throw new SupplierError("La fecha de la evaluación no puede ser futura");
  }
  if (input.periodFrom && input.periodTo && input.periodFrom.getTime() > input.periodTo.getTime()) {
    throw new SupplierError("El período evaluado termina antes de empezar");
  }
  const comment = (input.comment ?? "").trim();

  return db.$transaction(async (tx) => {
    const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, tenantId: input.tenantId } });
    if (!supplier) throw new SupplierError("Proveedor no encontrado");
    if (supplier.inactiveAt) throw new SupplierError("El proveedor está de baja: reactivalo para evaluarlo");

    const previous = await tx.supplierEvaluation.count({ where: { tenantId: input.tenantId, supplierId: supplier.id, voidedAt: null } });
    if (input.kind === "initial" && previous > 0) {
      throw new SupplierError("Ya tiene una evaluación inicial: registrá una periódica o por evento");
    }
    if (input.kind !== "initial" && previous === 0) {
      throw new SupplierError("Todavía no tiene una evaluación inicial");
    }

    // ── Criterios, notas y cálculo ──
    let thresholds: { approvedMin: number; conditionalMin: number } = DEFAULT_THRESHOLDS;
    let templateId: string | null = null;
    let templateVersion: number | null = null;
    let items: { criterionId: string; position: number; name: string; description: string; weight: number; excluding: boolean; allowNA: boolean; score: number | null; comment: string }[] = [];

    if (input.mode === "declared") {
      if (comment.length < 3) throw new SupplierError("Escribí el motivo de la aceptación");
    } else {
      const template = await getPublishedTemplate(input.tenantId, supplier.type, tx);
      if (!template) throw new SupplierError("No hay criterios publicados para este tipo de proveedor");
      thresholds = { approvedMin: template.approvedMin, conditionalMin: template.conditionalMin };
      templateId = template.id;
      templateVersion = template.version;

      const scoped = criteriaForEvaluation(template.criteria, input.kind, input.mode);
      const answers = new Map<string, EvaluationAnswer>();
      for (const answer of input.answers ?? []) {
        if (answers.has(answer.criterionId)) throw new SupplierError("Hay un criterio respondido dos veces");
        answers.set(answer.criterionId, answer);
      }
      const known = new Set(scoped.map((c) => c.id));
      if ([...answers.keys()].some((id) => !known.has(id))) throw new SupplierError("Hay una respuesta que no corresponde a esta evaluación");

      items = scoped.map((c) => {
        const a = answers.get(c.id);
        return {
          criterionId: c.id,
          position: c.position,
          name: c.name,
          description: c.description,
          weight: c.weight,
          excluding: c.excluding,
          allowNA: c.allowNA,
          score: a?.score ?? null,
          comment: (a?.comment ?? "").trim(),
        };
      });
    }

    const scoreItems: ScoreItem[] = items.map((i) => ({
      name: i.name,
      weight: i.weight,
      score: i.score,
      excluding: i.excluding,
      allowNA: i.allowNA,
      // Ya filtrados por modo: en simplificada todos entran.
      basic: true,
    }));
    const outcome = evaluateSupplier(scoreItems, input.mode, supplier.criticality, thresholds);
    if (!outcome.ok) {
      const name = outcome.itemIndex !== undefined ? items[outcome.itemIndex]?.name : undefined;
      const message = SCORE_ERROR_MESSAGES[outcome.error];
      throw new SupplierError(name ? `${message}: «${name}»` : message);
    }
    const missing = lowScoresWithoutComment(items);
    if (missing.length) {
      throw new SupplierError(`Una nota de 1 o 2 necesita un comentario: «${items[missing[0]].name}»`);
    }

    // ── Plan de mejora (solo si queda condicional) ──
    let plan: { title: string; description: string; ownerUserId: string; dueAt: Date } | null = null;
    if (outcome.result === "conditional") {
      if (!input.plan) throw new SupplierError("Un proveedor «con condiciones» necesita un plan de mejora: indicá un responsable y una fecha");
      const { ownerUserId, dueAt } = input.plan;
      if (!ownerUserId || !(await tx.membership.count({ where: { tenantId: input.tenantId, userId: ownerUserId } }))) {
        throw new SupplierError("El responsable del plan no es integrante de la empresa");
      }
      if (!(dueAt instanceof Date) || Number.isNaN(dueAt.getTime()) || dueAt.getTime() < today.getTime()) {
        throw new SupplierError("La fecha del plan de mejora no puede ser anterior a hoy");
      }
      plan = {
        title: cleanName(input.plan.title ?? "") || `Plan de mejora: ${supplier.legalName}`,
        description: input.plan.description?.trim() || `Resultado «con condiciones» en la evaluación de ${supplier.legalName}.`,
        ownerUserId,
        dueAt,
      };
    }

    const evaluation = await tx.supplierEvaluation.create({
      data: {
        tenantId: input.tenantId,
        supplierId: supplier.id,
        kind: input.kind,
        mode: input.mode,
        templateId,
        templateVersion,
        approvedMin: thresholds.approvedMin,
        conditionalMin: thresholds.conditionalMin,
        criticalityAtEvaluation: supplier.criticality,
        periodFrom: input.periodFrom ?? null,
        periodTo: input.periodTo ?? null,
        evaluatedAt,
        evaluatorUserId: input.actorUserId,
        totalScore: outcome.total,
        coverage: outcome.coverage,
        result: outcome.result,
        resultReason: outcome.resultReason,
        comment,
        items: {
          create: items.map((i) => ({
            tenantId: input.tenantId,
            criterionId: i.criterionId,
            position: i.position,
            name: i.name,
            description: i.description,
            weight: i.weight,
            excluding: i.excluding,
            allowNA: i.allowNA,
            score: i.score,
            comment: i.comment,
          })),
        },
      },
    });

    let actionId: string | null = null;
    if (plan) {
      const action = await createAction(
        {
          tenantId: input.tenantId,
          createdByUserId: input.actorUserId,
          draft: {
            title: plan.title,
            description: plan.description,
            ownerUserId: plan.ownerUserId,
            dueAt: plan.dueAt,
            links: [{ targetType: "supplier_evaluation", targetId: evaluation.id }],
          },
        },
        asClient(tx),
      );
      actionId = action.id;
    }

    // Estado, próxima reevaluación, `DueItem` y habilitación: un único lugar.
    const updated = await recomputeSupplierSummary(input.tenantId, supplier.id, tx, now);
    await audit(tx, {
      tenantId: input.tenantId,
      entityId: supplier.id,
      action: "evaluate",
      actorUserId: input.actorUserId,
      summary: `Evaluación ${input.kind === "initial" ? "inicial" : input.kind === "periodic" ? "periódica" : "por evento"} de «${supplier.legalName}»: ${
        outcome.total === null ? "aceptado con motivo" : `${outcome.total.toFixed(1)} puntos`
      }, ${outcome.result === "approved" ? "aprobado" : outcome.result === "conditional" ? "con condiciones" : "no aprobado"}`,
    });
    return { evaluation, actionId, supplierStatus: updated.status };
  });
}

/** Anula una evaluación (motivo obligatorio). El estado y la próxima reevaluación vuelven a los de la anterior. */
export async function voidEvaluation(
  input: { tenantId: string; actorUserId: string; supplierId: string; evaluationId: string; reason: string; now?: Date },
  db: PrismaClient = prisma,
) {
  const reason = cleanName(input.reason);
  if (reason.length < 3) throw new SupplierError("Escribí el motivo de la anulación");
  await db.$transaction(async (tx) => {
    const evaluation = await tx.supplierEvaluation.findFirst({
      where: { id: input.evaluationId, tenantId: input.tenantId, supplierId: input.supplierId },
      include: { supplier: { select: { legalName: true } } },
    });
    if (!evaluation) throw new SupplierError("Evaluación no encontrada");
    if (evaluation.voidedAt) throw new SupplierError("La evaluación ya está anulada");
    await tx.supplierEvaluation.update({
      where: { id: evaluation.id },
      data: { voidedAt: new Date(), voidedByUserId: input.actorUserId, voidReason: reason },
    });
    await recomputeSupplierSummary(input.tenantId, input.supplierId, tx, input.now);
    await audit(tx, {
      tenantId: input.tenantId,
      entityId: input.supplierId,
      action: "void_evaluation",
      actorUserId: input.actorUserId,
      summary: `Se anuló una evaluación de «${evaluation.supplier.legalName}»: ${reason}`,
    });
  });
}

// ─── Lectura ───────────────────────────────────────────────────────────────

const num = (value: Prisma.Decimal | null) => (value === null ? null : Number(value));

const listSelect = {
  id: true,
  kind: true,
  mode: true,
  evaluatedAt: true,
  templateVersion: true,
  criticalityAtEvaluation: true,
  totalScore: true,
  result: true,
  resultReason: true,
  evaluatorUserId: true,
  voidedAt: true,
  voidReason: true,
} satisfies Prisma.SupplierEvaluationSelect;

async function userNames(tenantId: string, ids: (string | null)[], db: Tx): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map();
  const users = await db.user.findMany({
    where: { id: { in: unique }, memberships: { some: { tenantId } } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

/** Historial de evaluaciones del proveedor, la más reciente primero (acotado). */
export async function listSupplierEvaluations(tenantId: string, supplierId: string, db: Tx = prisma) {
  const rows = await db.supplierEvaluation.findMany({
    where: { tenantId, supplierId },
    select: listSelect,
    orderBy: [{ evaluatedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  const names = await userNames(tenantId, rows.map((r) => r.evaluatorUserId), db);
  return rows.map((r) => ({ ...r, totalScore: num(r.totalScore), evaluatorName: r.evaluatorUserId ? (names.get(r.evaluatorUserId) ?? null) : null }));
}

/** Una evaluación con su copia fija de criterios y el plan de mejora vinculado. */
export async function getSupplierEvaluation(tenantId: string, supplierId: string, evaluationId: string, db: Tx = prisma) {
  const evaluation = await db.supplierEvaluation.findFirst({
    where: { id: evaluationId, tenantId, supplierId },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!evaluation) return null;
  const [names, actions] = await Promise.all([
    userNames(tenantId, [evaluation.evaluatorUserId, evaluation.voidedByUserId], db),
    db.action.findMany({
      where: { tenantId, links: { some: { targetType: "supplier_evaluation", targetId: evaluation.id } } },
      select: { id: true, title: true, status: true, dueAt: true, ownerUserId: true },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
  ]);
  const owners = await userNames(tenantId, actions.map((a) => a.ownerUserId), db);
  return {
    ...evaluation,
    totalScore: num(evaluation.totalScore),
    coverage: num(evaluation.coverage),
    evaluatorName: evaluation.evaluatorUserId ? (names.get(evaluation.evaluatorUserId) ?? null) : null,
    voidedByName: evaluation.voidedByUserId ? (names.get(evaluation.voidedByUserId) ?? null) : null,
    actions: actions.map((a) => ({ ...a, ownerName: owners.get(a.ownerUserId) ?? null })),
  };
}
