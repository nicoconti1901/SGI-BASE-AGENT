import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { INPUT_CLASS } from "@/components/ui/input-class";

const root = path.resolve(__dirname, "..");
const uiDir = path.join(root, "src/components/ui");

const REQUIRED_P0 = [
  "PageFrame.tsx",
  "PageHeader.tsx",
  "StatTile.tsx",
  "StatusChip.tsx",
  "Field.tsx",
  "EmptyState.tsx",
  "input-class.ts",
  "index.ts",
] as const;

const REQUIRED_P1 = [
  "SectionBlock.tsx",
  "EntityList.tsx",
  "HintCallout.tsx",
  "FormError.tsx",
] as const;

describe("ui P0 primitives", () => {
  it("ships the expected files under components/ui", () => {
    for (const name of REQUIRED_P0) {
      expect(existsSync(path.join(uiDir, name)), `missing ${name}`).toBe(true);
    }
  });

  it("barrel re-exports the P0 surface", () => {
    const barrel = readFileSync(path.join(uiDir, "index.ts"), "utf8");
    for (const symbol of [
      "PageFrame",
      "PageHeader",
      "StatTile",
      "StatGrid",
      "StatusChip",
      "Field",
      "EmptyState",
      "INPUT_CLASS",
    ]) {
      expect(barrel).toContain(symbol);
    }
  });

  it("INPUT_CLASS only uses existing design tokens", () => {
    expect(INPUT_CLASS).toContain("var(--radius-md)");
    expect(INPUT_CLASS).toContain("var(--color-line)");
    expect(INPUT_CLASS).toContain("var(--color-surface)");
  });
});

