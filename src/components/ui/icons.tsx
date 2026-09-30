/** Set único de íconos de trazo 1.5px (nunca emoji). Decorativos: siempre aria-hidden. */
type IconProps = { className?: string };

function Svg({ className = "h-3 w-3", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function CheckCircleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="m5.25 8.25 1.9 1.9 3.6-4" />
    </Svg>
  );
}

export function AlertTriangleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 2.25 14.25 13H1.75L8 2.25Z" />
      <path d="M8 6.5v3M8 11.4v.1" />
    </Svg>
  );
}

export function XOctagonIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5.2 1.75h5.6l3.45 3.45v5.6l-3.45 3.45H5.2L1.75 10.8V5.2L5.2 1.75Z" />
      <path d="m6 6 4 4M10 6l-4 4" />
    </Svg>
  );
}

export function DashedCircleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="8" cy="8" r="6.25" strokeDasharray="2.2 2.2" />
    </Svg>
  );
}

export function ClockAlertIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.5V8l2.25 1.5" />
    </Svg>
  );
}

export function InfoCircleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.25v3.5M8 5.2v.1" />
    </Svg>
  );
}

export function InboxIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2 9.5 3.6 3.6a1 1 0 0 1 1-.75h6.8a1 1 0 0 1 1 .75L14 9.5v2.75a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9.5Z" />
      <path d="M2 9.5h3.25l.75 1.5h4l.75-1.5H14" />
    </Svg>
  );
}

export function ArrowIcon({ direction, className }: IconProps & { direction: "up" | "down" | "flat" }) {
  return (
    <Svg className={className}>
      {direction === "up" ? <path d="M8 13V3M4 7l4-4 4 4" /> : null}
      {direction === "down" ? <path d="M8 3v10M4 9l4 4 4-4" /> : null}
      {direction === "flat" ? <path d="M3 8h10M9 4l4 4-4 4" /> : null}
    </Svg>
  );
}

export function ChevronIcon({ direction, className }: IconProps & { direction: "left" | "right" }) {
  return (
    <Svg className={className}>
      <path d={direction === "left" ? "m10 3-5 5 5 5" : "m6 3 5 5-5 5"} />
    </Svg>
  );
}

export function SunIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="8" cy="8" r="2.75" />
      <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
    </Svg>
  );
}

export function MoonIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1Z" />
    </Svg>
  );
}
