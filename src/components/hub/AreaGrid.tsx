import Link from "next/link";
import type { HubArea } from "@/domain/modules/hub";
import { HubIcon } from "./HubIcon";

/**
 * Áreas del inicio: un panel por área (con su color arriba), la órbita como guía y la lista de módulos
 * como lo que se lee y se toca. La grilla no deja áreas sueltas a todo el ancho (ver `.sgi-areas`).
 */
export function AreaGrid({ areas }: { areas: HubArea[] }) {
  return (
    <div className="sgi-areas" data-count={areas.length}>
      {areas.map((area, ai) => {
        const number = String(ai + 1).padStart(2, "0");
        return (
          <div
            key={area.key}
            role="group"
            aria-labelledby={`area-${area.key}`}
            className="sgi-area"
            data-area={area.key}
          >
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-2.5">
                <span
                  aria-hidden
                  className="sgi-area-num font-[family-name:var(--font-mono)] text-xs tabular-nums"
                >
                  {number}
                </span>
                <h2
                  id={`area-${area.key}`}
                  className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight"
                >
                  {area.label}
                </h2>
              </div>
              <p className="text-sm text-[var(--color-hub-ink-muted)]">{area.tagline}</p>
            </div>
            <div className="sgi-area-body">
              <ul className="sgi-area-list">
                {area.modules.map((m, i) => (
                  <li key={m.key}>
                    <Link href={m.href} className="sgi-area-row" data-i={i}>
                      <span className="sgi-area-icon-tile"><HubIcon name={m.icon} className="h-5 w-5" /></span>
                      <span className="min-w-0">
                        <span className="block text-base font-medium leading-snug">{m.label}</span>
                        {m.meta ? (
                          <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-hub-ink-muted)] tabular-nums">
                            {m.meta}
                          </span>
                        ) : null}
                      </span>
                      <svg
                        aria-hidden
                        viewBox="0 0 24 24"
                        className="h-4 w-4 shrink-0 text-[var(--color-hub-ink-muted)]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}
