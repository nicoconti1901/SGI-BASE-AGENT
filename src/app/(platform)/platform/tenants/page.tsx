import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listTenants } from "@/lib/tenant-provisioning";
import { CreateTenantForm } from "@/app/(platform)/platform/tenants/CreateTenantForm";

export default async function PlatformTenantsPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const tenants = await listTenants();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Tenants
        </h1>
        <p className="mt-2 text-[var(--color-ink-muted)]">
          Alta de empresas y aplicación automática de plantilla ISO. URL path-based:{" "}
          <code className="font-[family-name:var(--font-mono)] text-xs">
            /t/[slug]
          </code>
          .
        </p>
      </div>

      <CreateTenantForm />

      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Empresas provisionadas
        </h2>
        {tenants.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Todavía no hay tenants. Creá el primero con el formulario.
          </p>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-subtle)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Perfil</th>
                  <th className="px-4 py-3 font-medium">Requisitos</th>
                  <th className="px-4 py-3 font-medium">Portal</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="border-b border-[var(--color-line)] last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/platform/tenants/${tenant.slug}`}
                        className="font-medium text-[var(--color-accent)] hover:underline"
                      >
                        {tenant.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs">
                      {tenant.slug}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-ink-muted)]">
                      {tenant.size} · {tenant.activity}
                    </td>
                    <td className="px-4 py-3">{tenant._count.requirements}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/t/${tenant.slug}`}
                        className="text-[var(--color-accent)] hover:underline"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
