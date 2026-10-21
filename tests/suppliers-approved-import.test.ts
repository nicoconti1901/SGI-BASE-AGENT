import { describe, expect, it } from "vitest";
import { approvedListToCsv, buildApprovedList, type ApprovedListSupplier } from "@/domain/suppliers/approved-list";
import { parseSupplierCsv, planSupplierImport, SUPPLIER_CSV_TEMPLATE } from "@/domain/suppliers/import";
import { isValidCuit } from "@/domain/suppliers/cuit";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const now = d("2026-10-21");

const sup = (over: Partial<ApprovedListSupplier>): ApprovedListSupplier => ({
  id: "x",
  legalName: "Proveedor",
  taxId: "20123456786",
  type: "service",
  category: "Mantenimiento",
  criticality: "standard",
  status: "approved",
  lastScore: 90,
  nextEvaluationDueAt: d("2028-10-21"),
  missingBlockingDocs: 0,
  blockingDocExpiresAt: null,
  ...over,
});

describe("buildApprovedList", () => {
  it("incluye aprobados y condicionales habilitados, ordenados por razón social, y cuenta aparte los excluidos por documentación", () => {
    const list = buildApprovedList(
      [
        sup({ id: "1", legalName: "Zeta SA" }),
        sup({ id: "2", legalName: "Álamo SRL", status: "conditional" }),
        sup({ id: "3", legalName: "Beta SA", missingBlockingDocs: 1 }), // falta ART
        sup({ id: "4", legalName: "Gamma SA", blockingDocExpiresAt: d("2026-10-20") }), // ART vencida
        sup({ id: "5", legalName: "Delta SA", status: "not_approved" }),
        sup({ id: "6", legalName: "Épsilon SA", status: "potential" }),
        sup({ id: "7", legalName: "Eta SA", status: "inactive" }),
        sup({ id: "8", legalName: "Iota SA", blockingDocExpiresAt: d("2026-10-21") }), // vence hoy: todavía válido
      ],
      now,
    );
    expect(list.entries.map((e) => e.id)).toEqual(["2", "8", "1"]);
    expect(list.excludedForDocs).toBe(2);
    expect(list.generatedAt).toEqual(now);
    expect(list.entries[0]).toMatchObject({ withConditions: true });
    expect(list.entries[2]).toMatchObject({ withConditions: false });
  });

  it("un contratista con ART vencida no figura aunque tenga 95 puntos; con ART vigente vuelve a figurar", () => {
    const vencida = buildApprovedList([sup({ type: "contractor", lastScore: 95, blockingDocExpiresAt: d("2026-09-30") })], now);
    expect(vencida.entries).toHaveLength(0);
    const vigente = buildApprovedList([sup({ type: "contractor", lastScore: 95, blockingDocExpiresAt: d("2027-09-30") })], now);
    expect(vigente.entries).toHaveLength(1);
  });
});

describe("approvedListToCsv", () => {
  it("UTF-8 con BOM, fecha, quién la generó, columnas y pie con los que no figuran", () => {
    const list = buildApprovedList([sup({ legalName: 'Ferretería "El Clavo"; SA', status: "conditional", criticality: "critical" })], now);
    const csv = approvedListToCsv(list, { tenantName: "Acme", generatedBy: "Ana Pérez", generatedAt: new Date("2026-10-21T15:30:00Z") });
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Lista de aprobados");
    expect(csv).toContain("Acme");
    expect(csv).toContain("21/10/2026 12:30");
    expect(csv).toContain("Ana Pérez");
    expect(csv).toContain("Razón social;CUIT;Tipo;Rubro;Criticidad;Estado;Próxima reevaluación");
    expect(csv).toContain('"Ferretería ""El Clavo""; SA";20-12345678-6;Servicio;Mantenimiento;Crítico;Con condiciones;21/10/2028');
    expect(csv).toContain("0 no figuran por documentación vencida o faltante");
  });

  it("neutraliza fórmulas de planilla en los textos", () => {
    const list = buildApprovedList([sup({ legalName: "=HYPERLINK(1)" })], now);
    const csv = approvedListToCsv(list, { tenantName: "Acme", generatedBy: "Ana", generatedAt: now });
    expect(csv).toContain("'=HYPERLINK(1)");
  });
});

const HEADER = "razon_social,cuit,tipo,rubro,criticidad,motivo_criticidad,responsable,contacto,email,telefono,notas";

