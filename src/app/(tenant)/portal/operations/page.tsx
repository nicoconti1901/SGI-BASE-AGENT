import { redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";

export default async function PortalOperationsRedirectPage() {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");

  if (ctx.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { slug: true },
    });
    if (tenant) redirect(`/t/${tenant.slug}/operations`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
        Operaciones
      </h1>
      <p className="mt-3 text-[var(--color-ink-muted)]">
        Activá un tenant desde su portal (`/t/[slug]`) para gestionar NC y
        acciones correctivas.
      </p>
    </div>
  );
}
