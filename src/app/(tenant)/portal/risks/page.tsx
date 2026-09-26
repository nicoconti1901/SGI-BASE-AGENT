import { redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";

export default async function PortalRisksRedirectPage() {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");

  if (ctx.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { slug: true },
    });
    if (tenant) redirect(`/t/${tenant.slug}/risks`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">
        Riesgos y oportunidades
      </h1>
      <p className="mt-3 text-[var(--color-ink-muted)]">
        Activá un tenant para abrir el workspace.
      </p>
    </div>
  );
}
