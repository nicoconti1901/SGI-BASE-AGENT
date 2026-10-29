import type { ReactNode } from "react";

const fmt = (n: number, d = 2) => n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

const CARD = "flex flex-col gap-1.5 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4 shadow-[var(--shadow-card)]";
const EYEBROW = "font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]";
const BIG = "font-[family-name:var(--font-display)] text-[1.75rem] font-semibold leading-tight tabular-nums";

/** Un número con su título y una línea de ayuda. «Sin datos» va atenuado: nunca se muestra 0 por falta de dato. */
export function StatCard({ title, value, help }: { title: string; value: string; help: string }) {
  const muted = value === "Sin datos";
  return (
    <article className={CARD}>
      <h3 className={EYEBROW}>{title}</h3>
      <p className={`${BIG} ${muted ? "text-[var(--color-ink-muted)]" : ""}`}>{value}</p>
      <p className="text-xs text-[var(--color-ink-muted)]">{help}</p>
    </article>
  );
}

/** Resultado final: un conteo absoluto (muertes, lesionados graves). */
export function ResultCard({ title, value, help }: { title: string; value: number; help: string }) {
  return <StatCard title={title} value={value.toLocaleString("es-AR")} help={help} />;
}

type RateCardProps = {
  title: string;
  status: ReactNode;
  events: number | null;
  injury: number | null;
  rollovers: number | null;
  totalKm: number;
  /** Vehículos-mes sin km, para el aviso «parcial»; `null` si el período está completo. */
  partial: string[] | null;
  lowExposure: boolean;
  /** Hechos que entraron en la tasa: el número absoluto detrás del cociente. */
  absolute: number;
};

/** Tasas de un período: hechos, con lesionados y vuelcos por millón de km, con su estado. */
export function RateCard({ title, status, events, injury, rollovers, totalKm, partial, lowExposure, absolute }: RateCardProps) {
  const value = (n: number | null) => (n === null ? "Sin datos" : fmt(n));
  return (
    <article className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={EYEBROW}>{title}</h3>
        {status}
      </div>
      <p className={`${BIG} ${events === null ? "text-[var(--color-ink-muted)]" : ""}`}>{value(events)}</p>
      <p className="text-xs text-[var(--color-ink-muted)]">hechos por millón de km</p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-[var(--color-ink-muted)]">Con lesionados</dt>
          <dd className="tabular-nums">{value(injury)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-ink-muted)]">Vuelcos</dt>
          <dd className="tabular-nums">{value(rollovers)}</dd>
        </div>
      </dl>
      <p className="text-xs text-[var(--color-ink-muted)]">
        {totalKm > 0 ? `${absolute} hecho(s) en ${totalKm.toLocaleString("es-AR")} km` : "Sin km cargados en el período."}
      </p>
      {partial && partial.length > 0 ? (
        <p className="text-xs text-[var(--color-warning)]">
          Parcial: falta {partial.slice(0, 3).join(", ")}
          {partial.length > 3 ? ` y ${partial.length - 3} más` : ""}.
        </p>
      ) : null}
      {lowExposure ? <p className="text-xs text-[var(--color-ink-muted)]">Poca exposición: mirá el número absoluto.</p> : null}
    </article>
  );
}
