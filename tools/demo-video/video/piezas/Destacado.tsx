// Destacado sobre la captura: contorno del color del tono, pastilla con ícono y texto, y una flecha hacia el elemento.
import {
  Calendar,
  Clock,
  Disc,
  Eye,
  FileImage,
  GraduationCap,
  Hand,
  Heart,
  Image as Imagen,
  Layers,
  ListChecks,
  LogIn,
  Mail,
  MapPin,
  MessageCircle,
  Music,
  Navigation,
  Route,
  Send,
  Share,
  Sparkles,
  Stamp,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fuentes } from "../fuentes";
import type { Caja, DestacadoLinea } from "../linea";
import { ALTO, ANCHO, colorDeTono } from "../tema";

export const ICONOS: Record<string, LucideIcon> = {
  calendar: Calendar,
  clock: Clock,
  disc: Disc,
  eye: Eye,
  "file-image": FileImage,
  "graduation-cap": GraduationCap,
  hand: Hand,
  heart: Heart,
  image: Imagen,
  layers: Layers,
  "list-checks": ListChecks,
  "log-in": LogIn,
  mail: Mail,
  "map-pin": MapPin,
  "message-circle": MessageCircle,
  music: Music,
  navigation: Navigation,
  route: Route,
  send: Send,
  share: Share,
  sparkles: Sparkles,
  stamp: Stamp,
  ticket: Ticket,
  users: Users,
};

const limitar = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const HOLGURA = 10;
const ALTO_PASTILLA = 66;
const FLECHA = 46;

export type Limites = { x: number; y: number; w: number; h: number };

/** Pastilla sola (sin contorno ni flecha), para usarla también al costado del teléfono. */
export const Pastilla: React.FC<{ d: DestacadoLinea; style?: React.CSSProperties }> = ({ d, style }) => {
  const Icono = d.icono ? ICONOS[d.icono] : undefined;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        height: ALTO_PASTILLA,
        boxSizing: "border-box",
        padding: "0 26px",
        borderRadius: 12,
        backgroundColor: colorDeTono[d.tono].fondo,
        color: colorDeTono[d.tono].texto,
        fontFamily: fuentes.texto,
        fontWeight: 600,
        fontSize: 32,
        letterSpacing: "0.01em",
        boxShadow: "0 10px 28px rgba(0,0,0,0.55)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {Icono ? <Icono size={34} strokeWidth={2.2} /> : null}
      {d.texto}
    </div>
  );
};

/** Opacidad y escala de entrada y salida de un destacado en el cuadro actual (0 si no se ve). */
export function presenciaDe(d: DestacadoLinea, f: number, fps: number) {
  if (f < d.desdeCuadro || f >= d.hastaCuadro) return 0;
  const entrada = spring({ frame: f - d.desdeCuadro, fps, config: { damping: 16, stiffness: 170 }, durationInFrames: 12 });
  const salida = interpolate(f, [d.hastaCuadro - 8, d.hastaCuadro], [1, 0], limitar);
  return Math.min(entrada, salida);
}

/**
 * `columna`: si viene, la pastilla va siempre a la derecha, desde esa x como mínimo (teléfono), y la caja se recorta a
 * lo visible de `limites` para que la flecha llegue al borde de la pantalla y no al de una caja que se sale.
 */
