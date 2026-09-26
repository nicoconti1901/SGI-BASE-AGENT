export const platformNavItems = [
  { href: "/platform", label: "Inicio" },
  { href: "/platform/tenants", label: "Tenants" },
  { href: "/platform/catalog", label: "Catálogo ISO" },
  { href: "/platform/automations", label: "Automatizaciones" },
] as const;

export const tenantNavItems = [
  { href: "/portal", label: "Panel" },
  { href: "/portal/documents", label: "Documentos" },
  { href: "/portal/operations", label: "Operaciones" },
  { href: "/portal/automations", label: "Automatizaciones" },
] as const;

export type ShellKind = "platform" | "tenant";

export function shellTitle(kind: ShellKind): string {
  return kind === "platform" ? "Plataforma" : "Portal del cliente";
}
