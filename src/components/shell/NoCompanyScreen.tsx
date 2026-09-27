import { StatusScreen } from "@/components/shell/StatusScreen";

export function NoCompanyScreen() {
  return (
    <StatusScreen
      title="Todavía no tenés una empresa asignada"
      body="Pedile al administrador de tu empresa que te agregue como usuario."
    />
  );
}
