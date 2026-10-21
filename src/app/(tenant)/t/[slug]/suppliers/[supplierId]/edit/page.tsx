import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionBlock } from "@/components/ui";
import { listSites } from "@/lib/masterdata";
import { listTenantMemberOptions } from "@/lib/findings";
import { getSupplier, listSupplierCategories } from "@/lib/suppliers";
import { loadSupplierAccess } from "@/app/(tenant)/t/[slug]/suppliers/access";
import { SupplierForm } from "@/app/(tenant)/t/[slug]/suppliers/SupplierForm";

export default async function EditSupplierPage({ params }: { params: Promise<{ slug: string; supplierId: string }> }) {
  const { slug, supplierId } = await params;
  const { ctx, tenant, canManage } = await loadSupplierAccess(slug);
  if (!canManage) notFound();
  const [supplier, sites, members, categories] = await Promise.all([
    getSupplier(tenant.id, supplierId),
    listSites(tenant.id),
    listTenantMemberOptions(tenant.id),
    listSupplierCategories(tenant.id),
  ]);
  if (!supplier) notFound();
  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link href={`/t/${slug}/suppliers/${supplier.id}`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a la ficha
        </Link>
      </p>
      <SectionBlock
        eyebrow="Proveedores · ISO 9001 §8.4"
        title={`Editar ${supplier.legalName}`}
        what="Cambiar el tipo o la criticidad recalcula los documentos que se le exigen y la fecha de reevaluación."
      >
        <SupplierForm
          slug={slug}
          currentUserId={ctx.userId}
          sites={sites.map((s) => ({ id: s.id, name: s.name }))}
          members={members.map((m) => ({ id: m.id, name: m.name }))}
          categories={categories}
          supplier={{
            id: supplier.id,
            legalName: supplier.legalName,
            tradeName: supplier.tradeName,
            taxId: supplier.taxId,
            type: supplier.type,
            category: supplier.category,
            criticality: supplier.criticality,
            criticalityReason: supplier.criticalityReason,
            ownerUserId: supplier.ownerUserId,
            contactName: supplier.contactName,
            contactEmail: supplier.contactEmail,
            contactPhone: supplier.contactPhone,
            notes: supplier.notes,
            siteIds: supplier.siteList.map((s) => s.id),
          }}
        />
      </SectionBlock>
    </div>
  );
}
