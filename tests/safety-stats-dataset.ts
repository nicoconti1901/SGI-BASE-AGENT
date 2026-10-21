import { computeLostDays, deriveEventPeriod, localDateTimeToInstant } from "@/domain/safety-stats/period";
import type { EventAggregate, ExposureRow, OpenCaseAggregate } from "@/domain/safety-stats/indices";
import type { EmployerKind, IncidentClassification } from "@/domain/safety-stats/types";

/** Conjunto de referencia del SPEC (SPEC-accident-stats.md § Dataset), calculado a mano. */
export const SITE_A = "site-a";
export const SITE_B = "site-b";

export const EXPOSURE: ExposureRow[] = [
  { siteId: SITE_A, employerKind: "own", month: "2026-01", hours: 20000, headcountAvg: 110 },
  { siteId: SITE_A, employerKind: "own", month: "2026-02", hours: 18000, headcountAvg: 108 },
  { siteId: SITE_A, employerKind: "own", month: "2026-03", hours: 22000, headcountAvg: 112 },
  { siteId: SITE_A, employerKind: "contractor", month: "2026-01", hours: 5000, headcountAvg: 28 },
  { siteId: SITE_A, employerKind: "contractor", month: "2026-02", hours: 4000, headcountAvg: 25 },
  // A contratista, marzo: fila ausente (no cargado).
  { siteId: SITE_B, employerKind: "own", month: "2026-01", hours: 10000, headcountAvg: 55 },
  { siteId: SITE_B, employerKind: "own", month: "2026-02", hours: 10000, headcountAvg: 55 },
  { siteId: SITE_B, employerKind: "own", month: "2026-03", hours: 10000, headcountAvg: 55 },
  // B contratista, enero: 0 / 0 explícito.
  { siteId: SITE_B, employerKind: "contractor", month: "2026-01", hours: 0, headcountAvg: 0 },
  { siteId: SITE_B, employerKind: "contractor", month: "2026-02", hours: 3000, headcountAvg: 15 },
  { siteId: SITE_B, employerKind: "contractor", month: "2026-03", hours: 3000, headcountAvg: 15 },
];

export type DatasetEvent = {
  id: string;
  siteId: string;
  employerKind: EmployerKind;
  /** Fecha local AAAA-MM-DD; la hora se fija al mediodía. */
  date: string;
  classification: IncidentClassification;
  inItinere?: boolean;
  restrictedWork?: boolean;
  returnToWorkDate?: string;
  chargePct?: number;
};

export const EVENTS: DatasetEvent[] = [
  { id: "E1", siteId: SITE_A, employerKind: "own", date: "2026-01-10", classification: "lost_time", returnToWorkDate: "2026-01-21" },
  { id: "E2", siteId: SITE_A, employerKind: "own", date: "2026-01-25", classification: "lost_time", returnToWorkDate: "2026-02-15" },
  { id: "E3", siteId: SITE_A, employerKind: "own", date: "2026-02-05", classification: "fatal", chargePct: 100 },
  { id: "E4", siteId: SITE_A, employerKind: "own", date: "2026-02-12", classification: "no_lost_time", restrictedWork: true },
  { id: "E5", siteId: SITE_A, employerKind: "own", date: "2026-02-20", classification: "lost_time", inItinere: true, returnToWorkDate: "2026-03-23" },
  { id: "E6", siteId: SITE_A, employerKind: "contractor", date: "2026-02-03", classification: "lost_time", returnToWorkDate: "2026-02-09" },
  { id: "E7", siteId: SITE_B, employerKind: "own", date: "2026-03-02", classification: "lost_time", returnToWorkDate: "2026-03-06" },
  { id: "E8", siteId: SITE_B, employerKind: "own", date: "2026-03-15", classification: "first_aid" },
  { id: "E9", siteId: SITE_B, employerKind: "own", date: "2026-03-20", classification: "near_miss" },
  { id: "E10", siteId: SITE_B, employerKind: "own", date: "2026-01-18", classification: "lost_time", returnToWorkDate: "2026-01-31" },
  { id: "E11", siteId: SITE_B, employerKind: "contractor", date: "2026-01-14", classification: "lost_time", returnToWorkDate: "2026-01-22" },
];

export const AS_OF = "2026-03-31";

/** Calcula, como lo hace el alta, lo que se guarda por evento. */
export function materialize(events: DatasetEvent[]) {
  return events.map((e) => {
    const occurredAt = localDateTimeToInstant(`${e.date}T12:00`)!;
    const period = deriveEventPeriod(occurredAt);
    const lostDays =
      e.classification === "lost_time"
        ? computeLostDays({ occurredOn: period.occurredOn, returnToWorkDate: e.returnToWorkDate ?? null, asOf: AS_OF, cap: 365 }).days
        : 0;
    return { ...e, ...period, month: period.periodMonth.slice(0, 7), lostDays, chargePct: e.chargePct ?? 0 };
  });
}

/** Imita el `groupBy` de la base: una fila por (sede, mes, grupo, clasificación, trayecto, restringido). */
export function aggregateEvents(events: DatasetEvent[]): { events: EventAggregate[]; openCases: OpenCaseAggregate[] } {
  const rows = new Map<string, EventAggregate>();
  const open = new Map<string, OpenCaseAggregate>();
  for (const e of materialize(events)) {
    const inItinere = e.inItinere ?? false;
    const restrictedWork = e.restrictedWork ?? false;
    const key = [e.siteId, e.month, e.employerKind, e.classification, inItinere, restrictedWork].join("|");
    const row = rows.get(key) ?? {
      siteId: e.siteId,
      month: e.month,
      employerKind: e.employerKind,
      classification: e.classification,
      inItinere,
      restrictedWork,
      count: 0,
      lostDays: 0,
      chargePct: 0,
    };
    row.count += 1;
    row.lostDays += e.lostDays;
    row.chargePct += e.chargePct;
    rows.set(key, row);

    if (e.classification === "lost_time" && !e.returnToWorkDate && !inItinere) {
      const k = [e.siteId, e.month, e.employerKind].join("|");
      const o = open.get(k) ?? { siteId: e.siteId, month: e.month, employerKind: e.employerKind, count: 0 };
      o.count += 1;
      open.set(k, o);
    }
  }
  return { events: [...rows.values()], openCases: [...open.values()] };
}