export const Destacado: React.FC<{ d: DestacadoLinea; aPantalla: (caja: Caja) => Caja; limites: Limites; columna?: number }> = ({
  d,
  aPantalla,
  limites,
  columna,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const presencia = presenciaDe(d, f, fps);
  if (presencia <= 0 || !d.caja) return null;
  const color = colorDeTono[d.tono].fondo;
  const c = columna === undefined ? aPantalla(d.caja) : recortar(aPantalla(d.caja), limites);
  const caja = { x: c.x - HOLGURA, y: c.y - HOLGURA, w: c.w + 2 * HOLGURA, h: c.h + 2 * HOLGURA };
  const ancho = d.texto.length * 17.5 + (d.icono ? 104 : 56);
  const lado = columna === undefined ? ladoDePastilla(caja, ancho, limites) : "derecha";
  const { pastilla, flecha } = geometria(lado, caja, ancho, limites, columna);
  const origen = { arriba: "50% 100%", abajo: "50% 0%", izquierda: "100% 50%", derecha: "0% 50%", adentro: "50% 0%" }[lado];

  return (
    <div style={{ position: "absolute", inset: 0, opacity: presencia }}>
      <div
        style={{
          position: "absolute",
          left: caja.x,
          top: caja.y,
          width: caja.w,
          height: caja.h,
          boxSizing: "border-box",
          border: `4px solid ${color}`,
          borderRadius: 12,
          boxShadow: `0 0 0 9999px rgba(10, 7, 8, ${0.28 * presencia}), 0 0 26px ${color}66`,
        }}
      />
      {flecha ? (
        <svg style={{ position: "absolute", inset: 0, overflow: "visible" }} width={ANCHO} height={ALTO}>
          <line x1={flecha.x1} y1={flecha.y1} x2={flecha.x2 - flecha.ux * 12} y2={flecha.y2 - flecha.uy * 12} stroke={color} strokeWidth={4} strokeLinecap="round" />
          <path
            d={`M ${flecha.x2 - flecha.ux * 14 - flecha.uy * 11} ${flecha.y2 - flecha.uy * 14 + flecha.ux * 11} L ${flecha.x2} ${flecha.y2} L ${flecha.x2 - flecha.ux * 14 + flecha.uy * 11} ${flecha.y2 - flecha.uy * 14 - flecha.ux * 11} Z`}
            fill={color}
          />
        </svg>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: pastilla.x,
          top: pastilla.y,
          width: ancho,
          display: "flex",
          justifyContent: "center",
          transform: `scale(${0.85 + 0.15 * presencia})`,
          transformOrigin: origen,
        }}
      >
        <Pastilla d={d} />
      </div>
    </div>
  );
};

type Lado = "arriba" | "abajo" | "izquierda" | "derecha" | "adentro";
type Rect = { x: number; y: number; w: number; h: number };

/** Dónde entra la pastilla: arriba o abajo de la caja si hay lugar; si no, a un costado; si no, adentro. */
function ladoDePastilla(caja: Rect, ancho: number, limites: Limites): Lado {
  if (caja.y - FLECHA - ALTO_PASTILLA > limites.y + 12) return "arriba";
  if (caja.y + caja.h + FLECHA + ALTO_PASTILLA < limites.y + limites.h - 12) return "abajo";
  if (caja.x - FLECHA - ancho > limites.x + 12) return "izquierda";
  if (caja.x + caja.w + FLECHA + ancho < limites.x + limites.w - 12) return "derecha";
  return "adentro";
}

const entre = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** La parte de `caja` que cae dentro de `limites` (al menos 1 px, para no perder la flecha). */
function recortar(caja: Rect, limites: Limites): Rect {
  const x1 = entre(caja.x, limites.x, limites.x + limites.w);
  const y1 = entre(caja.y, limites.y, limites.y + limites.h);
  const x2 = entre(caja.x + caja.w, limites.x, limites.x + limites.w);
  const y2 = entre(caja.y + caja.h, limites.y, limites.y + limites.h);
  return { x: x1, y: y1, w: Math.max(1, x2 - x1), h: Math.max(1, y2 - y1) };
}

function geometria(lado: Lado, caja: Rect, ancho: number, limites: Limites, columna?: number) {
  // Centro vertical de la parte visible de la caja (puede pasarse del cuadro).
  const visibleY = (Math.max(caja.y, limites.y) + Math.min(caja.y + caja.h, limites.y + limites.h)) / 2;
  const centroX = entre(caja.x + caja.w / 2, limites.x + 20 + ancho / 2, limites.x + limites.w - 20 - ancho / 2);
  const xFlecha = entre(caja.x + caja.w / 2, centroX - ancho / 2 + 30, centroX + ancho / 2 - 30);
  switch (lado) {
    case "arriba": {
      const y = caja.y - FLECHA - ALTO_PASTILLA;
      return { pastilla: { x: centroX - ancho / 2, y }, flecha: { x1: xFlecha, y1: y + ALTO_PASTILLA + 4, x2: xFlecha, y2: caja.y - 6, ux: 0, uy: 1 } };
    }
    case "abajo": {
      const y = caja.y + caja.h + FLECHA;
      return { pastilla: { x: centroX - ancho / 2, y }, flecha: { x1: xFlecha, y1: y - 4, x2: xFlecha, y2: caja.y + caja.h + 6, ux: 0, uy: -1 } };
    }
    case "izquierda": {
      const x = caja.x - FLECHA - ancho;
      return { pastilla: { x, y: visibleY - ALTO_PASTILLA / 2 }, flecha: { x1: x + ancho + 4, y1: visibleY, x2: caja.x - 6, y2: visibleY, ux: 1, uy: 0 } };
    }
    case "derecha": {
      const x = Math.max(caja.x + caja.w + FLECHA, columna ?? 0);
      const y = entre(visibleY, ALTO_PASTILLA / 2 + 24, ALTO - ALTO_PASTILLA / 2 - 24);
      return { pastilla: { x, y: y - ALTO_PASTILLA / 2 }, flecha: { x1: x - 4, y1: y, x2: caja.x + caja.w + 6, y2: y, ux: -1, uy: 0 } };
    }
    default:
      return { pastilla: { x: centroX - ancho / 2, y: Math.max(caja.y, limites.y) + 20 }, flecha: null };
  }
}
