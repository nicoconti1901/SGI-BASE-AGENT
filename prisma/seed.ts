import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../src/lib/db";
import { assertUniqueClauseKeys } from "../src/domain/ims/catalog";
import { ESSENTIAL_CATALOG_SEED } from "../src/domain/ims/seed-data";

async function seedSuperuser() {
  const email = process.env.SEED_SUPERUSER_EMAIL ?? "admin@sgi.local";
  const password = process.env.SEED_SUPERUSER_PASSWORD ?? "CambiarYa!123";
  const name = process.env.SEED_SUPERUSER_NAME ?? "Superusuario SGI";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { platformRole: "platform_superuser", name },
    });
    console.log(`Superusuario ya existía; rol actualizado: ${email}`);
    return;
  }

  const userId = crypto.randomUUID();
  const hashed = await hashPassword(password);

  await prisma.user.create({
    data: {
      id: userId,
      name,
      email,
      emailVerified: true,
      platformRole: "platform_superuser",
      accounts: {
        create: {
          id: crypto.randomUUID(),
          accountId: userId,
          providerId: "credential",
          password: hashed,
        },
      },
    },
  });

  console.log(`Superusuario creado: ${email}`);
}

async function seedCatalog() {
  assertUniqueClauseKeys(ESSENTIAL_CATALOG_SEED);

  for (const requirement of ESSENTIAL_CATALOG_SEED) {
    await prisma.isoRequirement.upsert({
      where: { clauseKey: requirement.clauseKey },
      create: {
        standard: requirement.standard,
        clauseCode: requirement.clauseCode,
        clauseKey: requirement.clauseKey,
        title: requirement.title,
        summary: requirement.summary,
        essential: requirement.essential,
        tags: requirement.tags,
      },
      update: {
        title: requirement.title,
        summary: requirement.summary,
        essential: requirement.essential,
        tags: requirement.tags,
        clauseCode: requirement.clauseCode,
        standard: requirement.standard,
      },
    });
  }

  const keys = ESSENTIAL_CATALOG_SEED.map((r) => r.clauseKey);
  const removed = await prisma.isoRequirement.deleteMany({
    where: { clauseKey: { notIn: keys } },
  });

  const count = await prisma.isoRequirement.count();
  const essentials = await prisma.isoRequirement.count({
    where: { essential: true },
  });
  console.log(
    `Catálogo ISO: ${count} requisitos (${essentials} esenciales para primerizas)` +
      (removed.count ? `; eliminados obsoletos: ${removed.count}` : ""),
  );
}

async function seedAutomationOffers() {
  const { ensureNativeOffersSeeded } = await import("../src/lib/automation");
  await ensureNativeOffersSeeded();
  console.log("Ofertas de automatización nativas aseguradas");
}

async function main() {
  await seedSuperuser();
  await seedCatalog();
  await seedAutomationOffers();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
