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

  it("ships Light A and Dark A with the same token structure", () => {
    const darkStart = tokens.indexOf('[data-theme="dark"]');
    const lightStart = tokens.indexOf('[data-theme="light"]');
    expect(lightStart).toBeGreaterThan(-1);
    expect(darkStart).toBeGreaterThan(lightStart);
    const light = tokens.slice(lightStart, darkStart);
    const dark = tokens.slice(darkStart);
    const names = (block: string) => new Set(block.match(/--color-[a-z0-9-]+(?=s*:)/g) ?? []);
    // Todo color de Light A tiene par en Dark A, salvo los que no cambian entre temas.
    const sameInBothThemes = new Set(["--color-member-rail-ink", "--color-platform-rail-ink", "--color-tenant-rail-ink"]);
    const missingInDark = [...names(light)].filter((n) => !names(dark).has(n) && !sameInBothThemes.has(n));
    expect(missingInDark).toEqual([]);
    for (const token of [
      "--color-surface-sunken",
      "--color-field-fill",
      "--color-accent-ring",
      "--color-on-solid",
      "--color-info",
      "--color-pending",
      "--shadow-card",
    ]) {
      expect(light).toContain(token);
      expect(dark).toContain(token);
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
