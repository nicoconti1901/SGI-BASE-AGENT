import "dotenv/config";
import { prisma } from "../src/lib/db";
import { recalculateFindingStatuses } from "../src/lib/finding-lifecycle";
import { deriveStatusFromMeasures } from "../src/domain/findings/lifecycle";

/**
 * Recalcula el estado de los hallazgos publicados / en curso según sus medidas
 * (Task 10d, migración única; idempotente). Con --dry-run solo muestra los cambios.
 */
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    const findings = await prisma.finding.findMany({
      where: { status: { in: ["published", "in_progress"] } },
      include: { measures: { select: { status: true, kind: true, createdAt: true } } },
    });
    for (const f of findings) {
      const to = deriveStatusFromMeasures(f);
      if (to !== f.status) console.log(`${f.title}: ${f.status} → ${to}`);
    }
    console.log(`Revisados ${findings.length} hallazgos (sin cambios aplicados).`);
    return;
  }
  const changes = await recalculateFindingStatuses();
  for (const c of changes) console.log(`${c.id}: ${c.from} → ${c.to}`);
  console.log(`Actualizados ${changes.length} hallazgos.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
