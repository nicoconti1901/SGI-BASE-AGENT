import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getScaffoldHealth } from "@/domain/health";

const root = path.resolve(__dirname, "..");

describe("scaffold layout", () => {
  it("exposes a healthy domain layer", () => {
    expect(getScaffoldHealth()).toEqual({ ok: true, layer: "domain" });
  });

  it("has SPEC directories from the project structure", () => {
    const required = [
      "src/app",
      "src/domain",
      "src/lib",
      "tests",
      "e2e",
      "prisma",
    ];

    for (const rel of required) {
      expect(existsSync(path.join(root, rel)), `missing ${rel}`).toBe(true);
    }
  });
});
