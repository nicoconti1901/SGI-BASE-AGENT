import { describe, expect, it } from "vitest";
import { nextPositionSince, withAssignmentDates } from "@/domain/masterdata/assignments";

const day = (d: string) => new Date(`${d}T12:00:00.000Z`);

describe("nextPositionSince", () => {
  const now = day("2026-10-21");

  it("conserva la fecha si el puesto no cambia, incluso si era nula (desde el ingreso)", () => {
    expect(nextPositionSince({ positionId: "p1", positionSince: day("2026-03-01") }, "p1", now)).toEqual(day("2026-03-01"));
    expect(nextPositionSince({ positionId: "p1", positionSince: null }, "p1", now)).toBeNull();
  });

  it("al cambiar de puesto la fecha pasa a ser hoy", () => {
    expect(nextPositionSince({ positionId: "p1", positionSince: day("2026-03-01") }, "p2", now)).toEqual(now);
    expect(nextPositionSince({ positionId: "p1", positionSince: null }, "p2", now)).toEqual(now);
  });
});

describe("withAssignmentDates", () => {
  const now = day("2026-10-21");

  it("las tareas que siguen asignadas conservan su fecha y las nuevas llevan la de hoy", () => {
    const rows = withAssignmentDates(
      [{ jobTaskId: "altura" }, { jobTaskId: "izaje" }],
      [{ jobTaskId: "altura", assignedAt: day("2026-01-10") }, { jobTaskId: "conduccion", assignedAt: day("2026-02-01") }],
      now,
    );
    expect(rows).toEqual([
      { jobTaskId: "altura", assignedAt: day("2026-01-10") },
      { jobTaskId: "izaje", assignedAt: now },
    ]);
  });

  it("quitar una tarea y volver a asignarla más tarde reinicia su fecha", () => {
    expect(withAssignmentDates([{ jobTaskId: "altura" }], [], now)).toEqual([{ jobTaskId: "altura", assignedAt: now }]);
  });

  it("conserva los demás campos de cada fila", () => {
    expect(withAssignmentDates([{ jobTaskId: "altura", personId: "p", tenantId: "t" }], [{ jobTaskId: "altura", assignedAt: day("2026-01-10") }], now)).toEqual([
      { jobTaskId: "altura", personId: "p", tenantId: "t", assignedAt: day("2026-01-10") },
    ]);
  });
});
