import { describe, expect, it } from "vitest";
import { aggregateRowsToCsv, buildAggregateRows, casesToCsv, type CaseCsvRow } from "@/domain/safety-stats/export";
import { DEFAULT_SAFETY_SETTINGS } from "@/domain/safety-stats/types";
import { aggregateEvents, EVENTS, EXPOSURE, SITE_A, SITE_B } from "./safety-stats-dataset";

const sites = [
  { id: SITE_A, name: "Planta A" },
  { id: SITE_B, name: "Planta B" },
];
const months = ["2026-01", "2026-02", "2026-03"];
const { events, openCases } = aggregateEvents(EVENTS);
const rows = buildAggregateRows({ sites, months, exposure: EXPOSURE, events, openCases, settings: DEFAULT_SAFETY_SETTINGS });
const find = (site: string, month: string, kind: string) => rows.find((r) => r.siteId === site && r.month === month && r.employerKind === kind)!;

describe("buildAggregateRows", () => {
  it("una fila por sede, mes y grupo, con o sin exposición", () => {
    expect(rows).toHaveLength(2 * 3 * 2);
  });

  it("A propio en enero coincide con el dataset (IF 100, IG 1,5, II 18,18, ID 15)", () => {
    const r = find(SITE_A, "2026-01", "own");
    expect(r).toMatchObject({ status: "ok", hours: 20000, headcountAvg: 110, lostTime: 2, fatal: 0, lostDays: 30 });
    expect([r.if, r.ig, r.ii, r.id]).toEqual([100, 1.5, 18.18, 15]);
  });

  it("el fatal lleva el cargo en el IG y no entra en el ID", () => {
    const r = find(SITE_A, "2026-02", "own");
    expect(r).toMatchObject({ fatal: 1, lostTime: 0, noLostTime: 1 });
    expect(r.ig).toBe(333.33);
    expect(r.id).toBeNull();
  });

  it("el in itinere va en su columna y no suma a los casos laborales", () => {
    const r = find(SITE_A, "2026-02", "own");
    expect(r.inItinere).toBe(1);
    expect(r.lostTime).toBe(0);
  });

  it("sin fila de exposición: falta cargar, sin índices (nunca 0)", () => {
    const r = find(SITE_A, "2026-03", "contractor");
    expect(r).toMatchObject({ status: "missing", hours: null, headcountAvg: null });
    expect([r.if, r.ig, r.ii, r.id]).toEqual([null, null, null, null]);
  });

  it("0 horas con un accidente con baja: inconsistente; el caso se cuenta pero no hay índices", () => {
    const r = find(SITE_B, "2026-01", "contractor");
    expect(r).toMatchObject({ status: "inconsistent", hours: 0, lostTime: 1 });
    expect(r.if).toBeNull();
  });

  it("con horas y sin casos el IF es 0, no «sin datos»", () => {
    const r = find(SITE_A, "2026-03", "own");
    expect(r.if).toBe(0);
  });

  it("con la base del IG en 1.000.000 el IG de A propio en enero es 1.500", () => {
    const big = buildAggregateRows({ sites, months, exposure: EXPOSURE, events, openCases, settings: { ...DEFAULT_SAFETY_SETTINGS, severityBase: 1000000 } });
    expect(big.find((r) => r.siteId === SITE_A && r.month === "2026-01" && r.employerKind === "own")!.ig).toBe(1500);
  });

  it("un caso con baja sin reintegro marca el mes como provisorio", () => {
    const open = buildAggregateRows({
      sites,
      months,
      exposure: EXPOSURE,
      events,
      openCases: [{ siteId: SITE_A, employerKind: "own", month: "2026-01", count: 1 }],
      settings: DEFAULT_SAFETY_SETTINGS,
    });
    expect(open.find((r) => r.siteId === SITE_A && r.month === "2026-01" && r.employerKind === "own")!.provisional).toBe(true);
    expect(find(SITE_A, "2026-01", "own").provisional).toBe(false);
  });
});

describe("aggregateRowsToCsv", () => {
  const csv = aggregateRowsToCsv(rows, DEFAULT_SAFETY_SETTINGS);
  const lines = csv.replace(/^﻿/, "").trimEnd().split("\r\n");

  it("UTF-8 con BOM, «;» y coma decimal; la base va en la cabecera", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toContain("IF (casos con baja por 1.000.000 h)");
    expect(lines[0]).toContain("IG (días por 1.000 h)");
    expect(lines).toHaveLength(1 + rows.length);
    const a = lines.find((l) => l.startsWith("Planta A;2026-01;Personal propio"))!;
    expect(a).toContain(";100,00;1,50;18,18;15,0");
    expect(a).toContain(";Completo;");
  });

  it("sin datos sale vacío, no 0", () => {
    const line = lines.find((l) => l.startsWith("Planta A;2026-03;Contratista"))!;
    expect(line).toContain("Falta cargar las horas");
    expect(line).not.toMatch(/;0,00;/);
  });

  it("la cabecera cambia con la base del IG", () => {
    expect(aggregateRowsToCsv([], { ...DEFAULT_SAFETY_SETTINGS, severityBase: 1000000 })).toContain("IG (días por 1.000.000 h)");
  });
});

describe("casesToCsv", () => {
  const row: CaseCsvRow = {
    occurredAt: new Date("2026-03-02T15:30:00.000Z"),
    site: "Planta B",
    employerKind: "own",
    classification: "lost_time",
    inItinere: false,
    accidentForm: "fall_same_level",
    materialAgent: "floor_surface",
    person: "=Persona Peligrosa",
    employeeCode: "L-7",
    natureOfInjury: null,
    bodyPart: null,
    lostDays: 3,
    returnToWorkDate: "2026-03-06",
    artClaimNumber: null,
    findingStatus: "draft",
    findingTitle: "Caída en el depósito; piso mojado",
  };
  const csv = casesToCsv([row]);

  it("etiquetas en español, fecha y hora locales, y días", () => {
    const [head, line] = csv.replace(/^﻿/, "").trimEnd().split("\r\n");
    expect(head.split(";")[0]).toBe("Fecha y hora");
    expect(line).toContain("02/03/2026 12:30");
    expect(line).toContain("Con baja");
    expect(line).toContain("Personal propio");
    expect(line).toContain("06/03/2026");
    expect(line).toContain("Borrador");
  });

  it("neutraliza fórmulas y entrecomilla el separador", () => {
    expect(csv).toContain(";'=Persona Peligrosa;");
    expect(csv).toContain('"Caída en el depósito; piso mojado"');
  });

  it("sin ficha de salud deja las celdas vacías", () => {
    const [, line] = casesToCsv([{ ...row, person: null, employeeCode: null }]).trimEnd().split("\r\n");
    expect(line).toContain(";;;");
  });
});
