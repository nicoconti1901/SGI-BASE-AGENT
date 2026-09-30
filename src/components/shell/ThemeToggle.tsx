"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@/components/ui/icons";

type Theme = "light" | "dark";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const getSnapshot = (): Theme =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";
const getServerSnapshot = (): Theme => "light";

/** Alterna Light A / Dark A. El tema inicial lo fija el script del layout (preferencia guardada o sistema). */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("sgi-theme", next);
    } catch {
      // Sin almacenamiento: el cambio vale solo para esta sesión.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={next === "dark" ? "Cambiar a tema oscuro" : "Cambiar a tema claro"}
      title={next === "dark" ? "Tema oscuro" : "Tema claro"}
      className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] text-[var(--color-ink)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-[var(--color-surface-sunken)]"
    >
      {theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </button>
  );
}
