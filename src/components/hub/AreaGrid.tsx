import Link from "next/link";
import type { HubArea, HubModuleTile } from "@/domain/modules/hub";
import { HubIcon } from "./HubIcon";
import { ORBIT_RADIUS, orbitPoints } from "./orbit";

/** Mapa chico de la órbita del área: acompaña a la lista y marca el módulo que tiene el mouse o el foco. */
function OrbitGuide({ modules, number }: { modules: HubModuleTile[]; number: string }) {
  const points = orbitPoints(modules.length);
  return (
    <div className="sgi-guide" aria-hidden>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <circle className="sgi-guide-ring" cx="50" cy="50" r={ORBIT_RADIUS} />
        {points.map((p, i) => (
          <line key={modules[i].key} className="sgi-guide-spoke" x1="50" y1="50" x2={p.x} y2={p.y} />
        ))}
      </svg>
      <span className="sgi-guide-core font-[family-name:var(--font-mono)] text-xs tabular-nums">
        {number}
      </span>
      {modules.map((m, i) => (
        <span
          key={m.key}
          className="sgi-guide-dot"
          data-i={i}
          style={{ left: `${points[i].x}%`, top: `${points[i].y}%` }}
        >
          <HubIcon name={m.icon} className="h-3.5 w-3.5" />
        </span>
      ))}
    </div>
  );
}

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
                  className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight"
                >
                  {area.label}
                </h2>
              </div>
              <p className="text-sm text-[var(--color-hub-ink-muted)]">{area.tagline}</p>
            </div>
            <div className="sgi-area-body">
              <OrbitGuide modules={area.modules} number={number} />
              <ul className="sgi-area-list">
                {area.modules.map((m, i) => (
                  <li key={m.key}>
                    <Link href={m.href} className="sgi-area-row" data-i={i}>
                      <HubIcon name={m.icon} className="sgi-area-icon h-5 w-5" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium leading-snug">{m.label}</span>
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
