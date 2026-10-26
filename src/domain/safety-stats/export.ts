/**
 * Exportación de accidentabilidad (SPEC-accident-stats.md, slice 17.5): CSV agregado por sede y mes con
 * numeradores, denominadores y estado, y CSV de casos. Funciones puras: reciben lo que ya agregó la base.
 * Sin exposición, el índice sale vacío; nunca 0 (D8). Los accidentes in itinere van en su columna (D6).
 */
import { csvCell } from "@/domain/inspections/export";
import { FINDING_STATUS_LABELS } from "@/domain/findings/types";
import { classifySegmentMonth, computeIndices, type EventAggregate, type ExposureRow, type OpenCaseAggregate, type SegmentMonthStatus } from "./indices";
import { instantToLocalInput } from "./period";
import {
  CLASSIFICATION_LABELS,
  EMPLOYER_KINDS,
  EMPLOYER_LABELS,
  isClassification,
  labelAccidentForm,
  labelBodyPart,
  labelMaterialAgent,
  labelNature,
  type EmployerKind,
  type MonthKey,
  type SafetySettings,
} from "./types";

const SEP = ";";
const csvLine = (cells: readonly (string | number | null | undefined)[]) => cells.map(csvCell).join(SEP);
/** CSV para Excel es-AR: UTF-8 con BOM y «;» como separador. */
const toCsv = (lines: readonly string[]) => `﻿${lines.join("\r\n")}\r\n`;
const decimal = (n: number | null, digits: number) => (n === null ? "" : n.toFixed(digits).replace(".", ","));
const thousands = (n: number) => n.toLocaleString("es-AR");

export type AggregateExportRow = {
  siteId: string;
  site: string;
  month: MonthKey;
  employerKind: EmployerKind;
  status: SegmentMonthStatus;
  /** Denominadores; vacíos si el mes no tiene exposición cargada. */
  hours: number | null;
  headcountAvg: number | null;
  /** Conteos laborales, con o sin exposición (el in itinere no entra). */
  nearMiss: number;
  firstAid: number;
  noLostTime: number;
  lostTime: number;
  fatal: number;
  occupationalDisease: number;
  lostDays: number;
  /** Casos con baja o fatales en el trayecto: aparte, no entran en los índices. */
  inItinere: number;
  /** Hay un caso con baja sin reintegro: los días de este mes pueden crecer. */
  provisional: boolean;
  if: number | null;
  ig: number | null;
  ii: number | null;
  id: number | null;
};

export const STATUS_EXPORT_LABELS: Record<SegmentMonthStatus, string> = {
  ok: "Completo",
  empty: "Sin actividad",
  missing: "Falta cargar las horas",
  inconsistent: "Horas en 0 con accidentes",
};

/** Una fila por sede, mes y grupo (propio / contratista), existan o no horas cargadas. */
export function buildAggregateRows(input: {
  sites: readonly { id: string; name: string }[];
  months: readonly MonthKey[];
  exposure: readonly ExposureRow[];
  events: readonly EventAggregate[];
  openCases: readonly OpenCaseAggregate[];
  settings: Pick<SafetySettings, "fatalChargeDays" | "severityBase">;
}): AggregateExportRow[] {
  const key = (siteId: string, employerKind: string, month: string) => `${siteId}|${employerKind}|${month}`;
  const exposureBy = new Map(input.exposure.map((e) => [key(e.siteId, e.employerKind, e.month), e]));
  const eventsBy = new Map<string, EventAggregate[]>();
  for (const e of input.events) {
    const k = key(e.siteId, e.employerKind, e.month);
    eventsBy.set(k, [...(eventsBy.get(k) ?? []), e]);
  }
  const openBy = new Set(input.openCases.filter((o) => o.count > 0).map((o) => key(o.siteId, o.employerKind, o.month)));

  const rows: AggregateExportRow[] = [];
  for (const site of input.sites) {
    for (const month of input.months) {
      for (const employerKind of EMPLOYER_KINDS) {
        const k = key(site.id, employerKind, month);
        const exposure = exposureBy.get(k);
        const row: AggregateExportRow = {
          siteId: site.id,
          site: site.name,
          month,
          employerKind,
          status: "missing",
          hours: exposure?.hours ?? null,
          headcountAvg: exposure?.headcountAvg ?? null,
          nearMiss: 0,
          firstAid: 0,
          noLostTime: 0,
          lostTime: 0,
          fatal: 0,
          occupationalDisease: 0,
          lostDays: 0,
          inItinere: 0,
          provisional: openBy.has(k),
          if: null,
          ig: null,
          ii: null,
          id: null,
        };
        let restricted = 0;
        let chargePct = 0;
        for (const e of eventsBy.get(k) ?? []) {
          if (e.inItinere) {
            if (e.classification === "lost_time" || e.classification === "fatal") row.inItinere += e.count;
            continue;
          }
          switch (e.classification) {
            case "near_miss":
              row.nearMiss += e.count;
              break;
            case "first_aid":
              row.firstAid += e.count;
              break;
            case "no_lost_time":
              row.noLostTime += e.count;
              if (e.restrictedWork) restricted += e.count;
              break;
            case "lost_time":
              row.lostTime += e.count;
              row.lostDays += e.lostDays;
              chargePct += e.chargePct;
              break;
            case "fatal":
              row.fatal += e.count;
              chargePct += e.chargePct;
              break;
            case "occupational_disease":
              row.occupationalDisease += e.count;
              break;
          }
        }
        row.status = classifySegmentMonth(exposure, { lostOrFatal: row.lostTime + row.fatal });
        if (row.status === "ok" && exposure) {
          const indices = computeIndices(
            {
              hours: exposure.hours,
              headcountSum: exposure.headcountAvg,
              monthCount: 1,
              lostTimeCases: row.lostTime,
              fatalCases: row.fatal,
              noLostTimeCases: row.noLostTime,
              restrictedCases: restricted,
              lostDays: row.lostDays,
              chargePctSum: chargePct,
            },
            input.settings,
          );
          row.if = indices.if;
          row.ig = indices.ig;
          row.ii = indices.ii;
          row.id = indices.id;
        }
        rows.push(row);
      }
    }
  }
  return rows;
}

