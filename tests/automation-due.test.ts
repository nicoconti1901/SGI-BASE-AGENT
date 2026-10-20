import { describe, expect, it } from "vitest";
import {
  classifyDueWindow,
  DUE_REMINDERS_OFFER_CODE,
  NATIVE_OFFER_CATALOG,
  reminderStartsAt,
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

describe("reminderStartsAt", () => {
  const day = 24 * 60 * 60 * 1000;
  const now = new Date("2026-10-20T12:00:00.000Z");

  it("es dueAt menos leadDays días (leadDays negativo cuenta como 0)", () => {
    const dueAt = new Date("2026-10-30T12:00:00.000Z");
    expect(reminderStartsAt(dueAt, 7).toISOString()).toBe("2026-10-23T12:00:00.000Z");
    expect(reminderStartsAt(dueAt, -3).toISOString()).toBe(dueAt.toISOString());
  });

  it("coincide con classifyDueWindow: upcoming ⇔ remindAt ≤ ahora ≤ dueAt; overdue ⇔ dueAt < ahora", () => {
    for (const leadDays of [0, 1, 3, 7, 30]) {
      for (const offsetDays of [-10, -1, -0.5, 0, 0.5, 1, 2.9, 3, 3.1, 7, 29.9, 30, 30.1, 60]) {
        const dueAt = new Date(now.getTime() + offsetDays * day);
        const remindAt = reminderStartsAt(dueAt, leadDays);
        const kind = classifyDueWindow({ dueAt, now, leadDays });
        const overdue = dueAt < now;
        const upcoming = !overdue && remindAt <= now;
        expect(kind, `lead=${leadDays} offset=${offsetDays}`).toBe(
          overdue ? "overdue" : upcoming ? "upcoming" : "none",
        );
      }
    }
  });
});
