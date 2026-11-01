/** Radio de la órbita guía, en % del lado del diagrama (deja lugar a los puntos dentro del cuadro). */
export const ORBIT_RADIUS = 36.5;

/** Centro de cada módulo en la órbita, en % del diagrama: el primero arriba y el resto en sentido horario. */
export function orbitPoints(count: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = ((-90 + (360 / count) * i) * Math.PI) / 180;
    return {
      x: 50 + ORBIT_RADIUS * Math.cos(angle),
      y: 50 + ORBIT_RADIUS * Math.sin(angle),
    };
  });
}
