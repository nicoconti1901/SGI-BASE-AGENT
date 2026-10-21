export type DigestItem = {
  id: string;
  tenantId: string;
  tenantName: string;
  title: string;
  kind: "upcoming" | "overdue";
  dueAt: Date;
  ownerUserId: string | null;
  siteName: string | null;
};

export type DigestMember = {
  tenantId: string;
  userId: string;
  email: string;
  role: string;
};

export type ReminderDigest = {
  userId: string;
  to: string;
  subject: string;
  body: string;
  itemIds: string[];
};

const NO_SITE = "Sin sede";

/** Cuántos vencimientos se listan por empresa en un mail; el resto se resume en una línea. */
export const MAX_LISTED_PER_TENANT = 10;

function formatDate(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getUTCFullYear()}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function counts(items: DigestItem[]): string {
  const overdue = items.filter((i) => i.kind === "overdue").length;
  const upcoming = items.length - overdue;
  const parts = [
    overdue > 0 ? plural(overdue, "vencido", "vencidos") : null,
    upcoming > 0 ? `${upcoming} por vencer` : null,
  ].filter(Boolean);
  return parts.join(" y ");
}

function byUrgency(a: DigestItem, b: DigestItem): number {
  if (a.kind !== b.kind) return a.kind === "overdue" ? -1 : 1;
  return a.dueAt.getTime() - b.dueAt.getTime();
}

function tenantSection(allItems: DigestItem[]): string {
  const urgent = [...allItems].sort(byUrgency);
  const items = urgent.slice(0, MAX_LISTED_PER_TENANT);
  const hidden = urgent.length - items.length;
  const sites = [...new Set(items.map((i) => i.siteName ?? NO_SITE))].sort((a, b) =>
    a === NO_SITE ? 1 : b === NO_SITE ? -1 : a.localeCompare(b, "es"),
  );
  const listed = sites
    .map((site) => {
      const lines = items
        .filter((i) => (i.siteName ?? NO_SITE) === site)
        .map((i) => `- ${i.kind === "overdue" ? "Vencido" : "Por vencer"} · ${formatDate(i.dueAt)} · ${i.title}`);
      return [site, ...lines].join("\n");
    })
    .join("\n\n");
  return hidden > 0 ? `${listed}\n\n… y ${hidden} más. Entrá al Panel para verlos todos.` : listed;
}

/**
 * Un mail por persona con todo lo que le toca en esta corrida: el responsable recibe sus
 * vencimientos y el tenant_admin todos los de su empresa, agrupados por sede.
 * Un responsable que ya no es miembro de la empresa no recibe nada.
 */
export function buildReminderDigests(items: DigestItem[], members: DigestMember[]): ReminderDigest[] {
  const perUser = new Map<string, { email: string; items: Map<string, DigestItem> }>();
  const add = (member: DigestMember, item: DigestItem) => {
    const entry = perUser.get(member.userId) ?? { email: member.email, items: new Map() };
    entry.items.set(item.id, item);
    perUser.set(member.userId, entry);
  };

  for (const item of items) {
    for (const member of members) {
      if (member.tenantId !== item.tenantId) continue;
      if (member.role === "tenant_admin" || member.userId === item.ownerUserId) add(member, item);
    }
  }

  return [...perUser.entries()].map(([userId, entry]) => {
    const mine = [...entry.items.values()];
    const tenants = [...new Map(mine.map((i) => [i.tenantId, i.tenantName])).entries()];
    const subject =
      tenants.length === 1
        ? `[SGI] ${tenants[0][1]}: ${counts(mine)}`
        : `[SGI] ${counts(mine)} en ${tenants.length} empresas`;
    const body = tenants
      .map(([tenantId, name]) => {
        const section = tenantSection(mine.filter((i) => i.tenantId === tenantId));
        return tenants.length === 1 ? section : `${name}\n\n${section}`;
      })
      .join("\n\n");
    return { userId, to: entry.email, subject, body, itemIds: mine.map((i) => i.id) };
  });
}