describe("ui P1 primitives", () => {
  it("ships SectionBlock, EntityList, HintCallout, FormError", () => {
    for (const name of REQUIRED_P1) {
      expect(existsSync(path.join(uiDir, name)), `missing ${name}`).toBe(true);
    }
  });

  it("barrel re-exports the P1 surface", () => {
    const barrel = readFileSync(path.join(uiDir, "index.ts"), "utf8");
    for (const symbol of [
      "SectionBlock",
      "EntityList",
      "EntityRow",
      "HintCallout",
      "FormError",
    ]) {
      expect(barrel).toContain(symbol);
    }
  });

  it("P1 sources only reference existing design tokens", () => {
    const tokens = readFileSync(
      path.join(root, "src/styles/tokens.css"),
      "utf8",
    );
    const defined = new Set(tokens.match(/--[a-z0-9-]+(?=\s*:)/g) ?? []);
    const missing = new Set<string>();
    for (const name of REQUIRED_P1) {
      const source = readFileSync(path.join(uiDir, name), "utf8");
      for (const [, tok] of source.matchAll(
        /var\((--(?:color|radius|shadow|duration|ease|space)-[a-z0-9-]+)/g,
      )) {
        if (!defined.has(tok)) missing.add(`${tok} (${name})`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});

describe("risks adopts ui primitives", () => {
  const risksPage = path.join(
    root,
    "src/app/(tenant)/t/[slug]/risks/page.tsx",
  );
  const formFields = path.join(
    root,
    "src/app/(tenant)/t/[slug]/risks/FormFields.tsx",
  );

  it("workspace page imports shared page/list primitives", () => {
    const source = readFileSync(risksPage, "utf8");
    for (const symbol of [
      "PageFrame",
      "PageHeader",
      "StatGrid",
      "StatTile",
      "StatusChip",
      "EmptyState",
      "SectionBlock",
      "EntityList",
      "EntityRow",
    ]) {
      expect(source).toContain(symbol);
    }
    expect(source).not.toMatch(/function Stat\b/);
    expect(source).not.toMatch(/function WorkspaceLayer\b/);
  });

  it("FormFields uses ui Field, HintCallout, INPUT_CLASS (no local Field)", () => {
    const source = readFileSync(formFields, "utf8");
    expect(source).toMatch(/from ["']@\/components\/ui["']/);
    expect(source).toContain("HintCallout");
    expect(source).toContain("INPUT_CLASS");
    expect(source).not.toMatch(/export function Field\b/);
    expect(source).not.toMatch(/const inputClass\s*=/);
  });
});

describe("audits adopts ui primitives", () => {
  const auditsPage = path.join(
    root,
    "src/app/(tenant)/t/[slug]/audits/page.tsx",
  );

  it("list page imports shared page/list primitives", () => {
    const source = readFileSync(auditsPage, "utf8");
    for (const symbol of [
      "PageFrame",
      "PageHeader",
      "StatGrid",
      "StatTile",
      "StatusChip",
      "EmptyState",
      "SectionBlock",
      "EntityList",
      "EntityRow",
    ]) {
      expect(source).toContain(symbol);
    }
    expect(source).toMatch(/from ["']@\/components\/ui["']/);
    // Coverage uses simple StatTile (no progressbar / CoverageMeter).
    expect(source).not.toMatch(/role=["']progressbar["']/);
    expect(source).not.toContain("CoverageMeter");
  });
});

describe("indicators adopts ui primitives", () => {
  const indicatorsPage = path.join(
    root,
    "src/app/(tenant)/t/[slug]/indicators/page.tsx",
  );

  it("list page imports shared page/list primitives", () => {
    const source = readFileSync(indicatorsPage, "utf8");
    for (const symbol of [
      "PageFrame",
      "PageHeader",
      "StatTile",
      "StatusChip",
      "EmptyState",
      "SectionBlock",
      "EntityList",
      "EntityRow",
    ]) {
      expect(source).toContain(symbol);
    }
    expect(source).toMatch(/from ["']@\/components\/ui["']/);
  });
});

describe("tenant panel adopts ui primitives", () => {
  const panelPage = path.join(root, "src/app/(tenant)/t/[slug]/page.tsx");

  it("home page imports shared page/list primitives", () => {
    const source = readFileSync(panelPage, "utf8");
    for (const symbol of [
      "PageFrame",
      "PageHeader",
      "StatGrid",
      "StatTile",
      "StatusChip",
      "EmptyState",
      "SectionBlock",
    ]) {
      expect(source).toContain(symbol);
    }
    expect(source).toMatch(/from ["']@\/components\/ui["']/);
  });
});
describe("findings adopts ui primitives", () => {
  const findingsPage = path.join(
    root,
    "src/app/(tenant)/t/[slug]/findings/page.tsx",
  );

  it("list page imports shared page/list primitives", () => {
    const source = readFileSync(findingsPage, "utf8");
    for (const symbol of [
      "PageFrame",
      "PageHeader",
      "StatusChip",
      "EmptyState",
      "Field",
      "INPUT_CLASS",
    ]) {
      expect(source).toContain(symbol);
    }
    expect(source).toMatch(/from ["']@\/components\/ui["']/);
    expect(source).toContain('width="6xl"');
    expect(source).toMatch(/eyebrow=.*§10\.2/);
    expect(source).not.toMatch(/function StatusBadge\b/);
  });
});

describe("forms dedupe Field via ui primitives", () => {
  const forms = [
    "src/app/(tenant)/t/[slug]/indicators/ObjectiveForms.tsx",
    "src/app/(tenant)/t/[slug]/indicators/MeasurementForms.tsx",
    "src/app/(tenant)/t/[slug]/audits/AuditForms.tsx",
    "src/app/(tenant)/t/[slug]/audits/ExternalAuditForms.tsx",
    "src/app/(tenant)/t/[slug]/findings/LifecycleForms.tsx",
  ];

  it("no local Field / inputClass; imports Field + INPUT_CLASS from ui", () => {
    for (const rel of forms) {
      const source = readFileSync(path.join(root, rel), "utf8");
      expect(source, rel).toMatch(/from ["']@\/components\/ui["']/);
      expect(source, rel).toContain("Field");
      expect(source, rel).toContain("INPUT_CLASS");
      expect(source, rel).not.toMatch(/^(?:export\s+)?function Field\b/m);
      expect(source, rel).not.toMatch(/const input(?:Class)?\s*=/);
      expect(source, rel).not.toMatch(/className=\{input\}/);
    }
  });
});
