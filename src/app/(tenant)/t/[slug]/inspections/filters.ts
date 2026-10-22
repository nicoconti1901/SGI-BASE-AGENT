import type { InspectionListFilter } from "@/lib/inspection-list";
import { isIsoDate } from "@/domain/inspections/dates";

/** Parámetros de la URL de la lista (en español, como el resto de las pantallas). */
export type InspectionSearchParams = {
  tipo?: string;
  sede?: string;
  activo?: string;
  inspector?: string;
  resultado?: string;
  desde?: string;
  hasta?: string;
  vista?: string;
  despues?: string;
  error?: string;
};

const RESULTS = new Set(["fit", "fit_with_observations", "unfit"]);

/** Traduce los parámetros de la URL al filtro, descartando lo que no tiene el formato esperado. */
export function inspectionFilterFromParams(sp: InspectionSearchParams | URLSearchParams): InspectionListFilter {
  const get = (key: keyof InspectionSearchParams) => (sp instanceof URLSearchParams ? (sp.get(key) ?? undefined) : sp[key]) || undefined;
  const result = get("resultado");
  const from = get("desde");
  const to = get("hasta");
  return {
    templateId: get("tipo"),
    siteId: get("sede"),
    assetCode: get("activo")?.slice(0, 40),
    inspectorUserId: get("inspector"),
    result: result && RESULTS.has(result) ? (result as InspectionListFilter["result"]) : undefined,
    from: from && isIsoDate(from) ? from : undefined,
    to: to && isIsoDate(to) ? to : undefined,
  };
}

export function hasInspectionFilter(filter: InspectionListFilter): boolean {
  return Boolean(filter.templateId || filter.siteId || filter.assetCode || filter.inspectorUserId || filter.result || filter.from || filter.to);
}
