import { describe, expect, it } from "vitest";
import {
  exposureDueDay,
  exposureMonthsToTrack,
  parseExposureCsv,
  planExposureImport,
  shiftMonth,
  type ExistingExposure,
} from "@/domain/safety-stats/exposure-import";

const header = "sede;mes;empresa;horas;dotacion";
const csv = (...rows: string[]) => [header, ...rows].join("\n");

describe("shiftMonth / exposureDueDay / exposureMonthsToTrack", () => {
  it("mueve meses cruzando el año", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-11", 3)).toBe("2027-02");
    expect(shiftMonth("2026-05", 0)).toBe("2026-05");
  });

  it("la exposición de un mes vence el día configurado del mes siguiente (D17)", () => {
    expect(exposureDueDay("2026-03", 10)).toBe("2026-04-10");
    expect(exposureDueDay("2026-12", 10)).toBe("2027-01-10");
    expect(exposureDueDay("2026-02", 28)).toBe("2026-03-28");
  });

  it("controla los últimos tres meses, el actual incluido", () => {
    expect(exposureMonthsToTrack("2026-10-23")).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(exposureMonthsToTrack("2027-01-02")).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});

describe("parseExposureCsv", () => {
  const opts = { currentMonth: "2026-10" };

  it("lee filas válidas con separador ; o , y acepta mes AAAA-MM, MM/AAAA o una fecha", () => {
    const { rows, errors } = parseExposureCsv(
      csv("Planta Norte;2026-03;propio;20000;110", "Planta Norte;03/2026;Contratista;5000;28,5", "Obra Sur;15/03/2026;personal propio;10000;55"),
      opts,
    );
    expect(errors).toEqual([]);
    expect(rows.map((r) => [r.siteRef, r.month, r.employerKind, r.hours, r.headcountAvg])).toEqual([
      ["Planta Norte", "2026-03", "own", 20000, 110],
      ["Planta Norte", "2026-03", "contractor", 5000, 28.5],
      ["Obra Sur", "2026-03", "own", 10000, 55],
    ]);
  });

  it("exige las columnas del encabezado", () => {
    const { rows, errors } = parseExposureCsv("sede;mes;horas\nA;2026-03;10", opts);
    expect(rows).toEqual([]);
    expect(errors[0]).toMatchObject({ line: 1, field: "encabezado" });
    expect(errors[0].message).toContain("empresa");
    expect(errors[0].message).toContain("dotacion");
  });

  it("informa cada error con su línea y no frena el resto", () => {
    const { rows, errors } = parseExposureCsv(
      csv(
        "A;2026-03;propio;20000;110",
        "A;2026-13;propio;1;1",
        "A;2026-03;otros;1;1",
        "A;2026-03;contratista;-5;1",
        "A;2026-03;contratista;100;abc",
        ";2026-03;propio;1;1",
        "A;2027-01;propio;100;1",
      ),
      opts,
    );
    expect(rows).toHaveLength(1);
    expect(errors.map((e) => [e.line, e.field])).toEqual([
      [3, "mes"],
      [4, "empresa"],
      [5, "horas"],
      [6, "dotacion"],
      [7, "sede"],
      [8, "mes"],
    ]);
    expect(errors.find((e) => e.line === 8)?.message).toMatch(/futuro/);
  });

  it("rechaza horas imposibles para la dotación (más de 744 por persona)", () => {
    const { rows, errors } = parseExposureCsv(csv("A;2026-03;propio;10000;5"), opts);
    expect(rows).toEqual([]);
    expect(errors[0]).toMatchObject({ line: 2, field: "horas" });
  });

  it("avisa, sin rechazar, cuando las horas por persona son raras", () => {
    const { rows, errors } = parseExposureCsv(csv("A;2026-03;propio;300;10"), opts);
    expect(errors).toEqual([]);
    expect(rows[0].warnings[0]).toMatch(/poco/);
  });

  it("0 horas y 0 dotación es «sin actividad» y es válido", () => {
    const { rows, errors } = parseExposureCsv(csv("B;2026-01;contratista;0;0"), opts);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ hours: 0, headcountAvg: 0 });
  });

  it("detecta una sede, mes y grupo repetidos en el archivo", () => {
    const { rows, errors } = parseExposureCsv(csv("A;2026-03;propio;100;1", "a;2026-03;PROPIO;200;2"), opts);
    expect(rows).toHaveLength(1);
    expect(errors[0]).toMatchObject({ line: 3, field: "fila" });
  });

  it("un archivo vacío es un error, no un silencio", () => {
    expect(parseExposureCsv("", opts).errors[0].field).toBe("archivo");
  });
});

describe("planExposureImport", () => {
  const sites = [
    { id: "s1", name: "Planta Norte" },
    { id: "s2", name: "Obra Sur" },
  ];
  const parse = (...rows: string[]) => parseExposureCsv(csv(...rows), { currentMonth: "2026-10" }).rows;

  it("crea lo nuevo, deja igual lo idéntico y actualiza lo que cambió", () => {
    const existing: ExistingExposure[] = [
      { siteId: "s1", month: "2026-03", employerKind: "own", hours: 20000, headcountAvg: 110 },
      { siteId: "s2", month: "2026-03", employerKind: "own", hours: 10000, headcountAvg: 55 },
    ];
    const plan = planExposureImport(
      existing,
      sites,
      parse("planta norte;2026-03;propio;20000;110", "Obra Sur;2026-03;propio;10500;55", "Obra Sur;2026-03;contratista;3000;15"),
    );
    expect(plan.items.map((i) => i.action)).toEqual(["unchanged", "update", "create"]);
    expect(plan.counts).toEqual({ create: 1, update: 1, unchanged: 1, error: 0 });
    expect(plan.items[1]).toMatchObject({ siteId: "s2", previous: { hours: 10000, headcountAvg: 55 } });
  });

  it("una sede inexistente es un error por fila: no se crea", () => {
    const plan = planExposureImport([], sites, parse("Sede fantasma;2026-03;propio;100;1"));
    expect(plan.items[0]).toMatchObject({ action: "error", line: 2 });
    expect(plan.items[0].message).toContain("Sede fantasma");
    expect(plan.counts.error).toBe(1);
  });

  it("reimportar el mismo archivo no cambia nada", () => {
    const rows = parse("Planta Norte;2026-03;propio;20000;110", "Obra Sur;2026-03;contratista;0;0");
    const first = planExposureImport([], sites, rows);
    expect(first.counts.create).toBe(2);
    const existing: ExistingExposure[] = first.items.map((i) => ({
      siteId: i.siteId!,
      month: i.row!.month,
      employerKind: i.row!.employerKind,
      hours: i.row!.hours,
      headcountAvg: i.row!.headcountAvg,
    }));
    const second = planExposureImport(existing, sites, rows);
    expect(second.counts).toEqual({ create: 0, update: 0, unchanged: 2, error: 0 });
  });
});
