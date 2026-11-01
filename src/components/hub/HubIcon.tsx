import type { HubIconName } from "@/domain/modules/hub";

/** Íconos de trazo 1.5px en grilla de 24 para los hexágonos del hub. Decorativos: siempre aria-hidden. */
const PATHS: Record<HubIconName, React.ReactNode> = {
  documents: (
    <>
      <path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5L14 3Z" />
      <path d="M14 3v4.5h4.5M9 12h6M9 15.5h6M9 8.5h2" />
    </>
  ),
  audits: (
    <>
      <path d="M9 4.5H6.5A1.5 1.5 0 0 0 5 6v13.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H15" />
      <rect x="9" y="3" width="6" height="3" rx="1" />
      <path d="m8.75 13.5 2.25 2.25 4.25-4.5" />
    </>
  ),
  findings: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5M10.5 7.5v3.75M10.5 13.6v.1" />
    </>
  ),
  risks: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="M12 8.5v4.25M12 15.6v.1" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  inspections: (
    <>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="M7 12s1.9-3.5 5-3.5 5 3.5 5 3.5-1.9 3.5-5 3.5S7 12 7 12Z" />
      <circle cx="12" cy="12" r="1.25" />
    </>
  ),
  gauge: (
    <>
      <path d="M4.2 17a8.5 8.5 0 1 1 15.6 0" />
      <path d="m12 14 4-5M12 14v.01M7 13.5h.01M8.5 9h.01M12 7.25v.01M17 13.5h.01" />
    </>
  ),
  pulse: (
    <>
      <path d="M3 12h4l2-5 3.5 10 2.5-7 1.5 2H21" />
    </>
  ),
  road: (
    <>
      <path d="M8 3 4 21M16 3l4 18M12 4v2.5M12 10.5v3M12 17.5V20" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.75" />
      <path d="M5 6v12c0 1.5 3.1 2.75 7 2.75s7-1.25 7-2.75V6M5 12c0 1.5 3.1 2.75 7 2.75S19 13.5 19 12" />
    </>
  ),
  training: (
    <>
      <path d="m12 4.5 9.5 4.5-9.5 4.5L2.5 9 12 4.5Z" />
      <path d="M6.5 11v4.5c0 1.4 2.5 2.75 5.5 2.75s5.5-1.35 5.5-2.75V11M21.5 9v5" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6.5h10.5V16H3zM13.5 9.5h4l3 3.25V16h-7" />
      <circle cx="7" cy="17.25" r="1.75" />
      <circle cx="17" cy="17.25" r="1.75" />
    </>
  ),
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />,
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.25" />
      <path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
      <path d="M15.5 5.6a3.25 3.25 0 0 1 0 5.8M17.5 14.8c1.9.6 3.1 2.2 3.5 4.7" />
    </>
  ),
  list: (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <path d="M4 6.5h.01M4 12h.01M4 17.5h.01" />
    </>
  ),
  plus: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v16h16" />
      <path d="m7.5 15 3.5-4 3 2.5 5-6" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="1.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  check: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m8.75 12.25 2.25 2.25 4.25-4.5" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8 12 3.5Z" />
      <path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.25" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3.5" y="7" width="17" height="12.5" rx="1.5" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" />
    </>
  ),
  wrench: (
    <path d="M14.5 4.2a4.5 4.5 0 0 0-5.3 5.9L3.8 15.5a1.8 1.8 0 0 0 2.5 2.5l5.4-5.4a4.5 4.5 0 0 0 5.9-5.3l-2.7 2.7-2.4-.4-.4-2.4 2.4-2.7Z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  sliders: (
    <>
      <path d="M5 4v5M5 13v7M12 4v9M12 17v3M19 4v3M19 11v9" />
      <path d="M3 11h4M10 15h4M17 9h4" />
    </>
  ),
  star: (
    <path d="m12 3.5 2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
  ),
  field: (
    <>
      <path d="M4.5 15.5a7.5 7.5 0 0 1 15 0" />
      <path d="M3 15.5h18v2H3zM10 8.3V6.5h4v1.8" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5Z" />
    </>
  ),
};

export function HubIcon({
  name,
  className = "h-7 w-7",
}: {
  name: HubIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
