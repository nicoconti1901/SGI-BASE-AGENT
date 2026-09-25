import { prisma } from "@/lib/db";
import {
  assertValidSlug,
  selectRequirementIdsForTemplate,
  slugifyTenantName,
  type TenantActivity,
  type TenantSize,
  TENANT_ACTIVITIES,
  TENANT_SIZES,
} from "@/domain/tenant/provisioning";

export type CreateTenantInput = {
  name: string;
  slug?: string;
  size: TenantSize;
  activity: TenantActivity;
};

function assertSize(value: string): asserts value is TenantSize {
  if (!TENANT_SIZES.includes(value as TenantSize)) {
    throw new Error("Tamaño de empresa inválido");
  }
}

function assertActivity(value: string): asserts value is TenantActivity {
  if (!TENANT_ACTIVITIES.includes(value as TenantActivity)) {
    throw new Error("Actividad inválida");
  }
}

export async function createTenantWithTemplate(input: CreateTenantInput) {
  const name = input.name.trim();
  if (name.length < 2) {
    throw new Error("El nombre debe tener al menos 2 caracteres");
  }

  assertSize(input.size);
  assertActivity(input.activity);

  const slug = (input.slug?.trim() || slugifyTenantName(name)).toLowerCase();
  assertValidSlug(slug);

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) {
    throw new Error(`Ya existe un tenant con slug "${slug}"`);
  }

  const catalog = await prisma.isoRequirement.findMany({
    select: { id: true, essential: true, tags: true },
  });
  if (catalog.length === 0) {
    throw new Error("Catálogo ISO vacío. Ejecutá npm run db:seed primero.");
  }

  const requirementIds = selectRequirementIdsForTemplate({
    size: input.size,
    activity: input.activity,
    catalog,
  });

  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug,
      size: input.size,
      activity: input.activity,
      requirements: {
        create: requirementIds.map((requirementId) => ({
          requirementId,
          status: "pending",
          source: "template",
        })),
      },
    },
    include: {
      _count: { select: { requirements: true } },
    },
  });

  return tenant;
}

export async function listTenants() {
  return prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { requirements: true } },
    },
  });
}

export async function getTenantBySlug(slug: string) {
  return prisma.tenant.findUnique({
    where: { slug },
    include: {
      _count: { select: { requirements: true } },
    },
  });
}
