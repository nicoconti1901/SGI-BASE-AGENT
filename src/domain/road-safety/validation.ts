import {
  ROAD_EVENT_TYPE_KEYS,
  ROAD_LIGHT_KEYS,
  ROAD_MAIN_CAUSE_KEYS,
  ROAD_PROPERTY_DAMAGE_KEYS,
  ROAD_SEATBELT_KEYS,
  ROAD_SURFACE_KEYS,
  ROAD_WEATHER_KEYS,
  VEHICLE_KIND_KEYS,
  type RoadEventType,
  type RoadLight,
  type RoadMainCause,
  type RoadPropertyDamage,
  type RoadSeatbelt,
  type RoadSurface,
  type RoadVehicleKind,
  type RoadWeather,
} from "@/domain/road-safety/types";
import type { IncidentClassification } from "@/domain/safety-stats/types";

export type RoadFieldErrors = Record<string, string>;

/** Detalle vial tal como llega al guardar (ya con tipos, no con el texto del formulario). */
export type RoadEventInput = {
  classification: IncidentClassification;
  vehicleKind: RoadVehicleKind;
  assetId: string | null;
  eventType: RoadEventType;
  roadSurface: RoadSurface;
  light: RoadLight;
  weather: RoadWeather;
  seatbelt: RoadSeatbelt;
  mainCause: RoadMainCause;
  propertyDamage: RoadPropertyDamage;
  injuredCount: number;
  hospitalizedCount: number;
  fatalCount: number;
  estimatedSpeedKmh: number | null;
  reportFiled: boolean;
  reportRef: string | null;
};

const isCount = (n: number) => Number.isInteger(n) && n >= 0 && n <= 999;

/** Reglas del detalle vial (SPEC § Casos borde). Un error impide guardar. */
export function validateRoadEvent(input: RoadEventInput): RoadFieldErrors {
  const errors: RoadFieldErrors = {};

  if (!VEHICLE_KIND_KEYS.includes(input.vehicleKind)) errors.vehicleKind = "Elegí el tipo de vehículo";
  if (input.vehicleKind === "own" && !input.assetId) errors.assetId = "Elegí el vehículo de la empresa";
  if (!ROAD_EVENT_TYPE_KEYS.includes(input.eventType)) errors.eventType = "Elegí el tipo de hecho";
  if (!ROAD_SURFACE_KEYS.includes(input.roadSurface)) errors.roadSurface = "Elegí el estado de la calzada";
  if (!ROAD_LIGHT_KEYS.includes(input.light)) errors.light = "Elegí la luz";
  if (!ROAD_WEATHER_KEYS.includes(input.weather)) errors.weather = "Elegí el clima";
  if (!ROAD_SEATBELT_KEYS.includes(input.seatbelt)) errors.seatbelt = "Elegí el uso del cinturón";
  if (!ROAD_MAIN_CAUSE_KEYS.includes(input.mainCause)) errors.mainCause = "Elegí la causa principal";
  if (!ROAD_PROPERTY_DAMAGE_KEYS.includes(input.propertyDamage)) errors.propertyDamage = "Elegí el daño material";

  if (!isCount(input.injuredCount)) errors.injuredCount = "Los lesionados son un número entero, 0 o más";
  if (!isCount(input.hospitalizedCount)) errors.hospitalizedCount = "Los internados son un número entero, 0 o más";
  if (!isCount(input.fatalCount)) errors.fatalCount = "Los fallecidos son un número entero, 0 o más";

  if (!errors.hospitalizedCount && !errors.injuredCount && input.hospitalizedCount > input.injuredCount) {
    errors.hospitalizedCount = "Los internados no pueden ser más que los lesionados";
  }
  if (!errors.fatalCount) {
    if (input.fatalCount > 0 && input.classification !== "fatal") {
      errors.fatalCount = "Con fallecidos, la clasificación tiene que ser «Fatal»";
    } else if (input.classification === "fatal" && input.fatalCount === 0) {
      errors.fatalCount = "Un evento fatal necesita al menos un fallecido";
    }
  }
  if (!errors.injuredCount && input.injuredCount > 0 && (input.classification === "near_miss" || input.classification === "property_damage_only")) {
    errors.injuredCount =
      input.classification === "near_miss" ? "Un casi accidente no tiene lesionados" : "«Solo daño material» no admite lesionados";
  }

  if (input.estimatedSpeedKmh !== null && (!Number.isInteger(input.estimatedSpeedKmh) || input.estimatedSpeedKmh < 0 || input.estimatedSpeedKmh > 250)) {
    errors.estimatedSpeedKmh = "La velocidad estimada va de 0 a 250 km/h";
  }
  if (input.reportRef && !input.reportFiled) errors.reportRef = "Marcá que la denuncia se hizo para cargar su número";
  return errors;
}
