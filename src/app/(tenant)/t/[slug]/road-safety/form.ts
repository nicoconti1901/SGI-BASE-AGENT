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
import { RoadSafetyError, type RoadEventDetailInput } from "@/lib/road-safety";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function pick<T extends string>(formData: FormData, key: string, keys: readonly string[], fallback: T, label: string): T {
  const value = text(formData, key);
  if (value === "") return fallback;
  if (!keys.includes(value)) throw new RoadSafetyError(`${label} no válido`, { [key]: `${label} no válido` });
  return value as T;
}

function count(formData: FormData, key: string): number {
  const raw = text(formData, key);
  return raw === "" ? 0 : Number(raw);
}

/** `true` si el formulario trae el paso «Detalle vial» (el campo del vehículo siempre viaja con él). */
export const hasRoadForm = (formData: FormData) => formData.get("road_vehicleKind") !== null;

/** Campos del detalle vial del formulario (prefijo `road_`). La validación de fondo la hace el dominio. */
export function parseRoadForm(formData: FormData): RoadEventDetailInput {
  const speed = text(formData, "road_speed");
  return {
    vehicleKind: pick<RoadVehicleKind>(formData, "road_vehicleKind", VEHICLE_KIND_KEYS, "none", "El vehículo"),
    assetId: text(formData, "road_assetId") || null,
    vehicleLabel: text(formData, "road_vehicleLabel") || null,
    driverPersonId: text(formData, "road_driverPersonId") || null,
    eventType: pick<RoadEventType>(formData, "road_eventType", ROAD_EVENT_TYPE_KEYS, "other", "El tipo de hecho"),
    roadSurface: pick<RoadSurface>(formData, "road_roadSurface", ROAD_SURFACE_KEYS, "unknown", "La calzada"),
    light: pick<RoadLight>(formData, "road_light", ROAD_LIGHT_KEYS, "unknown", "La luz"),
    weather: pick<RoadWeather>(formData, "road_weather", ROAD_WEATHER_KEYS, "unknown", "El clima"),
    seatbelt: pick<RoadSeatbelt>(formData, "road_seatbelt", ROAD_SEATBELT_KEYS, "unknown", "El cinturón"),
    mainCause: pick<RoadMainCause>(formData, "road_mainCause", ROAD_MAIN_CAUSE_KEYS, "undetermined", "La causa"),
    propertyDamage: pick<RoadPropertyDamage>(formData, "road_propertyDamage", ROAD_PROPERTY_DAMAGE_KEYS, "none", "El daño material"),
    injuredCount: count(formData, "road_injuredCount"),
    hospitalizedCount: count(formData, "road_hospitalizedCount"),
    fatalCount: count(formData, "road_fatalCount"),
    estimatedSpeedKmh: speed === "" ? null : Number(speed),
    reportFiled: formData.get("road_reportFiled") === "on",
    reportRef: text(formData, "road_reportRef") || null,
  };
}
