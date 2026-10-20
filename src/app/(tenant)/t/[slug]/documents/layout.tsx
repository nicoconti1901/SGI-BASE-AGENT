import { requireModuleForSlug } from "@/lib/modules";

export default async function DocumentsModuleLayout({ children, params }: LayoutProps<"/t/[slug]/documents">) {
  await requireModuleForSlug((await params).slug, "documents");
  return children;
}
