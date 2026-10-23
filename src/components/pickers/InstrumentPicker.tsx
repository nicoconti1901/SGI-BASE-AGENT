import { Field, INPUT_CLASS } from "@/components/ui";

export type InstrumentOption = {
  id: string;
  code: string;
  description: string;
  siteName?: string;
  /** `searchInstruments(...).usability`: un equipo que no se puede usar aparece deshabilitado, con el motivo. */
  usability: { usable: boolean; reason: string | null };
};

type InstrumentPickerProps = {
  /** Equipos de `searchInstruments` (todos, también los no utilizables). */
  instruments: InstrumentOption[];
  name: string;
  label?: string;
  hint?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
};

/**
 * Selector de equipos de medición para los demás módulos (inspección de espacio confinado, auditoría de seguridad).
 * Los equipos que no se pueden usar se muestran deshabilitados con el motivo: no se ocultan. El módulo que lo consume
 * vuelve a validar con `checkInstrumentForUse` en el servidor antes de guardar.
 */
export function InstrumentPicker({ instruments, name, label = "Equipo de medición", hint, required, defaultValue, placeholder = "Elegí un equipo" }: InstrumentPickerProps) {
  return (
    <Field label={label} hint={hint} required={required}>
      <select name={name} required={required} defaultValue={defaultValue ?? ""} className={INPUT_CLASS}>
        <option value="" disabled={required}>
          {placeholder}
        </option>
        {instruments.map((i) => (
          <option key={i.id} value={i.id} disabled={!i.usability.usable}>
            {i.code} · {i.description}
            {i.siteName ? ` · ${i.siteName}` : ""}
            {i.usability.usable ? "" : ` — No usar: ${i.usability.reason ?? "no disponible"}`}
          </option>
        ))}
      </select>
    </Field>
  );
}
