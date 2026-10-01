import { describe, expect, it } from "vitest";
import {
  parseCsv,
  parseDateCell,
  parseRoster,
  planRosterImport,
  normalizeKey,
} from "@/domain/masterdata/roster";
import { canTenantRole } from "@/domain/identity/authz";
import { canDeactivate, isValidDocumentId } from "@/domain/masterdata/rules";
import type { RosterPersonSnapshot } from "@/domain/masterdata/types";

const HEADER = "legajo,nombre,dni,sede,sedes_adicionales,puesto,empresa,contratista,ingreso,tareas";

const catalog = { site: ["Base Neuquén"], position: ["Operario"], task: ["Altura"] };

function snapshot(over: Partial<RosterPersonSnapshot> = {}): RosterPersonSnapshot {
  return {
    employeeCode: "100",
    name: "Ana Pérez",
    documentId: "30111222",
    employer: "own",
    contractorName: null,
    siteName: "Base Neuquén",
    extraSiteNames: [],
    positionName: "Operario",
    hiredAt: "2024-01-15",
    taskNames: ["Altura"],
    active: true,
    ...over,
  };
}

describe("parseCsv", () => {
  it("detecta ; como delimitador, respeta comillas y quita el BOM", () => {
    const rows = parseCsv('﻿legajo;nombre\r\n1;"Pérez; Ana"\r\n2;"Dijo ""hola"""');
    expect(rows).toEqual([
      ["legajo", "nombre"],
      ["1", "Pérez; Ana"],
      ["2", 'Dijo "hola"'],
    ]);
  });
});

describe("parseDateCell", () => {
  it("acepta ISO y DD/MM/AAAA y rechaza fechas imposibles", () => {
    expect(parseDateCell("2024-02-29")).toBe("2024-02-29");
    expect(parseDateCell("5/3/2023")).toBe("2023-03-05");
    expect(parseDateCell("31/02/2023")).toBeNull();
    expect(parseDateCell("ayer")).toBeNull();
  });
});

describe("parseRoster", () => {
  it("normaliza una fila válida con sedes y tareas múltiples", () => {
    const { rows, errors } = parseRoster(
      `${HEADER}\n100, Ana  Pérez ,30.111.222,Base Neuquén,Obrador 1|base neuquén|Obrador 2,Operario,,,15/01/2024,Altura|Izaje|altura`,
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      employeeCode: "100",
      name: "Ana Pérez",
      documentId: "30111222",
      employer: "own",
      extraSiteNames: ["Obrador 1", "Obrador 2"],
      hiredAt: "2024-01-15",
      taskNames: ["Altura", "Izaje"],
    });
  });

  it("informa errores por fila con su número de línea y sigue con las demás", () => {
    const { rows, errors } = parseRoster(
      [
        HEADER,
        "1,Ana,,Base,,Operario,,,,",
        ",Sin legajo,,Base,,Operario,,,,",
        "3,Luis,123,Base,,Operario,,,,",
        "4,Eva,,Base,,Operario,tercera,,,",
        "5,Raúl,,Base,,Operario,,,32/13/2020,",
        "1,Repetido,,Base,,Operario,,,,",
      ].join("\n"),
    );
    expect(rows.map((r) => r.line)).toEqual([2]);
    expect(errors.map((e) => `${e.line}:${e.field}`)).toEqual([
      "3:legajo",
      "4:dni",
      "5:empresa",
      "6:ingreso",
      "7:legajo",
    ]);
  });

  it("rechaza el archivo si faltan columnas obligatorias", () => {
    const { rows, errors } = parseRoster("legajo,nombre\n1,Ana");
    expect(rows).toEqual([]);
    expect(errors[0].message).toContain("sede");
  });

  it("mantiene el contratista solo si la empresa es contratista", () => {
    const { rows } = parseRoster(`${HEADER}\n9,Eva,,Base,,Operario,contratista,Acme SA,,`);
    expect(rows[0]).toMatchObject({ employer: "contractor", contractorName: "Acme SA" });
  });
});

