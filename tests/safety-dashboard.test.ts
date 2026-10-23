import { describe, expect, it } from "vitest";
import { aggregateWindow } from "@/domain/safety-stats/indices";
import {
  describeGaps,
  goalStatus,
  hourBlock,
  resolveWindow,
  segmentsFor,
} from "@/domain/safety-stats/dashboard";
import { DEFAULT_SAFETY_SETTINGS } from "@/domain/safety-stats/types";
import { aggregateEvents, EVENTS, EXPOSURE, SITE_A, SITE_B } from "./safety-stats-dataset";

describe("resolveWindow", () => {
  it("mes: el mes elegido y el anterior para la tendencia", () => {
    expect(resolveWindow("month", "2026-03")).toMatchObject({ months: ["2026-03"], previousMonths: ["2026-02"], label: "marzo 2026" });
    expect(resolveWindow("month", "2026-01").previousMonths).toEqual(["2025-12"]);
  });

  it("año acumulado: de enero al mes elegido, contra los mismos meses del año anterior", () => {
    const w = resolveWindow("ytd", "2026-03");
    expect(w.months).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(w.previousMonths).toEqual(["2025-01", "2025-02", "2025-03"]);
    expect(w.label).toBe("enero a marzo 2026");
  });

  it("12 meses móviles: los 12 que terminan en el mes elegido, contra los 12 anteriores", () => {
    const w = resolveWindow("rolling12", "2026-03");
    expect(w.months).toHaveLength(12);
    expect(w.months[0]).toBe("2025-04");
    expect(w.months[11]).toBe("2026-03");
    expect(w.previousMonths).toHaveLength(12);
    expect(w.previousMonths[0]).toBe("2024-04");
    expect(w.previousMonths[11]).toBe("2025-03");
    expect(w.label).toBe("abril 2025 a marzo 2026");
  });
});

describe("segmentsFor", () => {
  const sites = [{ id: "a" }, { id: "b" }];
  it("total = los dos grupos de cada sede; propio o contratista = uno solo", () => {
    expect(segmentsFor(sites, "total")).toHaveLength(4);
    expect(segmentsFor(sites, "own")).toEqual([
      { siteId: "a", employerKind: "own" },
      { siteId: "b", employerKind: "own" },
    ]);
    expect(segmentsFor(sites, "contractor").every((s) => s.employerKind === "contractor")).toBe(true);
  });
});

describe("describeGaps (qué falta para que el índice tenga datos)", () => {
  const names = new Map([
    [SITE_A, "Planta Norte"],
    [SITE_B, "Obra Sur"],
  ]);
  const run = (siteIds: string[], kinds: ("own" | "contractor")[], months: string[]) => {
    const { events, openCases } = aggregateEvents(EVENTS);
    return aggregateWindow({
      exposure: EXPOSURE,
      events,
      openCases,
      months,
      segments: siteIds.flatMap((siteId) => kinds.map((employerKind) => ({ siteId, employerKind }))),
      settings: DEFAULT_SAFETY_SETTINGS,
    });
  };

  it("fila ausente: dice qué mes, qué sede y qué grupo falta cargar", () => {
    const result = run([SITE_A], ["contractor"], ["2026-03"]);
    expect(result.status).toBe("no_data");
    expect(describeGaps(result, names)).toEqual(["Falta cargar las horas de marzo 2026 en Planta Norte (contratistas)."]);
  });

  it("horas en cero con accidentes: lo marca como inconsistente", () => {
    const result = run([SITE_B], ["contractor"], ["2026-01"]);
    expect(describeGaps(result, names)).toEqual([
      "Obra Sur (contratistas) tiene accidentes en enero 2026 pero 0 horas cargadas: revisá las horas de ese mes.",
    ]);
  });

  it("varios faltantes: muestra los primeros y cuenta el resto", () => {
    const result = run([SITE_A, SITE_B], ["own", "contractor"], ["2026-01", "2026-02", "2026-03"]);
    expect(result.monthsExcluded).toHaveLength(2);
    expect(describeGaps(result, names)).toHaveLength(2);
    const lines = describeGaps(result, names, 1);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("Y 1 más.");
  });

  it("ventana completa: nada que explicar", () => {
    const result = run([SITE_A], ["own"], ["2026-01", "2026-02", "2026-03"]);
    expect(describeGaps(result, names)).toEqual([]);
  });
});

describe("goalStatus (meta de un Indicador)", () => {
  it("menor es mejor: cumple si el valor no supera la meta", () => {
    expect(goalStatus(8, { target: 10, direction: "lower_better" })).toBe("met");
    expect(goalStatus(10, { target: 10, direction: "lower_better" })).toBe("met");
    expect(goalStatus(12, { target: 10, direction: "lower_better" })).toBe("off");
  });

  it("mayor es mejor y sin dato", () => {
    expect(goalStatus(95, { target: 90, direction: "higher_better" })).toBe("met");
    expect(goalStatus(80, { target: 90, direction: "higher_better" })).toBe("off");
    expect(goalStatus(null, { target: 90, direction: "higher_better" })).toBe("no_data");
  });
});

describe("hourBlock", () => {
  it("agrupa la hora del accidente en bloques de 4 horas", () => {
    expect(hourBlock(0)).toBe("00 a 03 h");
    expect(hourBlock(7)).toBe("04 a 07 h");
    expect(hourBlock(15)).toBe("12 a 15 h");
    expect(hourBlock(23)).toBe("20 a 23 h");
  });
});
