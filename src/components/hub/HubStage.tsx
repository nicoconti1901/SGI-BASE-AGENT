import { Children } from "react";
import Link from "next/link";
import { HubIcon } from "@/components/hub/HubIcon";
import type { HubIconName } from "@/domain/modules/hub";

/** Aro, cara de vidrio y brillo superior de un hexágono plano (viewBox 200×174). */
const HEX_OUTER = "50,3 150,3 197,87 150,171 50,171 3,87";
const HEX_INNER = "56,13 144,13 185.5,87 144,161 56,161 14.5,87";
const HEX_SHEEN = "56,13 144,13 185.5,87 14.5,87";

/** Escena de fondo: anillos de órbita y pistas de circuito. Define los degradés que usan los hexágonos. */
function StageArt() {
  return (
    <svg
      className="sgi-stage-art"
      viewBox="0 0 1200 720"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="sgi-hub-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--color-hub-metal)" }} />
          <stop offset="0.38" style={{ stopColor: "var(--color-hub-metal-dark)" }} />
          <stop offset="0.6" style={{ stopColor: "var(--color-hub-metal)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-hub-metal-dark)" }} />
        </linearGradient>
        <linearGradient id="sgi-hub-glass" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0"
            style={{
              stopColor:
                "color-mix(in srgb, var(--color-hub-glow) 24%, var(--color-hub-face))",
            }}
          />
          <stop offset="0.55" style={{ stopColor: "var(--color-hub-face)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-hub-face)" }} />
        </linearGradient>
        <linearGradient id="sgi-hub-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0"
            style={{ stopColor: "var(--color-hub-ink)", stopOpacity: 0.16 }}
          />
          <stop
            offset="1"
            style={{ stopColor: "var(--color-hub-ink)", stopOpacity: 0 }}
          />
        </linearGradient>
      </defs>
      <g fill="none">
        <ellipse
          cx="600"
          cy="480"
          rx="640"
          ry="196"
          style={{ stroke: "var(--color-hub-glow)" }}
          strokeOpacity="0.12"
          strokeWidth="10"
        />
        <ellipse
          cx="600"
          cy="480"
          rx="560"
          ry="170"
          style={{ stroke: "var(--color-hub-line)" }}
          strokeWidth="1.5"
        />
        <ellipse
          className="sgi-orbit"
          cx="600"
          cy="480"
          rx="470"
          ry="142"
          style={{ stroke: "var(--color-hub-glow)" }}
          strokeOpacity="0.6"
          strokeWidth="2"
          strokeDasharray="3 12"
        />
        <ellipse
          cx="600"
          cy="480"
          rx="380"
          ry="114"
          style={{ stroke: "var(--color-hub-glow-2)" }}
          strokeOpacity="0.35"
          strokeWidth="1.25"
        />
      </g>
      <g
        fill="none"
        style={{ stroke: "var(--color-hub-line)" }}
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        <path d="M1200 300H1110L1070 340H1010" />
        <path d="M0 612H118L168 562H262" />
        <path d="M1200 140H1040L1000 180H896" />
        <path d="M1200 560H1080L1030 610H936" />
        <path d="M870 720V662L828 620H780" />
      </g>
      <g
        fill="none"
        style={{ stroke: "var(--color-hub-glow)" }}
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path className="sgi-trace" d="M1200 300H1110L1070 340H1010" />
        <path className="sgi-trace" d="M1200 140H1040L1000 180H896" />
      </g>
      <g
        style={{ fill: "var(--color-hub-stage)", stroke: "var(--color-hub-glow)" }}
        strokeWidth="1.5"
      >
        {[
          [1010, 340],
          [262, 562],
          [896, 180],
          [936, 610],
          [780, 620],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" />
        ))}
      </g>
    </svg>
  );
}

/** Consola oscura del hub (en ambos temas). Va una sola por página: aloja los degradés de los hexágonos. */
export function HubStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="sgi-stage">
      <StageArt />
      <div className="flex flex-col gap-8 px-4 py-6 sm:px-8 sm:py-8">{children}</div>
    </div>
  );
}