describe("planRosterImport", () => {
  const parse = (line: string) => parseRoster(`${HEADER}\n${line}`).rows;

  it("crea las personas nuevas y lista lo que falta en el catálogo sin duplicar", () => {
    const rows = parseRoster(
      [
        HEADER,
        "1,Ana,,Obrador Sur,,Capataz,,,,Izaje",
        "2,Luis,,obrador sur,,capataz,,,,Izaje",
      ].join("\n"),
    ).rows;
    const plan = planRosterImport([], catalog, rows);
    expect(plan.counts).toEqual({ create: 2, update: 0, unchanged: 0, blocked: 0 });
    expect(plan.toCreate).toEqual({ site: ["Obrador Sur"], position: ["Capataz"], task: ["Izaje"] });
  });

  it("reimportar lo mismo no cambia nada (idempotente por legajo, sin importar mayúsculas)", () => {
    const rows = parse("100,Ana Pérez,30111222,base neuquén,,operario,,,2024-01-15,altura");
    const plan = planRosterImport([snapshot()], catalog, rows);
    expect(plan.counts.unchanged).toBe(1);
    expect(plan.toCreate).toEqual({ site: [], position: [], task: [] });
  });

  it("detecta los campos que cambian y no borra el ingreso si la celda viene vacía", () => {
    const rows = parse("100,Ana Pérez,30111222,Base Neuquén,,Capataz,,,,Altura|Izaje");
    const [item] = planRosterImport([snapshot()], catalog, rows).items;
    expect(item.action).toBe("update");
    expect(item.changes).toEqual(["puesto", "tareas"]);
  });

  it("bloquea a una persona dada de baja", () => {
    const rows = parse("100,Ana Pérez,,Base Neuquén,,Operario,,,,");
    const plan = planRosterImport([snapshot({ active: false })], catalog, rows);
    expect(plan.items[0].action).toBe("blocked");
    expect(plan.toCreate.site).toEqual([]);
  });

  it("importa 500 personas en una sola pasada y la segunda vez no crea ninguna", () => {
    const lines = Array.from({ length: 500 }, (_, i) => `${i + 1},Persona ${i + 1},,Base Neuquén,,Operario,,,,`);
    const { rows, errors } = parseRoster([HEADER, ...lines].join("\n"));
    expect(errors).toEqual([]);
    const first = planRosterImport([], catalog, rows);
    expect(first.counts.create).toBe(500);
    const existing = rows.map((r) => snapshot({ ...r, active: true }));
    expect(planRosterImport(existing, catalog, rows).counts).toEqual({
      create: 0,
      update: 0,
      unchanged: 500,
      blocked: 0,
    });
  });
});

describe("reglas", () => {
  it("bloquea la baja con dependientes y los nombra", () => {
    expect(canDeactivate("site", [])).toEqual({ allowed: true });
    const res = canDeactivate("site", ["A", "B", "C", "D", "E", "F", "G"]);
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.message).toContain("y 2 más");
  });

  it("valida el DNI opcional", () => {
    expect(isValidDocumentId(null)).toBe(true);
    expect(isValidDocumentId("30.111.222")).toBe(true);
    expect(isValidDocumentId("12")).toBe(false);
  });

  it("normalizeKey ignora tildes, mayúsculas y espacios", () => {
    expect(normalizeKey("  Base   NEUQUÉN ")).toBe("base neuquen");
  });
});

describe("permisos de datos maestros", () => {
  it("gestiona solo el admin; asignar tareas también el responsable de proceso", () => {
    expect(canTenantRole("tenant_admin", "manage_master_data")).toBe(true);
    expect(canTenantRole("process_owner", "manage_master_data")).toBe(false);
    expect(canTenantRole("process_owner", "assign_job_tasks")).toBe(true);
    expect(canTenantRole("contributor", "assign_job_tasks")).toBe(false);
    expect(canTenantRole("viewer", "manage_master_data")).toBe(false);
  });
});
