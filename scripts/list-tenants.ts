import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      _count: { select: { memberships: true } },
    },
  });
  console.log(JSON.stringify(tenants, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
