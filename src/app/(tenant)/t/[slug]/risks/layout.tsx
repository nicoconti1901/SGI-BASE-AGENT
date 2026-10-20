import { requireModuleForSlug } from "@/lib/modules";

export default async function RisksModuleLayout({ children, params }: LayoutProps<"/t/[slug]/risks">) {
  await requireModuleForSlug((await params).slug, "risks");
  return children;
}
