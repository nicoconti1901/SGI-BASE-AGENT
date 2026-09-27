import { NoCompanyScreen } from "@/components/shell/NoCompanyScreen";
import { redirectToUserPortal } from "@/lib/portal-redirect";

export default async function PortalRisksPage() {
  await redirectToUserPortal("risks");
  return <NoCompanyScreen />;
}
