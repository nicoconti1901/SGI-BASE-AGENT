import "dotenv/config";
import { prisma } from "../src/lib/db";
import { runDueScan } from "../src/lib/due-scan";

async function main() {
  const tenantSlug = process.argv[2];
  let tenantId: string | undefined;
  if (tenantSlug) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant) {
      throw new Error(`Tenant no encontrado: ${tenantSlug}`);
    }
    tenantId = tenant.id;
  }

  const result = await runDueScan({ tenantId });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
