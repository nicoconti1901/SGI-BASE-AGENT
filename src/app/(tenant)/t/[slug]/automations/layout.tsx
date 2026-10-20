import { requireModuleForSlug } from "@/lib/modules";

export default async function AutomationsModuleLayout({ children, params }: LayoutProps<"/t/[slug]/automations">) {
  await requireModuleForSlug((await params).slug, "automations");
  return children;
}
