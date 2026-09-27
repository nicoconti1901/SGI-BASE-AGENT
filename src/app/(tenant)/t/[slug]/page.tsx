import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getAppSessionContext } from "@/lib/session";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";

type Params = Promise<{ slug: string }>;

export default async function TenantPortalBySlugPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    notFound();
  }

  // El layout ya verificó el acceso; acá solo se decide qué ofrecer.
  const ctx = await getAppSessionContext();
  if (!ctx) {
    redirect("/login");
  }

  const membership = await getMembership(ctx.userId, tenant.id);
  const opts = { isPlatformSuperuser: ctx.isPlatformSuperuser };
  const canWrite = canTenantRole(membership?.role, "write", opts);
  const canInvite = canTenantRole(membership?.role, "invite_users", opts);
  const firstName = ctx.name.split(" ")[0] || ctx.name;

  const base = `/t/${slug}`;
  const modules = [
    {
      href: `${base}/findings`,
      title: "Hallazgos",
      body: canWrite ? "Registrá y seguí hallazgos y acciones." : "Consultá hallazgos y acciones.",
    },
    {
      href: `${base}/risks`,
      title: "Riesgos y oportunidades",
      body: canWrite ? "Detectá, evaluá y tratá riesgos." : "Consultá riesgos y su tratamiento.",
    },
    {
      href: `${base}/audits`,
      title: "Auditorías internas",
      body: "Programa del año, planes y resultados de auditoría.",
    },
    {
      href: `${base}/documents`,
      title: "Documentos",
      body: "Procedimientos y registros vigentes.",
    },
    {
      href: `${base}/automations`,
      title: "Automatizaciones",
      body: "Vencimientos y avisos programados.",
    },
    {
      href: `${base}/users`,
      title: "Usuarios",
      body: canInvite ? "Sumá personas y asigná roles." : "Quiénes forman parte de la empresa.",
    },
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Hola, {firstName}
        </h1>
        <p className="mt-2 text-[var(--color-ink-muted)]">
          {tenant.name} · {tenant._count.requirements} requisitos ISO en seguimiento
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5 shadow-[var(--shadow-soft)] transition duration-[var(--duration-med)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-[var(--color-accent)]"
          >
            <h2 className="font-[family-name:var(--font-display)] text-xl">{m.title}</h2>
            <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{m.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
