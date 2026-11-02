import { describe, expect, it } from "vitest";
import { attachmentLock, canRemoveAttachment, isAttachmentKind, type AttachmentActor } from "@/domain/attachments/removal";

const actor = (over: Partial<AttachmentActor> = {}): AttachmentActor => ({
  userId: "u1",
  canWrite: true,
  canManage: false,
  isPlatformSuperuser: false,
  ...over,
});

describe("who can remove an attachment", () => {
  it("lets the uploader remove their own file, not someone else's", () => {
    expect(canRemoveAttachment(actor(), "u1")).toBe(true);
    expect(canRemoveAttachment(actor(), "u2")).toBe(false);
    expect(canRemoveAttachment(actor(), null)).toBe(false);
  });

  it("lets managers and the superuser remove any file", () => {
    expect(canRemoveAttachment(actor({ canManage: true }), "u2")).toBe(true);
    expect(canRemoveAttachment(actor({ canWrite: false, canManage: false, isPlatformSuperuser: true }), "u2")).toBe(true);
  });

  it("does not let a read-only user remove even their own file", () => {
    expect(canRemoveAttachment(actor({ canWrite: false }), "u1")).toBe(false);
  });
});

describe("when the record locks its files", () => {
  it("locks evidence of a closed measure but not the open one", () => {
    expect(attachmentLock("measure_evidence", { measureStatus: "closed", status: "in_progress" })).toMatch(/respalda su cierre/);
    expect(attachmentLock("measure_evidence", { measureStatus: "open", status: "published" })).toBeNull();
  });

  it("locks files of closed or cancelled findings, completed actions and closed inspections", () => {
    expect(attachmentLock("finding_doc", { status: "closed" })).not.toBeNull();
    expect(attachmentLock("finding_doc", { status: "in_progress" })).toBeNull();
    expect(attachmentLock("action", { status: "completed" })).not.toBeNull();
    expect(attachmentLock("action", { status: "open" })).toBeNull();
    expect(attachmentLock("inspection", { status: "closed" })).not.toBeNull();
    expect(attachmentLock("inspection", { status: "draft" })).toBeNull();
  });

  it("locks anything attached to a voided record", () => {
    expect(attachmentLock("training", { voided: true })).not.toBeNull();
    expect(attachmentLock("training", {})).toBeNull();
  });

  it("knows its kinds", () => {
    expect(isAttachmentKind("action")).toBe(true);
    expect(isAttachmentKind("otro")).toBe(false);
  });
});
