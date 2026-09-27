import { readdirSync, readFileSync } from "node:fs";
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
  it("exposes platform and tenant nav links for accessible shells", () => {
    expect(platformNavItems.length).toBeGreaterThan(0);
    expect(tenantNavItems("acme").map((i) => i.href)).toContain("/t/acme/risks");
    expect(shellTitle("platform")).toBe("Plataforma");
    expect(shellTitle("tenant")).toBe("Portal del cliente");
  });
});

describe("token usage", () => {
  it("only references design tokens that exist", () => {
    const tokens = readFileSync(path.resolve(__dirname, "../src/styles/tokens.css"), "utf8");
    const defined = new Set(tokens.match(/--[a-z0-9-]+(?=\s*:)/g) ?? []);
    const root = path.resolve(__dirname, "../src");
    const files = readdirSync(root, { recursive: true, encoding: "utf8" }).filter((f) =>
      /\.(tsx?|css)$/.test(f),
    );
    const missing = new Set<string>();
    for (const file of files) {
      const source = readFileSync(path.join(root, file), "utf8");
      for (const [, name] of source.matchAll(/var\((--(?:color|radius|shadow|duration|ease|space)-[a-z0-9-]+)/g)) {
        if (!defined.has(name)) missing.add(`${name} (${file})`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
