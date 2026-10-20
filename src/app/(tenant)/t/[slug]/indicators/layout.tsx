import { requireModuleForSlug } from "@/lib/modules";

export default async function IndicatorsModuleLayout({ children, params }: LayoutProps<"/t/[slug]/indicators">) {
  await requireModuleForSlug((await params).slug, "indicators");
  return children;
}
