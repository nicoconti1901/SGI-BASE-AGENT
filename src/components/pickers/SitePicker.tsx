import { Field, INPUT_CLASS } from "@/components/ui";

type SitePickerProps = {
  /** Sedes activas de la empresa (`listSites`). Las dadas de baja no se ofrecen. */
  sites: { id: string; name: string }[];
  name: string;
  label?: string;
  hint?: string;
  required?: boolean;
  /** Valor inicial (no controlado). */
  defaultValue?: string;
  /** Valor controlado; usar junto con `onChange`. */
  value?: string;
  onChange?: (siteId: string) => void;
  /** Si se pasa, agrega una primera opción vacía con este texto (p. ej. "Todas"). */
  allLabel?: string;
  /** Texto de la opción vacía cuando el campo es obligatorio. */
  placeholder?: string;
};

/** Selector de sede reutilizable: formularios y filtros de los demás módulos eligen sedes desde acá. */
export function SitePicker({
  sites,
  name,
  label = "Sede",
  hint,
  required,
  defaultValue,
  value,
  onChange,
  allLabel,
  placeholder = "Elegí una sede",
}: SitePickerProps) {
  const controlled = value !== undefined;
  return (
    <Field label={label} hint={hint} required={required}>
      <select
        name={name}
        required={required}
        {...(controlled ? { value, onChange: (e) => onChange?.(e.target.value) } : { defaultValue: defaultValue ?? "" })}
        className={INPUT_CLASS}
      >
        {allLabel !== undefined ? (
          <option value="">{allLabel}</option>
        ) : (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
