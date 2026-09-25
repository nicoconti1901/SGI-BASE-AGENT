import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  platformNavItems,
  shellTitle,
  tenantNavItems,
} from "@/components/shell/nav-config";

describe("design tokens", () => {
  const tokens = readFileSync(
    path.resolve(__dirname, "../src/styles/tokens.css"),
    "utf8",
  );

  it("defines the precision-ledger palette", () => {
    for (const token of [
      "--color-canvas",
      "--color-ink",
      "--color-accent",
      "--color-platform-rail",
      "--color-tenant-rail",
      "--font-display",
      "--font-sans",
    ]) {
      expect(tokens).toContain(token);
    }
  });

  it("does not lean on generic purple SaaS accent", () => {
    expect(tokens.toLowerCase()).not.toMatch(/#7c3aed|#8b5cf6|#a855f7/);
  });
});

describe("shell navigation landmarks", () => {
  it("exposes platform and tenant nav labels for accessible shells", () => {
    expect(platformNavItems.length).toBeGreaterThan(0);
    expect(tenantNavItems.length).toBeGreaterThan(0);
    expect(shellTitle("platform")).toBe("Plataforma");
    expect(shellTitle("tenant")).toBe("Portal del cliente");
  });
});
