import { describe, expect, it } from "vitest";
import {
  assertCanAddDocumentVersion,
  buildDocumentStorageKey,
  DocumentKeepProtectedError,
  isAllowedUploadContentType,
  nextVersionNumber,
} from "@/domain/documents/versioning";

describe("document versioning rules", () => {
  it("allows new versions when fate is not keep", () => {
    expect(() =>
      assertCanAddDocumentVersion({
        fate: "replace",
        forceOverwriteKeep: false,
        isPlatformSuperuser: false,
      }),
    ).not.toThrow();
  });

  it("blocks keep without explicit force", () => {
    expect(() =>
      assertCanAddDocumentVersion({
        fate: "keep",
        forceOverwriteKeep: false,
        isPlatformSuperuser: true,
      }),
    ).toThrow(DocumentKeepProtectedError);
  });

  it("allows keep only with force + platform superuser", () => {
    expect(() =>
      assertCanAddDocumentVersion({
        fate: "keep",
        forceOverwriteKeep: true,
        isPlatformSuperuser: true,
      }),
    ).not.toThrow();

    expect(() =>
      assertCanAddDocumentVersion({
        fate: "keep",
        forceOverwriteKeep: true,
        isPlatformSuperuser: false,
      }),
    ).toThrow(DocumentKeepProtectedError);
  });

  it("increments version numbers and builds storage keys", () => {
    expect(nextVersionNumber(0)).toBe(1);
    expect(nextVersionNumber(3)).toBe(4);
    expect(
      buildDocumentStorageKey({
        tenantId: "t1",
        documentId: "d1",
        versionNumber: 2,
        fileName: "Proc Calidad.pdf",
      }),
    ).toBe("tenants/t1/documents/d1/v2/Proc_Calidad.pdf");
  });

  it("accepts common office/pdf content types", () => {
    expect(isAllowedUploadContentType("application/pdf")).toBe(true);
    expect(isAllowedUploadContentType("application/zip")).toBe(false);
  });
});
