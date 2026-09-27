import { NoCompanyScreen } from "@/components/shell/NoCompanyScreen";
import { redirectToUserPortal } from "@/lib/portal-redirect";

export default async function PortalDocumentsPage() {
  await redirectToUserPortal("documents");
  return <NoCompanyScreen />;
}
