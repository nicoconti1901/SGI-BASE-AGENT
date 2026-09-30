"use client";

import { useEffect, useRef } from "react";
import { ChevronIcon } from "./icons";

const COMPACT_ON = 160;
const COMPACT_OFF = 80;

type DashboardStripProps = {
  children: React.ReactNode;
  "aria-label"?: string;
};

/**
 * Cinta de control superior: bloque full-width con un solo marco.
 * ≥1024px queda sticky y se compacta al bajar (se ocultan las zonas `data-strip-extra`);
 * en pantallas chicas fluye con la página.
 */
export function DashboardStrip({ children, "aria-label": ariaLabel = "Panel de control" }: DashboardStripProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const compact = el.dataset.compact === "true";
      const y = window.scrollY;
      if (!compact && y > COMPACT_ON) el.dataset.compact = "true";
      else if (compact && y < COMPACT_OFF) el.dataset.compact = "false";
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section
      ref={ref}
      aria-label={ariaLabel}
      data-compact="false"
      className="group z-20 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-card)] lg:sticky lg:top-0"
    >
      {children}
    </section>
  );
}

/** Zona de la cinta que se oculta al compactar. */
export function StripExtra({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`group-data-[compact=true]:hidden ${className}`}>{children}</div>;
}

/** Fila de KPIs: celdas con divisores, en una sola línea scrolleable si no entran. */
export function StripKpis({ children, "aria-label": ariaLabel = "Indicadores" }: { children: React.ReactNode; "aria-label"?: string }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex overflow-x-auto [&>*]:min-w-[9.5rem] [&>*]:flex-1 [&>*]:border-r [&>*]:border-[var(--color-line)] [&>*:last-child]:border-r-0"
    >
      {children}
    </div>
  );
}

type DueRailProps = {
  children: React.ReactNode;
  title?: string;
  /** Acción a la derecha del título (p. ej. "Ver todos"). */
  action?: React.ReactNode;
};

/** Carril horizontal de vencimientos: scroll-snap, flechas y foco por teclado. */
export function DueRail({ children, title = "Próximos vencimientos", action }: DueRailProps) {
  const scroller = useRef<HTMLDivElement>(null);

  function scrollBy(dir: -1 | 1) {
    const el = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * 248, behavior: reduce ? "auto" : "smooth" });
  }

  const arrow =
    "inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] text-[var(--color-ink)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-sunken)]";

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--color-line)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {action}
          <button type="button" aria-label="Vencimientos anteriores" className={arrow} onClick={() => scrollBy(-1)}>
            <ChevronIcon direction="left" className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Vencimientos siguientes" className={arrow} onClick={() => scrollBy(1)}>
            <ChevronIcon direction="right" className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scroller}
        role="region"
        aria-label={title}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]"
      >
        {children}
      </div>
    </div>
  );
}
