import { describe, expect, it } from "vitest";
import { ORBIT_RADIUS, orbitPoints } from "@/components/hub/orbit";

describe("orbitPoints", () => {
  it("pone el primer módulo arriba y sigue en sentido horario", () => {
    const [top, right, bottom, left] = orbitPoints(4);
    expect(top.x).toBeCloseTo(50);
    expect(top.y).toBeCloseTo(50 - ORBIT_RADIUS);
    expect(right.x).toBeCloseTo(50 + ORBIT_RADIUS);
    expect(bottom.y).toBeCloseTo(50 + ORBIT_RADIUS);
    expect(left.x).toBeCloseTo(50 - ORBIT_RADIUS);
  });

  it("reparte los módulos a la misma distancia del núcleo", () => {
    for (const p of orbitPoints(3)) {
      expect(Math.hypot(p.x - 50, p.y - 50)).toBeCloseTo(ORBIT_RADIUS);
    }
  });

  it("devuelve un punto por módulo y ninguno para un área vacía", () => {
    expect(orbitPoints(2)).toHaveLength(2);
    expect(orbitPoints(0)).toEqual([]);
  });
});
