import { describe, expect, it } from "vitest";
import { dueColumns, dueDay, isPastDue, pastDueFilter } from "@/domain/due/day";
import { endOfDayInstant } from "@/domain/inspections/dates";

const day = (date: Date) => date.toISOString().slice(0, 10);

describe("día calendario de un vencimiento", () => {
  it.each([
    ["fecha sin hora (medianoche UTC) conserva su día", "2026-03-10T00:00:00.000Z", "2026-03-10"],
    ["fin del día en Argentina sigue siendo ese día", "2026-03-10T23:59:59.999-03:00", "2026-03-10"],
    ["mediodía UTC", "2026-03-10T12:00:00.000Z", "2026-03-10"],
    ["un instante de la madrugada UTC cae en el día anterior", "2027-01-01T01:00:00.000Z", "2026-12-31"],
    ["un milisegundo después de medianoche UTC ya es un instante", "2026-03-10T00:00:00.001Z", "2026-03-09"],
  ])("%s", (_name, instant, expected) => {
    expect(dueDay(new Date(instant))).toBe(expected);
  });

  it("calcula juntas las columnas de fecha, con la anticipación en días calendario", () => {
    const dueAt = new Date("2028-03-01T00:00:00.000Z");

    const columns = dueColumns(dueAt, 1);

    expect(columns).toMatchObject({ dueAt, leadDays: 1, remindAt: new Date("2028-02-29T00:00:00.000Z") });
    expect([day(columns.dueOn), day(columns.remindOn)]).toEqual(["2028-03-01", "2028-02-29"]);
  });

  it("una anticipación negativa cuenta como cero", () => {
    const columns = dueColumns(new Date("2026-03-10T00:00:00.000Z"), -5);

    expect(day(columns.remindOn)).toBe("2026-03-10");
  });
});

describe("vencido", () => {
  const now = new Date("2026-03-10T23:30:00-03:00");
  const cases = [
    ["fecha sin hora de hoy", "2026-03-10T00:00:00.000Z", false],
    ["fin del día de hoy", "2026-03-10T23:59:59.999-03:00", false],
    ["fecha sin hora de ayer", "2026-03-09T00:00:00.000Z", true],
    ["fin del día de ayer", "2026-03-09T23:59:59.999-03:00", true],
    ["mañana", "2026-03-11T00:00:00.000Z", false],
  ] as const;

  it.each(cases)("%s", (_name, dueAt, expected) => {
    expect(isPastDue(new Date(dueAt), now)).toBe(expected);
  });

  it("el filtro de la base aplica la misma regla", () => {
    for (const moment of [now, new Date("2026-03-10T00:00:00-03:00")]) {
      const { lt, not } = pastDueFilter(moment);
      for (const [name, dueAt] of cases) {
        const date = new Date(dueAt);
        expect(date < lt && date.getTime() !== not.getTime(), name).toBe(isPastDue(date, moment));
      }
    }
  });

  it("una fecha con año de tres cifras no rompe el cálculo", () => {
    const columns = dueColumns(endOfDayInstant("0225-05-05"), 7);

    expect([day(columns.dueOn), day(columns.remindOn)]).toEqual(["0225-05-05", "0225-04-28"]);
  });
});
