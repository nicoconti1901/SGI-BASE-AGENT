import { describe, expect, it } from "vitest";
import { buildReminderDigests, type DigestItem, type DigestMember } from "@/domain/automation/digest";

const dueAt = (d: string) => new Date(`${d}T12:00:00.000Z`);

const items: DigestItem[] = [
  { id: "1", tenantId: "t1", tenantName: "Acme", title: "Carga del extintor E-01", kind: "overdue", dueAt: dueAt("2026-10-18"), ownerUserId: "owner", siteName: "Base Neuquén" },
  { id: "2", tenantId: "t1", tenantName: "Acme", title: "Medida: capacitar a soldadores", kind: "upcoming", dueAt: dueAt("2026-10-25"), ownerUserId: "owner", siteName: null },
  { id: "3", tenantId: "t1", tenantName: "Acme", title: "Vigencia del documento: Manual", kind: "upcoming", dueAt: dueAt("2026-10-24"), ownerUserId: null, siteName: "Base Neuquén" },
  { id: "4", tenantId: "t1", tenantName: "Acme", title: "Medida de alguien que ya no está", kind: "upcoming", dueAt: dueAt("2026-10-26"), ownerUserId: "ex-member", siteName: null },
];

const members: DigestMember[] = [
  { tenantId: "t1", userId: "admin", email: "admin@acme.test", role: "tenant_admin" },
  { tenantId: "t1", userId: "owner", email: "owner@acme.test", role: "contributor" },
  { tenantId: "t1", userId: "po", email: "po@acme.test", role: "process_owner" },
];

describe("buildReminderDigests", () => {
  it("manda un solo mail por persona: el responsable sus vencimientos, el admin todos", () => {
    const digests = buildReminderDigests(items, members);
    expect(digests.map((d) => d.to).sort()).toEqual(["admin@acme.test", "owner@acme.test"]);

    const owner = digests.find((d) => d.to === "owner@acme.test")!;
    expect(owner.itemIds).toEqual(["1", "2"]);

    const admin = digests.find((d) => d.to === "admin@acme.test")!;
    expect(admin.itemIds.sort()).toEqual(["1", "2", "3", "4"]);
  });

  it("no avisa a un responsable que ya no es miembro ni a quien no es admin ni responsable", () => {
    const recipients = buildReminderDigests(items, members).map((d) => d.userId);
    expect(recipients).not.toContain("ex-member");
    expect(recipients).not.toContain("po");
  });

  it("un admin que además es responsable recibe un solo mail", () => {
    const digests = buildReminderDigests(items, [
      { tenantId: "t1", userId: "owner", email: "owner@acme.test", role: "tenant_admin" },
    ]);
    expect(digests).toHaveLength(1);
    expect(digests[0].itemIds.sort()).toEqual(["1", "2", "3", "4"]);
  });

  it("agrupa por sede, pone primero los vencidos y resume en el asunto", () => {
    const admin = buildReminderDigests(items, members).find((d) => d.userId === "admin")!;
    expect(admin.subject).toBe("[SGI] Acme: 1 vencido y 3 por vencer");
    const neuquen = admin.body.indexOf("Base Neuquén");
    const sinSede = admin.body.indexOf("Sin sede");
    expect(neuquen).toBeGreaterThan(-1);
    expect(sinSede).toBeGreaterThan(neuquen);
    expect(admin.body.indexOf("Carga del extintor E-01")).toBeLessThan(admin.body.indexOf("Vigencia del documento"));
    expect(admin.body).toContain("Vencido · 18/10/2026 · Carga del extintor E-01");
  });

  it("sin vencimientos no hay mails", () => {
    expect(buildReminderDigests([], members)).toEqual([]);
  });
});
