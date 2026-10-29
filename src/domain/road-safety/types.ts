/**
 * Seguridad vial (Task 18, SPEC-road-safety.md): listas y ajustes. Las listas viven en código, como las de
 * accidentabilidad; coinciden con los enums de Prisma. Los valores de superficie, luz y clima son propios
 * y cortos (el SPEC no los fija).
 */

/** Base de las tasas (D7): por millón de km. No es configurable. */
export const ROAD_RATE_BASE = 1_000_000;

type Option<K extends string> = { key: K; label: string };

function labelOf<K extends string>(list: readonly Option<K>[], key: string | null | undefined): string {
  if (!key) return "—";
  return list.find((o) => o.key === key)?.label ?? key;
}

export const VEHICLE_KINDS = [
  { key: "own", label: "Vehículo de la empresa" },
  { key: "contractor", label: "Vehículo de contratista" },
  { key: "private", label: "Vehículo particular" },
  { key: "none", label: "Sin vehículo (peatón, ciclista…)" },
] as const satisfies readonly Option<string>[];
export type RoadVehicleKind = (typeof VEHICLE_KINDS)[number]["key"];

export const ROAD_EVENT_TYPES = [
  { key: "collision_vehicle", label: "Choque con otro vehículo" },
  { key: "collision_fixed_object", label: "Choque con objeto fijo" },
  { key: "rollover", label: "Vuelco" },
  { key: "run_off_road", label: "Despiste" },
  { key: "pedestrian_cyclist", label: "Atropello de peatón o ciclista" },
  { key: "other", label: "Otro" },
] as const satisfies readonly Option<string>[];
export type RoadEventType = (typeof ROAD_EVENT_TYPES)[number]["key"];

export const ROAD_SURFACES = [
  { key: "dry", label: "Seco" },
  { key: "wet", label: "Mojado" },
  { key: "ice_snow", label: "Hielo o nieve" },
  { key: "gravel_dirt", label: "Ripio o tierra" },
  { key: "other", label: "Otro" },
  { key: "unknown", label: "No se sabe" },
] as const satisfies readonly Option<string>[];
export type RoadSurface = (typeof ROAD_SURFACES)[number]["key"];

export const ROAD_LIGHTS = [
  { key: "day", label: "De día" },
  { key: "dusk_dawn", label: "Amanecer o atardecer" },
  { key: "night_lit", label: "De noche, con iluminación" },
  { key: "night_dark", label: "De noche, sin iluminación" },
  { key: "unknown", label: "No se sabe" },
] as const satisfies readonly Option<string>[];
export type RoadLight = (typeof ROAD_LIGHTS)[number]["key"];

export const ROAD_WEATHERS = [
  { key: "clear", label: "Despejado" },
  { key: "rain", label: "Lluvia" },
  { key: "fog", label: "Niebla" },
  { key: "wind", label: "Viento fuerte" },
  { key: "snow_ice", label: "Nieve o hielo" },
  { key: "unknown", label: "No se sabe" },
] as const satisfies readonly Option<string>[];
export type RoadWeather = (typeof ROAD_WEATHERS)[number]["key"];

export const ROAD_SEATBELTS = [
  { key: "all", label: "Todos con cinturón" },
  { key: "some_not", label: "Alguno sin cinturón" },
  { key: "none", label: "Ninguno con cinturón" },
  { key: "not_applicable", label: "No aplica" },
  { key: "unknown", label: "No se sabe" },
] as const satisfies readonly Option<string>[];
export type RoadSeatbelt = (typeof ROAD_SEATBELTS)[number]["key"];

export const ROAD_PROPERTY_DAMAGES = [
  { key: "none", label: "Sin daño" },
  { key: "minor", label: "Daño leve" },
  { key: "major", label: "Daño importante" },
] as const satisfies readonly Option<string>[];
export type RoadPropertyDamage = (typeof ROAD_PROPERTY_DAMAGES)[number]["key"];

export const ROAD_MAIN_CAUSES = [
  { key: "speed", label: "Velocidad" },
  { key: "fatigue_distraction", label: "Fatiga o distracción" },
  { key: "alcohol_drugs", label: "Alcohol o drogas" },
  { key: "mechanical", label: "Falla mecánica" },
  { key: "road_conditions", label: "Estado del camino" },
  { key: "other_driver", label: "Otro conductor" },
  { key: "weather", label: "Clima" },
  { key: "other", label: "Otra" },
  { key: "undetermined", label: "Sin determinar" },
] as const satisfies readonly Option<string>[];
export type RoadMainCause = (typeof ROAD_MAIN_CAUSES)[number]["key"];

export const VEHICLE_KIND_KEYS: readonly string[] = VEHICLE_KINDS.map((o) => o.key);
export const ROAD_EVENT_TYPE_KEYS: readonly string[] = ROAD_EVENT_TYPES.map((o) => o.key);
export const ROAD_SURFACE_KEYS: readonly string[] = ROAD_SURFACES.map((o) => o.key);
export const ROAD_LIGHT_KEYS: readonly string[] = ROAD_LIGHTS.map((o) => o.key);
export const ROAD_WEATHER_KEYS: readonly string[] = ROAD_WEATHERS.map((o) => o.key);
export const ROAD_SEATBELT_KEYS: readonly string[] = ROAD_SEATBELTS.map((o) => o.key);
export const ROAD_PROPERTY_DAMAGE_KEYS: readonly string[] = ROAD_PROPERTY_DAMAGES.map((o) => o.key);
export const ROAD_MAIN_CAUSE_KEYS: readonly string[] = ROAD_MAIN_CAUSES.map((o) => o.key);

export const labelVehicleKind = (k: string | null | undefined) => labelOf(VEHICLE_KINDS, k);
export const labelRoadEventType = (k: string | null | undefined) => labelOf(ROAD_EVENT_TYPES, k);
export const labelRoadSurface = (k: string | null | undefined) => labelOf(ROAD_SURFACES, k);
export const labelRoadLight = (k: string | null | undefined) => labelOf(ROAD_LIGHTS, k);
export const labelRoadWeather = (k: string | null | undefined) => labelOf(ROAD_WEATHERS, k);
export const labelRoadSeatbelt = (k: string | null | undefined) => labelOf(ROAD_SEATBELTS, k);
export const labelRoadPropertyDamage = (k: string | null | undefined) => labelOf(ROAD_PROPERTY_DAMAGES, k);
export const labelRoadMainCause = (k: string | null | undefined) => labelOf(ROAD_MAIN_CAUSES, k);

/**
 * Clasificaciones que ofrece el alta de un evento vial: las laborales con lesión más «solo daño
 * material» (D9). Una enfermedad profesional no es un hecho de tránsito.
 */
export const ROAD_CLASSIFICATIONS = ["near_miss", "property_damage_only", "first_aid", "no_lost_time", "lost_time", "fatal"] as const;

/** Ajustes de la empresa (D16, D21, D25). */
export type RoadSafetySettings = {
  /** Bajo estos km de la ventana se avisa «poca exposición». */
  minExposureKm: number;
  repeatThreshold: number;
  repeatWindowMonths: number;
  speedingPerDriver: boolean;
};

export const DEFAULT_ROAD_SAFETY_SETTINGS: RoadSafetySettings = {
  minExposureKm: 100_000,
  repeatThreshold: 2,
  repeatWindowMonths: 12,
  speedingPerDriver: false,
};

/** Claves de mes "AAAA-MM" y de día "AAAA-MM-DD", las mismas que usa accidentabilidad. */
export type { IsoDay, MonthKey } from "@/domain/safety-stats/types";
