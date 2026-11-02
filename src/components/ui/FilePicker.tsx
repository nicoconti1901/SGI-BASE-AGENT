"use client";

import { forwardRef, type ChangeEvent } from "react";

type FilePickerProps = {
  name: string;
  /** Texto del botón visible. */
  buttonLabel?: string;
  /** Qué se puede subir o qué pasa al elegir (ej.: "Se adjunta al elegirlo"). */
  hint?: string;
  accept?: string;
  required?: boolean;
  disabled?: boolean;
  /** Archivo elegido, para mostrar nombre y tamaño en lugar de la ayuda. */
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
  { name, buttonLabel = "Elegir archivo", hint, accept, required, disabled, file, fileStatus, onChange },
  ref,
) {
  return (
    <label
      className={`flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-3 focus-within:border-[var(--color-accent)] focus-within:shadow-[0_0_0_3px_var(--color-accent-ring)] ${
        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-[var(--color-accent)]"
      }`}
    >
      <input
        ref={ref}
        type="file"
        name={name}
        accept={accept}
        required={required}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
      <span className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-3 text-sm font-semibold text-[var(--color-accent-ink)]">
        {buttonLabel}
      </span>
      <span className="min-w-0 flex-1 text-sm text-[var(--color-ink-muted)]">
        {file ? (
          <>
            <span className="break-all font-medium text-[var(--color-ink)]">{file.name}</span>
            {` · ${formatFileSize(file.size)}`}
            {fileStatus ? ` · ${fileStatus}` : ""}
          </>
        ) : (
          hint
        )}
      </span>
    </label>
  );
});
