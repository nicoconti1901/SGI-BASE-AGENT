import type { InstrumentFilter } from "@/lib/instruments";
import { isMagnitude, isStatusGroup } from "@/domain/calibration";

/** Parámetros de la URL de la lista (en español, como el resto de las pantallas). */
export type InstrumentSearchParams = {
  q?: string;
  sede?: string;
  magnitud?: string;
  estado?: string;
  pagina?: string;
};

/** Traduce los parámetros de la URL al filtro, descartando lo que no tiene el formato esperado. */
export function instrumentFilterFromParams(sp: InstrumentSearchParams | URLSearchParams): InstrumentFilter {
  const get = (key: keyof InstrumentSearchParams) => (sp instanceof URLSearchParams ? (sp.get(key) ?? undefined) : sp[key]) || undefined;
  const group = get("estado");
  const magnitude = get("magnitud");
  const page = Number(get("pagina"));
  return {
    q: get("q")?.slice(0, 60),
    siteId: get("sede"),
    magnitude: magnitude && isMagnitude(magnitude) ? magnitude : undefined,
    group: isStatusGroup(group) ? group : undefined,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function hasInstrumentFilter(filter: InstrumentFilter): boolean {
  return Boolean(filter.q || filter.siteId || filter.magnitude || filter.group);
}
