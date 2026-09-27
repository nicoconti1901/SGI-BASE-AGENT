import { NoCompanyScreen } from "@/components/shell/NoCompanyScreen";
import { redirectToUserPortal } from "@/lib/portal-redirect";

export default async function PortalAutomationsPage() {
  await redirectToUserPortal("automations");
  return <NoCompanyScreen />;
}
