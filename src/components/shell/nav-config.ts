import type { Persona } from "@/domain/identity/persona";

export type NavItem = { href: string; label: string };

export const platformNavItems: readonly NavItem[] = [
  { href: "/platform", label: "Inicio" },
  { href: "/platform/tenants", label: "Empresas" },
  { href: "/platform/catalog", label: "Catálogo ISO" },
  { href: "/platform/automations", label: "Automatizaciones" },
];

/** Navegación de una empresa; los links llevan el slug, sin pasos intermedios. */
export function tenantNavItems(slug: string): NavItem[] {
  const base = `/t/${slug}`;
  return [
    { href: base, label: "Panel" },
    { href: `${base}/documents`, label: "Documentos" },
    { href: `${base}/findings`, label: "Hallazgos" },
    { href: `${base}/risks`, label: "Riesgos y oportunidades" },
    { href: `${base}/audits`, label: "Auditorías" },
    { href: `${base}/automations`, label: "Automatizaciones" },
    { href: `${base}/users`, label: "Usuarios" },
  ];
}

export type ShellKind = "platform" | "tenant";

export function shellTitle(kind: ShellKind): string {
  return kind === "platform" ? "Plataforma" : "Portal del cliente";
}

/** Clases por persona: rail, acento y fondo suave. */
export const PERSONA_THEME: Record<
  Persona,
  { rail: string; accent: string; soft: string }
> = {
  superuser: {
    rail: "bg-[var(--color-platform-rail)] text-[var(--color-platform-rail-ink)]",
    accent: "bg-[var(--color-persona-superuser)]",
    soft: "bg-[var(--color-persona-superuser-soft)] text-[var(--color-persona-superuser)]",
  },
  company_admin: {
    rail: "bg-[var(--color-tenant-rail)] text-[var(--color-tenant-rail-ink)]",
    accent: "bg-[var(--color-persona-admin)]",
    soft: "bg-[var(--color-persona-admin-soft)] text-[var(--color-persona-admin)]",
  },
  member: {
    rail: "bg-[var(--color-member-rail)] text-[var(--color-member-rail-ink)]",
    accent: "bg-[var(--color-persona-member)]",
    soft: "bg-[var(--color-persona-member-soft)] text-[var(--color-persona-member)]",
  },
};
