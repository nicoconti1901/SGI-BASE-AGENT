/**
 * Scan diario de vencimientos: primero cada módulo con avisos derivados pone sus `DueItem` al día
 * (hoy, capacitaciones) y después `scanDueReminders` avisa lo que entró en ventana.
 * Es el punto de entrada del endpoint de n8n y del botón de la plataforma.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { scanDueReminders } from "@/lib/automation";
import { reconcileSafely } from "@/lib/training-followup";

type ScanOptions = NonNullable<Parameters<typeof scanDueReminders>[0]>;

/** Concilia los avisos de capacitaciones de las empresas que tienen el módulo activo. */
export async function reconcileModuleDueItems(options: { db?: PrismaClient; tenantId?: string; now?: Date } = {}) {
  const db = options.db ?? prisma;
  const activations = await db.tenantModuleActivation.findMany({
    where: { moduleKey: "training", enabled: true, ...(options.tenantId ? { tenantId: options.tenantId } : {}) },
    select: { tenantId: true },
  });
  for (const { tenantId } of activations) {
    // Cubre los cambios de puesto o de tareas que otro módulo hizo sin avisar; es idempotente.
    await reconcileSafely(tenantId, { now: options.now }, db);
  }
  return activations.length;
}

export async function runDueScan(options: ScanOptions = {}) {
  await reconcileModuleDueItems({ db: options.db, tenantId: options.tenantId, now: options.now });
  return scanDueReminders(options);
}
