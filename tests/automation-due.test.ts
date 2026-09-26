import { describe, expect, it } from "vitest";
import {
  classifyDueWindow,
  DUE_REMINDERS_OFFER_CODE,
  NATIVE_OFFER_CATALOG,
  shouldEmitReminder,
} from "@/domain/automation/due";

describe("classifyDueWindow", () => {
  const now = new Date("2026-09-26T12:00:00.000Z");

  it("marks overdue when dueAt is in the past", () => {
    expect(
      classifyDueWindow({
        dueAt: new Date("2026-09-20T12:00:00.000Z"),
        now,
        leadDays: 7,
      }),
    ).toBe("overdue");
  });

  it("marks upcoming within lead days", () => {
    expect(
      classifyDueWindow({
        dueAt: new Date("2026-09-30T12:00:00.000Z"),
        now,
        leadDays: 7,
      }),
    ).toBe("upcoming");
  });

  it("marks none when outside lead window", () => {
    expect(
      classifyDueWindow({
        dueAt: new Date("2026-10-20T12:00:00.000Z"),
        now,
        leadDays: 7,
      }),
    ).toBe("none");
  });
});

describe("shouldEmitReminder", () => {
  it("does not emit when classification is none", () => {
    expect(
      shouldEmitReminder({ classification: "none", lastReminderKind: null }),
    ).toBe(false);
  });

  it("emits upcoming once", () => {
    expect(
      shouldEmitReminder({
        classification: "upcoming",
        lastReminderKind: null,
      }),
    ).toBe(true);
    expect(
      shouldEmitReminder({
        classification: "upcoming",
        lastReminderKind: "upcoming",
      }),
    ).toBe(false);
  });

  it("emits overdue even after upcoming was sent", () => {
    expect(
      shouldEmitReminder({
        classification: "overdue",
        lastReminderKind: "upcoming",
      }),
    ).toBe(true);
    expect(
      shouldEmitReminder({
        classification: "overdue",
        lastReminderKind: "overdue",
      }),
    ).toBe(false);
  });
});

describe("native offer catalog", () => {
  it("includes due_reminders as the MVP engine offer", () => {
    expect(NATIVE_OFFER_CATALOG.some((o) => o.code === DUE_REMINDERS_OFFER_CODE)).toBe(
      true,
    );
  });
});
