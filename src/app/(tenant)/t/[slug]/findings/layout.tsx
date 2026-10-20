import { requireModuleForSlug } from "@/lib/modules";

export default async function FindingsModuleLayout({ children, params }: LayoutProps<"/t/[slug]/findings">) {
  await requireModuleForSlug((await params).slug, "findings");
  return children;
}
