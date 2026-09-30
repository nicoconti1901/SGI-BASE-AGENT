"use client";

import { useEffect, useRef, useTransition } from "react";

/**
 * React 19 vacía el formulario tras cada action: con un error de validación se
 * perdería lo que la persona escribió. Enviar por onSubmit conserva los valores;
 * `resetOnSuccess` los limpia solo cuando el formulario agrega algo (subir un
 * archivo, registrar un hallazgo).
 */
export function useKeepInputs(
  action: (formData: FormData) => void,
  state: { ok?: string },
  options: { resetOnSuccess?: boolean } = {},
) {
  const [, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  const reset = options.resetOnSuccess ?? false;

  useEffect(() => {
    if (reset && state.ok) ref.current?.reset();
  }, [reset, state]);

  return {
    ref,
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      start(() => action(data));
    },
  };
}
