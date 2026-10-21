import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionBlock } from "@/components/ui";
import { listSites } from "@/lib/masterdata";
import { listTenantMemberOptions } from "@/lib/findings";
import { listSupplierCategories } from "@/lib/suppliers";
import { loadSupplierAccess } from "@/app/(tenant)/t/[slug]/suppliers/access";
import { SupplierForm } from "@/app/(tenant)/t/[slug]/suppliers/SupplierForm";

export default async function NewSupplierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { ctx, tenant, canManage } = await loadSupplierAccess(slug);
  if (!canManage) notFound();
  const [sites, members, categories] = await Promise.all([
    listSites(tenant.id),
    listTenantMemberOptions(tenant.id),
    listSupplierCategories(tenant.id),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link href={`/t/${slug}/suppliers`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a proveedores
        </Link>
      </p>
      <SectionBlock
        eyebrow="Proveedores · ISO 9001 §8.4"
        title="Nuevo proveedor"
        what="Quedará «sin evaluar» hasta que se lo evalúe. Nadie se aprueba por haberlo cargado."
      >
        <SupplierForm
          slug={slug}
          sites={sites.map((s) => ({ id: s.id, name: s.name }))}
          members={members.map((m) => ({ id: m.id, name: m.name }))}
          categories={categories}
          currentUserId={ctx.userId}
        />
      </SectionBlock>
    </div>
  );
}