/** La base de cada índice va en la cabecera: así el archivo se lee solo, sin la pantalla. */
export function aggregateHeaders(settings: Pick<SafetySettings, "severityBase">): string[] {
  return [
    "Sede",
    "Mes",
    "Personal",
    "Estado",
    "Horas trabajadas",
    "Dotación promedio",
    "Casi accidentes",
    "Primeros auxilios",
    "Sin baja",
    "Con baja",
    "Fatales",
    "Enfermedades profesionales",
    "Días perdidos (reales)",
    "En el trayecto (con baja o fatales)",
    "Mes provisorio",
    "IF (casos con baja por 1.000.000 h)",
    `IG (días por ${thousands(settings.severityBase)} h)`,
    "II (casos con baja por 1.000 trabajadores)",
    "ID (días por caso con baja)",
  ];
}

export function aggregateRowsToCsv(rows: readonly AggregateExportRow[], settings: Pick<SafetySettings, "severityBase">): string {
  return toCsv([
    csvLine(aggregateHeaders(settings)),
    ...rows.map((r) =>
      csvLine([
        r.site,
        r.month,
        EMPLOYER_LABELS[r.employerKind],
        STATUS_EXPORT_LABELS[r.status],
        r.hours,
        r.headcountAvg === null ? "" : decimal(r.headcountAvg, 1),
        r.nearMiss,
        r.firstAid,
        r.noLostTime,
        r.lostTime,
        r.fatal,
        r.occupationalDisease,
        r.lostDays,
        r.inItinere,
        r.provisional ? "Sí" : "No",
        decimal(r.if, 2),
        decimal(r.ig, 2),
        decimal(r.ii, 2),
        decimal(r.id, 1),
      ]),
    ),
  ]);
}

export type CaseCsvRow = {
  occurredAt: Date;
  site: string;
  employerKind: EmployerKind | string;
  classification: string;
  inItinere: boolean;
  accidentForm: string;
  materialAgent: string;
  /** Datos de salud: vacíos si todavía no se completó la ficha. */
  person: string | null;
  employeeCode: string | null;
  natureOfInjury: string | null;
  bodyPart: string | null;
  lostDays: number;
  /** AAAA-MM-DD. */
  returnToWorkDate: string | null;
  artClaimNumber: string | null;
  findingStatus: string;
  findingTitle: string;
};

const CASE_HEADERS = [
  "Fecha y hora",
  "Sede",
  "Personal",
  "Clasificación",
  "En el trayecto",
  "Forma del accidente",
  "Agente material",
  "Persona afectada",
  "Legajo",
  "Naturaleza de la lesión",
  "Parte del cuerpo",
  "Días perdidos",
  "Fecha de reintegro",
  "N.° de siniestro ART",
  "Estado del hallazgo",
  "Título del hallazgo",
] as const;

const dayEs = (iso: string) => iso.split("-").reverse().join("/");
/** «AAAA-MM-DDTHH:mm» en hora local → «DD/MM/AAAA HH:mm». */
const dateTimeEs = (instant: Date) => {
  const [day, time] = instantToLocalInput(instant).split("T");
  return `${dayEs(day)} ${time}`;
};

/** Casos con nombres: solo lo genera quien puede ver las fichas de salud (D10, D13). */
export function casesToCsv(rows: readonly CaseCsvRow[]): string {
  return toCsv([
    csvLine(CASE_HEADERS),
    ...rows.map((r) =>
      csvLine([
        dateTimeEs(r.occurredAt),
        r.site,
        EMPLOYER_LABELS[r.employerKind as EmployerKind] ?? r.employerKind,
        isClassification(r.classification) ? CLASSIFICATION_LABELS[r.classification] : r.classification,
        r.inItinere ? "Sí" : "No",
        labelAccidentForm(r.accidentForm),
        labelMaterialAgent(r.materialAgent),
        r.person,
        r.employeeCode,
        r.natureOfInjury ? labelNature(r.natureOfInjury) : "",
        r.bodyPart ? labelBodyPart(r.bodyPart) : "",
        r.lostDays,
        r.returnToWorkDate ? dayEs(r.returnToWorkDate) : "",
        r.artClaimNumber,
        FINDING_STATUS_LABELS[r.findingStatus as keyof typeof FINDING_STATUS_LABELS] ?? r.findingStatus,
        r.findingTitle,
      ]),
    ),
  ]);
}
