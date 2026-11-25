import { describe, expect, it } from "vitest";
import { dueColumns, dueDay } from "@/domain/due/day";

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
