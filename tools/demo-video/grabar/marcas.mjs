/**
 * Registro de lo que pasa en cada toma: inicio, lista, voz, destacados, cursor y velocidades, con su hora (segundos epoch,
 * la misma base que las marcas de tiempo del screencast). `registrar` completa la escena actual y la hora si faltan.
 */
export function crearMarcas(eventosPrevios = []) {
  const eventos = [...eventosPrevios];
  let escena = null;
  return {
    eventos,
    enEscena(id) {
      escena = id;
    },
    registrar(evento) {
      eventos.push({ escena, t: Date.now() / 1000, ...evento });
    },
    aJson(capturas) {
      return { capturas, eventos: [...eventos].sort((a, b) => a.t - b.t) };
    },
  };
}
