"use client";

import { useEffect, useId, useRef, useState } from "react";
import { INPUT_CLASS } from "@/components/ui";
import { searchPeopleAction, type PersonOption } from "@/components/pickers/picker-actions";

type PersonPickerProps = {
  slug: string;
  /** Nombre del campo oculto que viaja con el formulario (el id de la persona). */
  name: string;
  label?: string;
  hint?: string;
  required?: boolean;
  /** Limita la búsqueda a una sede (base o adicional). */
  siteId?: string;
  /** Persona ya elegida (edición). */
  defaultPerson?: PersonOption | null;
  onChange?: (person: PersonOption | null) => void;
};

/**
 * Selector de personas por nombre o legajo. Solo ofrece personas activas de la empresa;
 * el valor elegido viaja como un id en un campo oculto.
 */
export function PersonPicker({
  slug,
  name,
  label = "Persona",
  hint = "Buscá por nombre o legajo.",
  required,
  siteId,
  defaultPerson = null,
  onChange,
}: PersonPickerProps) {
  const uid = useId();
  const listId = `${uid}-list`;
  const [selected, setSelected] = useState<PersonOption | null>(defaultPerson);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return;
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const found = await searchPeopleAction(slug, { q: query, siteId });
      // Una respuesta vieja no pisa a una búsqueda más reciente.
      if (mine === seq.current) {
        setResults(found);
        setActive(0);
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open, siteId, slug]);

  function choose(person: PersonOption | null) {
    setSelected(person);
    setQuery("");
    setOpen(false);
    onChange?.(person);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label htmlFor={`${uid}-input`} className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{label}</span>
        {required ? <span className="text-xs font-normal text-[var(--color-ink-muted)]">Obligatorio</span> : null}
      </label>
      <input type="hidden" name={name} value={selected?.id ?? ""} />

      {selected ? (
        <div className="flex min-h-10 items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-field-fill)] px-3 py-2">
          <span>
            <span className="font-medium">{selected.name}</span>
            <span className="ml-2 font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
              {selected.employeeCode} · {selected.siteName}
            </span>
          </span>
          <button
            type="button"
            onClick={() => choose(null)}
            aria-label={`Quitar a ${selected.name}`}
            className="text-sm font-semibold text-[var(--color-accent)] hover:underline"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            id={`${uid}-input`}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && results[active] ? `${uid}-opt-${results[active].id}` : undefined}
            aria-required={required}
            autoComplete="off"
            value={query}
            placeholder="Ej.: Pérez o 1042"
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
            className={`${INPUT_CLASS} w-full`}
          />
          {open ? (
            <ul
              id={listId}
              role="listbox"
              aria-label={`${label}: resultados`}
              className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-soft)]"
            >
              {results.length === 0 ? (
                <li role="presentation" className="px-3 py-2 text-[var(--color-ink-muted)]">
                  {loading ? "Buscando…" : "Sin resultados. Solo se ofrecen personas activas."}
                </li>
              ) : (
                results.map((p, i) => (
                  <li
                    key={p.id}
                    id={`${uid}-opt-${p.id}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(p);
                    }}
                    className={`cursor-pointer px-3 py-2 ${i === active ? "bg-[var(--color-accent-soft)]" : ""}`}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                      {p.employeeCode} · {p.siteName}
                    </span>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      )}
      {hint ? <span className="text-xs text-[var(--color-ink-muted)]">{hint}</span> : null}
    </div>
  );
}
