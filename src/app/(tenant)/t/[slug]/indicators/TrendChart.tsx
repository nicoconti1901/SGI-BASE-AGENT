type Point = { label: string; value: number };

const W = 640;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

/** Tendencia de los últimos períodos con la meta y el umbral de alerta como referencias. */
export function TrendChart({
  points,
  target,
  alertThreshold,
  unit,
}: {
  points: Point[];
  target: number;
  alertThreshold: number | null;
  unit: string;
}) {
  if (points.length === 0) return null;
  const values = [...points.map((p) => p.value), target, ...(alertThreshold !== null ? [alertThreshold] : [])];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const lo = min - span * 0.1;
  const hi = max + span * 0.1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * innerH;
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const summary = `Tendencia de ${points.length} períodos, de ${fmt(points[0].value)} a ${fmt(points[points.length - 1].value)} ${unit}. Meta ${fmt(target)}.`;

  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="w-full">
        <line x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} stroke="var(--color-success)" strokeWidth="1.5" strokeDasharray="6 4" />
        <text x={W - PAD.right} y={y(target) - 4} textAnchor="end" fontSize="11" fill="var(--color-success)">
          Meta {fmt(target)}
        </text>
        {alertThreshold !== null ? (
          <>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(alertThreshold)} y2={y(alertThreshold)} stroke="var(--color-warning)" strokeWidth="1.5" strokeDasharray="2 4" />
            <text x={W - PAD.right} y={y(alertThreshold) - 4} textAnchor="end" fontSize="11" fill="var(--color-warning)">
              Alerta {fmt(alertThreshold)}
            </text>
          </>
        ) : null}
        <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="2" />
        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={x(i)} cy={y(p.value)} r="4" fill="var(--color-accent)">
              <title>{`${p.label}: ${fmt(p.value)} ${unit}`}</title>
            </circle>
            {points.length <= 8 || i === 0 || i === points.length - 1 ? (
              <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--color-ink-muted)">
                {p.label}
              </text>
            ) : null}
          </g>
        ))}
        <text x={PAD.left - 6} y={y(hi) + 10} textAnchor="end" fontSize="10" fill="var(--color-ink-muted)">
          {fmt(hi)}
        </text>
        <text x={PAD.left - 6} y={y(lo)} textAnchor="end" fontSize="10" fill="var(--color-ink-muted)">
          {fmt(lo)}
        </text>
      </svg>
    </figure>
  );
}
