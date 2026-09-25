import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../src/lib/db";

async function main() {
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
  console.log("Usá /login con SEED_SUPERUSER_EMAIL / SEED_SUPERUSER_PASSWORD");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