/** Dónde está parado el usuario en el ingreso: 1 elegir módulo, 2 elegir qué hacer. */
export function HubSteps({
  current,
  moduleLabel,
}: {
  current: 1 | 2;
  moduleLabel?: string;
}) {
  const steps = [
    { n: 1, label: "Elegí el módulo" },
    {
      n: 2,
      label: moduleLabel ? `Elegí qué hacer en ${moduleLabel}` : "Elegí qué hacer",
    },
  ] as const;
  return (
    <ol
      aria-label="Cómo entrar"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em]"
    >
      {steps.map((step, i) => {
        const active = step.n === current;
        return (
          <li
            key={step.n}
            aria-current={active ? "step" : undefined}
            className="flex items-center gap-3"
          >
            {i > 0 ? (
              <span
                aria-hidden
                className="hidden h-px w-6 bg-[var(--color-hub-line)] sm:block"
              />
            ) : null}
            <span
              className={`inline-flex items-center gap-2 rounded-[var(--radius-sm)] border px-2.5 py-1 ${
                active
                  ? "border-[var(--color-hub-glow)] text-[var(--color-hub-ink)]"
                  : "border-[var(--color-hub-line)] text-[var(--color-hub-ink-muted)]"
              }`}
            >
              <span className={active ? "text-[var(--color-hub-glow)]" : undefined}>
                0{step.n}
              </span>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Fila de hexágonos unidos por el conducto; cada hexágono es un ítem de la lista. */
export function HexBus({
  children,
  size = "md",
}: {
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
  // Columnas por fila para que ninguna fila quede con un solo hexágono suelto.
  const count = Children.count(children);
  const cols = count <= 3 ? Math.max(count, 1) : count === 4 ? 2 : Math.ceil(count / Math.ceil(count / 4));
  return (
    <ul className="sgi-bus" data-size={size} style={{ "--bus-cols": cols } as React.CSSProperties}>
      {children}
    </ul>
  );
}

type HexTileProps = {
  href: string;
  label: string;
  icon: HubIconName;
  /** Línea corta debajo del nombre: cláusulas o qué hay adentro. */
  detail?: string;
  /** Posición en la lista, para escalonar la entrada. */
  index?: number;
};

/** Las palabras largas ("Automatizaciones") bajan de cuerpo para entrar en el hexágono. */
function labelFit(label: string): "md" | "sm" | undefined {
  const longest = Math.max(...label.split(/\s+/).map((word) => word.length));
  return longest >= 14 ? "sm" : longest >= 12 ? "md" : undefined;
}

export function HexTile({ href, label, icon, detail, index = 0 }: HexTileProps) {
  return (
    <li className="sgi-enter" style={{ "--sgi-i": index } as React.CSSProperties}>
      <Link href={href} className="sgi-hex">
        <svg className="sgi-hex-shape" viewBox="0 0 200 174" aria-hidden>
          <polygon className="sgi-hex-rim" points={HEX_OUTER} strokeLinejoin="round" />
          <polygon className="sgi-hex-sheen" points={HEX_SHEEN} />
          <polygon className="sgi-hex-inner" points={HEX_INNER} />
        </svg>
        <span aria-hidden className="sgi-hex-port" data-side="l" />
        <span aria-hidden className="sgi-hex-port" data-side="r" />
        <span className="relative flex w-[62%] flex-col items-center gap-1.5">
          <HubIcon
            name={icon}
            className="h-6 w-6 text-[var(--color-hub-glow)] sm:h-7 sm:w-7"
          />
          <span
            className="sgi-hex-label font-[family-name:var(--font-display)] font-semibold uppercase leading-tight"
            data-fit={labelFit(label)}
          >
            {label}
          </span>
          {detail ? (
            <span className="line-clamp-3 break-words font-[family-name:var(--font-mono)] text-[10px] leading-snug text-[var(--color-hub-ink-muted)] tabular-nums">
              {detail}
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}
