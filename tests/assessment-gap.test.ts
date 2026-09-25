import { describe, expect, it } from "vitest";
import {
  decideDocumentFate,
  GAP_STATUS_LABELS,
  labelGapStatus,
  meetsRequirementStatus,
  resolveDocumentFateHint,
} from "@/domain/assessment/gap";

describe("decideDocumentFate", () => {
  it("keeps compliant client documents", () => {
    expect(
      decideDocumentFate({
        meetsRequirement: true,
        hasClientDocument: true,
      }),
    ).toBe("keep");
  });

  it("replaces non-compliant client documents", () => {
    expect(
      decideDocumentFate({
        meetsRequirement: false,
        hasClientDocument: true,
      }),
    ).toBe("replace");
  });

  it("creates when there is no client document", () => {
    expect(
      decideDocumentFate({
        meetsRequirement: false,
        hasClientDocument: false,
      }),
    ).toBe("create");
    expect(
      decideDocumentFate({
        meetsRequirement: true,
        hasClientDocument: false,
      }),
    ).toBe("create");
  });
});

describe("resolveDocumentFateHint", () => {
  it("leaves pending and N/A undecided", () => {
    expect(
      resolveDocumentFateHint({
        status: "pending",
        hasClientDocument: true,
      }),
    ).toBe("undecided");
    expect(
      resolveDocumentFateHint({
        status: "not_applicable",
        hasClientDocument: false,
      }),
    ).toBe("undecided");
  });

  it("maps compliant + document to keep", () => {
    expect(
      resolveDocumentFateHint({
        status: "compliant",
        hasClientDocument: true,
      }),
    ).toBe("keep");
  });

  it("maps missing + document to replace", () => {
    expect(
      resolveDocumentFateHint({
        status: "missing",
        hasClientDocument: true,
      }),
    ).toBe("replace");
  });

  it("maps partial without document to create", () => {
    expect(
      resolveDocumentFateHint({
        status: "partial",
        hasClientDocument: false,
      }),
    ).toBe("create");
  });
});

describe("gap status helpers", () => {
  it("treats compliant and automated as meeting the requirement", () => {
    expect(meetsRequirementStatus("compliant")).toBe(true);
    expect(meetsRequirementStatus("automated")).toBe(true);
    expect(meetsRequirementStatus("partial")).toBe(false);
    expect(meetsRequirementStatus("missing")).toBe(false);
  });

  it("exposes Spanish professional labels", () => {
    expect(GAP_STATUS_LABELS.missing).toBe("Faltante");
    expect(GAP_STATUS_LABELS.compliant).toBe("Conforme");
    expect(labelGapStatus("not_applicable")).toBe("No aplica");
  });
});
