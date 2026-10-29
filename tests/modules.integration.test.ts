import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { getEnabledModules, ModuleActivationError, setModuleEnabled } from "@/lib/modules";
import { MODULE_CATALOG, type ModuleDefinition } from "@/domain/modules/catalog";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("módulos por empresa (integration)", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  let a = "";
  let b = "";

  beforeAll(async () => {
    a = (await createTenantWithTemplate({ name: "Mod A", slug: `mod-a-${stamp}`, size: "small", activity: "servicios" })).id;
    b = (await createTenantWithTemplate({ name: "Mod B", slug: `mod-b-${stamp}`, size: "small", activity: "servicios" })).id;
  });

  afterAll(async () => {
    for (const id of [a, b]) {
      await db.tenantModuleActivation.deleteMany({ where: { tenantId: id } });
      await db.tenantRequirement.deleteMany({ where: { tenantId: id } });
      await db.tenant.deleteMany({ where: { id } });
    }
    await db.$disconnect();
  });

  it("desactivar un módulo afecta solo a esa empresa y se puede revertir", async () => {
    await setModuleEnabled({ tenantId: a, moduleKey: "risks", enabled: false, actorUserId: null }, db);
    expect((await getEnabledModules(a, db)).has("risks")).toBe(false);
    expect((await getEnabledModules(b, db)).has("risks")).toBe(true);

    await setModuleEnabled({ tenantId: a, moduleKey: "risks", enabled: true, actorUserId: null }, db);
    expect((await getEnabledModules(a, db)).has("risks")).toBe(true);
    expect(await db.tenantModuleActivation.count({ where: { tenantId: a } })).toBe(1);
  });

  it("rechaza desactivar Usuarios, activar un módulo planificado o una clave desconocida", async () => {
    await expect(setModuleEnabled({ tenantId: a, moduleKey: "users", enabled: false, actorUserId: null }, db)).rejects.toBeInstanceOf(ModuleActivationError);
    // Ya no queda ningún módulo planificado en el catálogo: se agrega uno temporal para probar la regla.
    const catalog = MODULE_CATALOG as ModuleDefinition[];
    const future = { key: "future_module", label: "Futuro", section: "sst", path: "future", clauses: [], status: "planned", defaultEnabled: false } as unknown as ModuleDefinition;
    catalog.push(future);
    try {
      await expect(setModuleEnabled({ tenantId: a, moduleKey: "future_module", enabled: true, actorUserId: null }, db)).rejects.toBeInstanceOf(ModuleActivationError);
    } finally {
      catalog.splice(catalog.indexOf(future), 1);
    }
    await expect(setModuleEnabled({ tenantId: a, moduleKey: "nope", enabled: true, actorUserId: null }, db)).rejects.toBeInstanceOf(ModuleActivationError);
  });
});
