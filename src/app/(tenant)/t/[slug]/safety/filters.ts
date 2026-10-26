import { defaultAnchorMonth } from "@/lib/safety-dashboard";
import { WINDOW_KINDS, type GroupFilter, type WindowKind } from "@/domain/safety-stats/dashboard";
import type { IsoDay, MonthKey } from "@/domain/safety-stats/types";

export type SafetyQuery = { ventana?: string; mes?: string; sede?: string; grupo?: string };

/** Período, mes de cierre, sede y grupo desde la URL: lo usan el tablero, el resumen y las exportaciones. */
export async function parseSafetyFilter(tenantId: string, sp: SafetyQuery, today: IsoDay) {
  const kind: WindowKind = (WINDOW_KINDS as readonly string[]).includes(sp.ventana ?? "") ? (sp.ventana as WindowKind) : "month";
  const group: GroupFilter = sp.grupo === "own" || sp.grupo === "contractor" ? sp.grupo : "total";
  const fallback = await defaultAnchorMonth(tenantId, today);
  const anchor: MonthKey = sp.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) && sp.mes <= today.slice(0, 7) ? sp.mes : fallback;
  return { kind, group, anchor, siteId: sp.sede || undefined };
}

/** Los mismos filtros como parámetros de URL, para los enlaces de exportación y de resumen. */
export function safetyFilterQuery(filter: { kind: WindowKind; anchor: MonthKey; siteId?: string; group: GroupFilter }): string {
  const params = new URLSearchParams({ ventana: filter.kind, mes: filter.anchor, grupo: filter.group });
  if (filter.siteId) params.set("sede", filter.siteId);
  return params.toString();
}
