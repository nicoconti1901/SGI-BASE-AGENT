import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { prisma } from "@/lib/db";
import { labelGapStatus, type RequirementStatus } from "@/domain/assessment/gap";

type Params = Promise<{ slug: string }>;

export default async function TenantDetailPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    notFound();
  }

  const requirements = await prisma.tenantRequirement.findMany({
    where: { tenantId: tenant.id },
    include: { requirement: true },
    orderBy: [
      { requirement: { standard: "asc" } },
      { requirement: { clauseCode: "asc" } },
    ],
    take: 40,
  });

  const essentialCount = requirements.filter(
    (row) => row.requirement.essential,
  ).length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
          Tenant
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight">
          {tenant.name}
        </h1>
        <p className="mt-2 text-[var(--color-ink-muted)]">
          Slug{" "}
          <code className="font-[family-name:var(--font-mono)] text-xs">
            {tenant.slug}
          </code>{" "}
          · {tenant.size} · {tenant.activity} ·{" "}
          {tenant._count.requirements} requisitos en plantilla (
          {essentialCount} esenciales en esta muestra)
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/platform/tenants/${tenant.slug}/gap`}
          className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
        >
          Cargar gap / assessment
        </Link>
        <Link
          href={`/platform/tenants/${tenant.slug}/documents`}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
        >
          Documentos
        </Link>
        <Link
          href={`/platform/tenants/${tenant.slug}/automations`}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
        >
          Automatizaciones
        </Link>
        <Link
          href={`/t/${tenant.slug}`}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
        >
          Abrir portal `/t/{tenant.slug}`
        </Link>
        <Link
          href="/platform/tenants"
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium"
        >
          Volver al listado
        </Link>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-subtle)]">
            <tr>
              <th className="px-4 py-3 font-medium">Norma</th>
              <th className="px-4 py-3 font-medium">Cláusula</th>
              <th className="px-4 py-3 font-medium">Título</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {requirements.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[var(--color-line)] last:border-b-0"
              >
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs">
                  {row.requirement.standard}
                </td>
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs">
                  {row.requirement.clauseCode}
                </td>
                <td className="px-4 py-3">{row.requirement.title}</td>
                <td className="px-4 py-3">
                  {row.requirement.essential ? "Esencial" : "Escalable"}
                </td>
                <td className="px-4 py-3">
                  {labelGapStatus(row.status as RequirementStatus)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tenant._count.requirements > requirements.length ? (
          <p className="border-t border-[var(--color-line)] px-4 py-3 text-xs text-[var(--color-ink-subtle)]">
            Mostrando {requirements.length} de {tenant._count.requirements}{" "}
            requisitos asignados.
          </p>
        ) : null}
      </div>
    </div>
  );
}
