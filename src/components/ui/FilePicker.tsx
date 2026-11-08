"use client";

import { forwardRef, useCallback, useEffect, useState, type ChangeEvent } from "react";

type FilePickerProps = {
  name: string;
  /** Para enlazar con un `Field htmlFor` (evita anidar etiquetas). */
  id?: string;
  /** Nombre accesible del input cuando el texto visible no alcanza. */
  ariaLabel?: string;
  multiple?: boolean;
  /** Texto del botón visible. */
  buttonLabel?: string;
  /** Qué se puede subir o qué pasa al elegir (ej.: "Se adjunta al elegirlo"). */
  hint?: string;
  accept?: string;
  required?: boolean;
  disabled?: boolean;
  /**
   * Archivo elegido, para mostrar nombre y tamaño en lugar de la ayuda.
   * Si no se pasa, el selector lo recuerda solo y se limpia cuando el formulario se reinicia.
   */
  file?: File | null;
  /** Texto que acompaña al archivo elegido (ej.: "adjuntando…"). */
  fileStatus?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
};

export function formatFileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Selector de archivo con botón siempre visible (el input nativo queda oculto pero accesible).
 * Toda la franja es clickeable y recibe el foco del input.
 */
export const FilePicker = forwardRef<HTMLInputElement, FilePickerProps>(function FilePicker(
  { name, id, ariaLabel, multiple, buttonLabel = "Elegir archivo", hint, accept, required, disabled, file, fileStatus, onChange },
  ref,
) {
  const [picked, setPicked] = useState<File[]>([]);
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      setInput(node);
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  useEffect(() => {
    const form = input?.form;
    if (!form) return;
    const clear = () => setPicked([]);
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, [input]);

  const shown = file !== undefined ? file : picked.length === 1 ? picked[0] : null;
  const many = file === undefined && picked.length > 1 ? `${picked.length} archivos elegidos` : null;
  return (
    <label
      className={`flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-3 focus-within:border-[var(--color-accent)] focus-within:shadow-[0_0_0_3px_var(--color-accent-ring)] ${
        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-[var(--color-accent)]"
      }`}
    >
      <input
        ref={setRefs}
        id={id}
        type="file"
        name={name}
        aria-label={ariaLabel}
        multiple={multiple}
        accept={accept}
        required={required}
        disabled={disabled}
        onChange={(e) => {
          setPicked(Array.from(e.target.files ?? []));
          onChange?.(e);
        }}
        className="sr-only"
      />
      <span className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-3 text-sm font-semibold text-[var(--color-accent-ink)]">
        {buttonLabel}
      </span>
      <span className="min-w-0 flex-1 text-sm text-[var(--color-ink-muted)]">
        {shown ? (
          <>
            <span className="break-all font-medium text-[var(--color-ink)]">{shown.name}</span>
            {` · ${formatFileSize(shown.size)}`}
            {fileStatus ? ` · ${fileStatus}` : ""}
          </>
        ) : (
          many ?? hint
        )}
      </span>
    </label>
  );
});
