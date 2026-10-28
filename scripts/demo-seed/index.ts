import "dotenv/config";
import { MemoryEmailSender, setEmailSenderForTests } from "../../src/lib/mail";
import { seedFoundation } from "./base";
import { seedFindingsModule, seedFindingsTenantB } from "./findings";
import { seedSafetyModule, seedSafetyTenantB } from "./safety";
import { seedSuppliersModule, seedSuppliersTenantB } from "./suppliers";
import { seedTrainingModule, seedTrainingTenantB } from "./training";
import { seedInstrumentsModule } from "./instruments";
import { seedInspectionsModule, seedInspectionsTenantB } from "./inspections";
import { runDueScan } from "../../src/lib/due-scan";
import { DEMO_DOMAIN, DEMO_PASSWORD, db, step, stepReport } from "./kit";

const SLUGS = ["demo-patagonia", "demo-sur"];

/** Borra solo las dos empresas de demo y sus usuarios @demo.sgi.test. Nada más. */
async function reset() {
  const tenants = await db.tenant.findMany({ where: { slug: { in: SLUGS } }, select: { id: true, slug: true } });
  const ids = tenants.map((t) => t.id);
  if (ids.length > 0) {
    await db.inAppNotification.deleteMany({ where: { tenantId: { in: ids } } });
    await db.dueItem.deleteMany({ where: { tenantId: { in: ids } } });
    await db.action.deleteMany({ where: { tenantId: { in: ids } } });
    await db.tenant.deleteMany({ where: { id: { in: ids } } });
  }
  const users = await db.user.deleteMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } } });
  console.log(`Reinicio: ${tenants.length} empresa(s) y ${users.count} usuario(s) de demo borrados`);
}

async function main() {
  const wantReset = process.argv.includes("--reset");
  const existing = await db.tenant.count({ where: { slug: { in: SLUGS } } });
  if (existing > 0 && !wantReset) {
    console.log("Las empresas de demo ya existen. Corré con --reset para borrarlas y volver a cargarlas.");
    return;
  }
  if (wantReset) await reset();

  // Ningún aviso sale por mail: el seed publica hallazgos y registra vencimientos.
  setEmailSenderForTests(new MemoryEmailSender());

  const { a, b } = await seedFoundation();
  if (!a || !b) throw new Error("No se pudo crear la base de las empresas de demo");

  const assetsA = await seedInspectionsModule(a);
  await seedInspectionsTenantB(b);
  await seedInstrumentsModule(a);
  await seedTrainingModule(a);
  await seedTrainingTenantB(b);
  await seedSuppliersModule(a);
  await seedSuppliersTenantB(b);
  await seedFindingsModule(a);
  await seedFindingsTenantB(b);
  await seedSafetyModule(a);
  await seedSafetyTenantB(b);
  void assetsA;

  // Genera los avisos de lo que ya venció o está por vencer, como lo haría el scan diario.
  await step("Scan de vencimientos y avisos", () => runDueScan());

  stepReport();
  console.log(`\nContraseña de todos los usuarios: ${DEMO_PASSWORD}`);
  for (const t of [a, b]) {
    console.log(`\n${t.name}  →  /t/${t.slug}`);
    for (const u of Object.values(t.users)) console.log(`  ${u.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
