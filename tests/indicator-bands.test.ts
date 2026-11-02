import { describe, expect, it } from "vitest";
import { statusBands, suggestAlertThreshold } from "@/domain/indicators/bands";
import { indicatorDefinitionIssues, measurementStatus } from "@/domain/indicators/rules";

describe("indicator bands", () => {
  it("suggests a threshold the validation accepts, on the good side of the target", () => {
    for (const direction of ["higher_better", "lower_better"] as const) {
      for (const target of [95, 2, 0, -3]) {
        const alertThreshold = suggestAlertThreshold(direction, target);
        expect(
          indicatorDefinitionIssues({ name: "Indicador", unit: "%", direction, target, alertThreshold }),
        ).toEqual([]);
      }
    }
  });

  it("describes the traffic light consistently with measurementStatus", () => {
    const def = { direction: "higher_better" as const, target: 95, alertThreshold: 97, unit: "%" };
    expect(statusBands(def).map((b) => b.status)).toEqual(["on_target", "alert", "off_target"]);
    expect(statusBands(def)[1]!.text).toBe("desde 95 % hasta menos de 97 %");
    expect(measurementStatus(def, 96)).toBe("alert");
    expect(statusBands({ direction: "lower_better", target: 2, alertThreshold: null, unit: "casos" })).toEqual([
      { status: "on_target", text: "2 casos o menos" },
      { status: "off_target", text: "más de 2 casos" },
    ]);
  });
});
