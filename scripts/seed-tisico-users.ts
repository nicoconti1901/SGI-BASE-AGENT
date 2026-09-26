import "dotenv/config";
import { inviteTenantMember } from "../src/lib/identity";
import { prisma } from "../src/lib/db";
import type { TenantRole } from "@prisma/client";

const USERS: Array<{
  name: string;
  email: string;
  role: TenantRole;
  password: string;
}> = [
  {
    name: "Ana Administración",
    email: "ana.admin@tisico.test",
    role: "tenant_admin",
    password: "Tisico123!",
  },
  {
    name: "Bruno Procesos",
    email: "bruno.procesos@tisico.test",
    role: "process_owner",
    password: "Tisico123!",
  },
  {
    name: "Carla Calidad",
    email: "carla.calidad@tisico.test",
    role: "contributor",
    password: "Tisico123!",
  },
  {
    name: "Diego Operaciones",
    email: "diego.ops@tisico.test",
    role: "contributor",
    password: "Tisico123!",
  },
  {
    name: "Elena Consulta",
    email: "elena.consulta@tisico.test",
    role: "viewer",
    password: "Tisico123!",
  },
  {
    name: "Facundo SST",
    email: "facundo.sst@tisico.test",
    role: "process_owner",
    password: "Tisico123!",
  },
];

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "tisico" } });
  if (!tenant) {
    throw new Error('No existe el tenant con slug "tisico"');
  }

  console.log(`Tenant: ${tenant.name} (${tenant.slug})`);

  for (const user of USERS) {
    const result = await inviteTenantMember({
      tenantId: tenant.id,
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
    });
    console.log(`OK ${user.role.padEnd(14)} ${user.email} → ${result.userId}`);
  }

  const members = await prisma.membership.findMany({
    where: { tenantId: tenant.id },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  console.log("\nMiembros Tisico:");
  for (const m of members) {
    console.log(`- ${m.user.name} <${m.user.email}> · ${m.role}`);
  }
  console.log("\nContraseña común de prueba: Tisico123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