describe("parseSupplierCsv", () => {
  it("lee una fila válida y normaliza el CUIT y los textos", () => {
    const { rows, errors } = parseSupplierCsv(`${HEADER}\nMontajes del Sur SA,30-50001091-2,Contratista,Montaje,crítico,Trabaja en altura en planta,,Luis,luis@ms.com,299-555,\n`);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      line: 2,
      legalName: "Montajes del Sur SA",
      taxId: "30500010912",
      type: "contractor",
      category: "Montaje",
      criticality: "critical",
      criticalityReason: "Trabaja en altura en planta",
      contactEmail: "luis@ms.com",
    });
  });

  it("criticidad vacía = estándar; acepta ; como separador y encabezados con tildes", () => {
    const { rows, errors } = parseSupplierCsv("Razón social;CUIT;Tipo\nAcme SA;;producto\n");
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ criticality: "standard", taxId: null, type: "product" });
  });

  it("errores con número de fila: CUIT inválido, tipo desconocido, falta motivo, falta nombre", () => {
    const { rows, errors } = parseSupplierCsv(
      [
        HEADER,
        "Ok SA,20-12345678-6,servicio,,,,,,,,",
        "Mal CUIT SA,20-12345678-5,servicio,,,,,,,,",
        "Sin tipo SA,,vehiculo,,,,,,,,",
        "Bajo SA,,producto,,bajo impacto,,,,,,",
        ",,producto,,,,,,,,",
        "Crítico SA,,producto,,crítico,,,,,,",
      ].join("\n"),
    );
    expect(rows.map((r) => r.legalName)).toEqual(["Ok SA"]);
    expect(errors.map((e) => [e.line, e.field])).toEqual([
      [3, "cuit"],
      [4, "tipo"],
      [5, "motivo_criticidad"],
      [6, "razon_social"],
      [7, "motivo_criticidad"],
    ]);
  });

  it("CUIT o nombre repetido dentro del archivo: la segunda fila es un error", () => {
    const { rows, errors } = parseSupplierCsv(
      [HEADER, "A SA,20-12345678-6,producto,,,,,,,,", "B SA,20123456786,producto,,,,,,,,", "Sin cuit,,producto,,,,,,,,", "SIN  CUIT,,producto,,,,,,,,"].join("\n"),
    );
    expect(rows.map((r) => r.legalName)).toEqual(["A SA", "Sin cuit"]);
    expect(errors.map((e) => e.line)).toEqual([3, 5]);
    expect(errors[0].message).toContain("línea 2");
  });

  it("faltan columnas obligatorias / archivo vacío", () => {
    expect(parseSupplierCsv("cuit,rubro\n1,2").errors[0]).toMatchObject({ line: 1, field: "encabezado" });
    expect(parseSupplierCsv("").errors[0]).toMatchObject({ line: 1, field: "archivo" });
  });

  it("la plantilla descargable se lee sin errores", () => {
    const { rows, errors } = parseSupplierCsv(SUPPLIER_CSV_TEMPLATE);
    expect(errors).toEqual([]);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("500 filas con 3 inválidas: 497 válidas y 3 errores con su número de fila", () => {
    const lines = [HEADER];
    const bad = new Set([10, 250, 400]);
    let n = 0;
    for (let i = 1; i <= 500; i++) {
      if (bad.has(i)) {
        lines.push(`Inválido ${i},20-12345678-5,producto,,,,,,,,`);
        continue;
      }
      const first10 = String(2000000000 + i);
      let cuit = "";
      for (let dv = 0; dv < 10; dv++) {
        if (isValidCuit(`${first10}${dv}`).valid) {
          cuit = `${first10}${dv}`;
          break;
        }
      }
      if (!cuit) {
        lines.push(`Sin CUIT ${i},,producto,,,,,,,,`);
      } else {
        lines.push(`Proveedor ${i},${cuit},producto,Rubro,bajo impacto,Compra ocasional,,,,,`);
      }
      n++;
    }
    const { rows, errors } = parseSupplierCsv(lines.join("\n"));
    expect(n).toBe(497);
    expect(rows).toHaveLength(497);
    expect(errors.map((e) => e.line)).toEqual([11, 251, 401]);
  });
});

describe("planSupplierImport", () => {
  const parsed = parseSupplierCsv(
    [HEADER, "Nueva SA,20-12345678-6,producto,,,,,,,,", "Existente SA,30-50001091-2,servicio,,,,,,,,", "Extranjera LLC,,producto,,,,,,,,"].join("\n"),
  ).rows;

  it("crea lo nuevo y no toca lo que ya existe (reimportar no duplica)", () => {
    const plan = planSupplierImport(parsed, [
      { taxId: "30500010912", legalName: "Existente SA" },
      { taxId: null, legalName: "extranjera llc" },
    ]);
    expect(plan.items.map((i) => i.action)).toEqual(["create", "exists", "exists"]);
    expect(plan.counts).toEqual({ create: 1, exists: 2 });
    const again = planSupplierImport(parsed, [
      { taxId: "20123456786", legalName: "Nueva SA" },
      { taxId: "30500010912", legalName: "Existente SA" },
      { taxId: null, legalName: "Extranjera LLC" },
    ]);
    expect(again.counts).toEqual({ create: 0, exists: 3 });
  });
});
