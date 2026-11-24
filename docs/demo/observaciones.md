# Observaciones de la demo

- **Panel:** «Próximos vencimientos» arranca con vencimientos de 2023 («Vencido hace 1411 d») y «Cumplimiento de requisitos» marca 0 %
  (68 requisitos pendientes). Es el dato del seed de revisión; el video muestra el panel sin comentarlo. Conviene cargar fechas actuales
  o dejar «Cumplimiento» con datos antes de usar la demo en vivo.
- **Accidentabilidad y vial:** el seed deja sin horas el último mes y sin km a la flota; `tools/demo-video/entorno/datos-extra.mts` los completa.
- **Login:** tras correr scripts de seed contra la base con el servidor de producción levantado, el inicio de sesión dio 500 hasta reiniciar `next start`.
