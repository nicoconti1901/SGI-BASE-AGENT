import { requireModuleForSlug } from "@/lib/modules";

export default async function AuditsModuleLayout({ children, params }: LayoutProps<"/t/[slug]/audits">) {
  await requireModuleForSlug((await params).slug, "audits");
  return children;
}
