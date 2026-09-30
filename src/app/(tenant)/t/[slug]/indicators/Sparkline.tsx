/** Mini tendencia sin ejes; la meta va como línea de referencia. `values` en orden cronológico. */
export function Sparkline({
  values,
  target,
  label,
}: {
  values: number[];
  target: number;
  label: string;
}) {
  if (values.length === 0) return null;
  const W = 96;
  const H = 28;
  const pad = 3;
  const all = [...values, target];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) => pad + (values.length === 1 ? (W - pad * 2) / 2 : (i / (values.length - 1)) * (W - pad * 2));
  const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} className="shrink-0">
      <line x1={pad} x2={W - pad} y1={y(target)} y2={y(target)} stroke="var(--color-success)" strokeWidth="1" strokeDasharray="3 3" />
      <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="2.5" fill="var(--color-accent)" />
    </svg>
  );
}
