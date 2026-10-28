"use client";

import { useState } from "react";
import { Field, HintCallout, INPUT_CLASS } from "@/components/ui";
import { PersonPicker } from "@/components/pickers/PersonPicker";
import {
  ROAD_EVENT_TYPES,
  ROAD_LIGHTS,
  ROAD_MAIN_CAUSES,
  ROAD_PROPERTY_DAMAGES,
  ROAD_SEATBELTS,
  ROAD_SURFACES,
  ROAD_WEATHERS,
  VEHICLE_KINDS,
  type RoadVehicleKind,
} from "@/domain/road-safety/types";

export type RoadVehicleOption = { id: string; code: string; description: string };

const checkboxClass =
  "h-4 w-4 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] accent-[var(--color-accent)]";

function Select({
  name,
  options,
  defaultValue,
  required,
}: {
  name: string;
  options: readonly { key: string; label: string }[];
  defaultValue: string;
  required?: boolean;
}) {
  return (
    <select name={name} required={required} defaultValue={defaultValue} className={INPUT_CLASS}>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Count({ name, label, hint }: { name: string; label: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <input type="number" name={name} min={0} max={999} step={1} defaultValue={0} inputMode="numeric" className={INPUT_CLASS} />
    </Field>
  );
}

/**
 * Paso «Detalle vial» del alta de un hecho de tránsito (SPEC-road-safety § Qué ve el cliente). Los campos
 * viajan con el prefijo `road_`; `parseRoadForm` los lee en el servidor.
 */
export function RoadFields({ slug, vehicles }: { slug: string; vehicles: RoadVehicleOption[] }) {
  const [kind, setKind] = useState<RoadVehicleKind>("own");
  const usesAsset = kind === "own" || kind === "contractor";
  const [reportFiled, setReportFiled] = useState(false);

  return (
    <fieldset className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
      <legend className="px-1 font-[family-name:var(--font-display)] text-base font-semibold">Detalle del hecho de tránsito</legend>
      <HintCallout>
        Con estos datos se calculan los km y las tasas de seguridad vial. El conductor solo lo ven el administrador y el responsable de proceso; no se usa para sancionar.
      </HintCallout>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="¿Qué vehículo estuvo involucrado?" required>
          <select name="road_vehicleKind" value={kind} onChange={(e) => setKind(e.target.value as RoadVehicleKind)} className={INPUT_CLASS}>
            {VEHICLE_KINDS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        {usesAsset ? (
          <Field
            label="Vehículo de la flota"
            required={kind === "own"}
            hint={kind === "contractor" ? "Si el contratista tiene el vehículo cargado como equipo. Si no, describilo abajo." : undefined}
          >
            <select name="road_assetId" required={kind === "own"} defaultValue="" className={INPUT_CLASS}>
              <option value="" disabled={kind === "own"}>
                {kind === "own" ? "Elegí el vehículo" : "Sin vehículo cargado"}
              </option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.code} · {v.description}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {kind !== "own" && kind !== "none" ? (
          <Field label="Descripción del vehículo" hint="Marca, modelo o patente, si se sabe.">
            <input name="road_vehicleLabel" maxLength={120} className={INPUT_CLASS} />
          </Field>
        ) : null}
      </div>

      <PersonPicker slug={slug} name="road_driverPersonId" label="Conductor" hint="Quien manejaba, si es personal de la empresa o contratista." />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de hecho" required>
          <Select name="road_eventType" options={ROAD_EVENT_TYPES} defaultValue="collision_vehicle" required />
        </Field>
        <Field label="Causa principal" hint="La que surge de lo que se sabe hoy; se puede corregir después.">
          <Select name="road_mainCause" options={ROAD_MAIN_CAUSES} defaultValue="undetermined" />
        </Field>
        <Field label="Calzada">
          <Select name="road_roadSurface" options={ROAD_SURFACES} defaultValue="unknown" />
        </Field>
        <Field label="Luz">
          <Select name="road_light" options={ROAD_LIGHTS} defaultValue="unknown" />
        </Field>
        <Field label="Clima">
          <Select name="road_weather" options={ROAD_WEATHERS} defaultValue="unknown" />
        </Field>
        <Field label="Cinturón de seguridad">
          <Select name="road_seatbelt" options={ROAD_SEATBELTS} defaultValue="unknown" />
        </Field>
        <Field label="Daño material">
          <Select name="road_propertyDamage" options={ROAD_PROPERTY_DAMAGES} defaultValue="none" />
        </Field>
        <Field label="Velocidad estimada (km/h)" hint="Solo si se sabe.">
          <input type="number" name="road_speed" min={0} max={250} step={1} inputMode="numeric" className={INPUT_CLASS} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Count name="road_injuredCount" label="Lesionados" />
        <Count name="road_hospitalizedCount" label="Internados" hint="Los que requirieron internación." />
        <Count name="road_fatalCount" label="Fallecidos" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="road_reportFiled" checked={reportFiled} onChange={(e) => setReportFiled(e.target.checked)} className={checkboxClass} />
          Se hizo la denuncia policial o del seguro
        </label>
        {reportFiled ? (
          <Field label="N.° de denuncia">
            <input name="road_reportRef" maxLength={60} className={INPUT_CLASS} />
          </Field>
        ) : null}
      </div>
    </fieldset>
  );
}
