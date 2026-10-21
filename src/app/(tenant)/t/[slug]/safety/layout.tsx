import { requireModuleForSlug } from "@/lib/modules";

export default async function SafetyModuleLayout({ children, params }: LayoutProps<"/t/[slug]/safety">) {
  await requireModuleForSlug((await params).slug, "safety_stats");
  return children;
}
