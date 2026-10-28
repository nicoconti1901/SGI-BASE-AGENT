/**
 * Scan diario de vencimientos: primero cada módulo con avisos derivados pone sus `DueItem` al día
 * (capacitaciones y exposición de accidentabilidad) y después `scanDueReminders` avisa lo que entró en ventana.
 * Es el punto de entrada del endpoint de n8n y del botón de la plataforma.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { scanDueReminders } from "@/lib/automation";
import { reconcileSafely } from "@/lib/training-followup";
import { syncExposureDueItemsSafely } from "@/lib/safety-exposure";
import { syncKmDueItemsSafely } from "@/lib/road-safety";

type ScanOptions = NonNullable<Parameters<typeof scanDueReminders>[0]>;

/** Concilia los avisos derivados de las empresas que tienen activo cada módulo. */
export async function reconcileModuleDueItems(options: { db?: PrismaClient; tenantId?: string; now?: Date } = {}) {
  const db = options.db ?? prisma;
  const activations = await db.tenantModuleActivation.findMany({
    where: { moduleKey: { in: ["training", "safety_stats", "road_safety"] }, enabled: true, ...(options.tenantId ? { tenantId: options.tenantId } : {}) },
    select: { tenantId: true, moduleKey: true },
  });
  for (const { tenantId, moduleKey } of activations) {
    // Cubre cambios que otro módulo hizo sin avisar; es idempotente.
    if (moduleKey === "training") await reconcileSafely(tenantId, { now: options.now }, db);
    else if (moduleKey === "road_safety") await syncKmDueItemsSafely(tenantId, db);
    else await syncExposureDueItemsSafely(tenantId, db);
  }
  return activations.length;
}

export async function runDueScan(options: ScanOptions = {}) {
  await reconcileModuleDueItems({ db: options.db, tenantId: options.tenantId, now: options.now });
  return scanDueReminders(options);
}
