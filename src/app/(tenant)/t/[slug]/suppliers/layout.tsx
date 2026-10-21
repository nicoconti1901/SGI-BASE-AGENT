import { notFound } from "next/navigation";
import { PageFrame } from "@/components/ui";
import { requireModuleForSlug } from "@/lib/modules";
import { ensureSupplierDefaults } from "@/lib/suppliers";
import { getTenantBySlug } from "@/lib/tenant-provisioning";

export default async function SuppliersLayout({ children, params }: LayoutProps<"/t/[slug]/suppliers">) {
  const { slug } = await params;
  await requireModuleForSlug(slug, "suppliers");
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  // Primera vez que la empresa entra: plantillas v1, documentos sugeridos y ajustes (idempotente).
  await ensureSupplierDefaults(tenant.id);
  return <PageFrame width="6xl">{children}</PageFrame>;
}
