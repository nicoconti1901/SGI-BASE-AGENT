import { FUNCTIONAL_CHECK_TEMPLATE_KEY, INSTRUMENT_TYPE_KEY } from "@/domain/calibration/types";
import { checkItem, type TemplateDefinition } from "./types";

/**
 * Prueba funcional del equipo de medición («bump test», Task 16.5). Opcional: la hace quien usa el equipo antes de salir.
 * Es un control cualitativo: no extiende la vigencia de la calibración. Una falla saca el equipo de servicio y abre una
 * evaluación de impacto (el enganche está en `src/lib/functional-check.ts`). Una prueba apta, cerrada por un responsable de
 * proceso o superior, lo devuelve a servicio. No genera vencimientos (decisión 10 del SPEC de inspecciones).
 */
export const FUNCTIONAL_CHECK: TemplateDefinition = {
  key: FUNCTIONAL_CHECK_TEMPLATE_KEY,
  name: "Prueba funcional del equipo de medición",
  scope: "asset",
  assetTypeKey: INSTRUMENT_TYPE_KEY,
  intervalUnit: null,
  intervalValue: null,
  leadDays: 0,
  reinspectionDays: 7,
  findingOnCritical: false,
  canReinstate: true,
  retireOnUnfit: false,
  maxApplicableItems: 15,
  items: [
    checkItem("selftest", "Antes de usarlo", "Enciende y completa el autotest sin errores ni fallas", "critical", { naAllowed: false }),
    checkItem("battery", "Antes de usarlo", "La batería o la alimentación alcanza para toda la jornada", "major"),
    checkItem("damage", "Antes de usarlo", "Sin golpes, fisuras ni sensores o accesorios dañados", "major"),
    checkItem("label", "Antes de usarlo", "La etiqueta de calibración está colocada y se lee", "minor"),
    checkItem("response", "Prueba de respuesta", "Responde a una referencia conocida (gas de prueba, cero o patrón de control) y la lectura es la esperada", "critical", {
      naAllowed: false,
      help: "En un detector de gases: aplicá el gas de prueba y verificá que la lectura sube al valor esperado. En otros equipos: comprobá el cero o un patrón de control.",
    }),
    checkItem("alarms", "Prueba de respuesta", "Las alarmas sonoras y visuales se activan", "critical", { help: "Marcá «No aplica» si el equipo no tiene alarmas." }),
  ],
};
