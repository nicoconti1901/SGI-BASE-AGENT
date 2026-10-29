# Plan de sesiones — Fase 5

Cómo construir lo que falta sin agotar el cupo por sesión. Cada sesión es una conversación nueva de Claude Code, con un solo módulo y su propio worktree.

## Qué aprendimos (medido el 2026-10-21 y 22)

- Un tramo de 2 slices de un módulo (dominio + Prisma + pantallas + tests) consume unos **340.000–370.000 tokens** de un agente Sonnet y tarda cerca de una hora.
- **Cuatro tramos a la vez agotan el cupo de una ventana** (el límite se reinició a las 14:10 y a las 19:30: ventanas de unas 5 horas) y los agentes se cortan a mitad de camino. Lo que no estaba commiteado se vuelve frágil.
- Integrar un PR (rebase, conflictos aditivos, orden de migraciones, suite, CI, merge) es barato en tokens pero largo en tiempo de máquina; conviene hacerlo con `/integrar`.

## Reglas para ahorrar cupo

1. **Una sesión = un módulo = un tramo de 1–2 slices.** Terminar el PR y cerrar la sesión; no reutilizar una sesión larga para otro módulo.
2. **Máximo 2 sesiones por ventana de cupo**, en terminales distintas y en worktrees distintos. Con una sola, la ventana alcanza para 2 tramos.
3. **Sesión nueva y limpia:** abrirla con `claude --worktree <nombre> --model sonnet` y pegar solo el comando `/modulo …`. El comando lee únicamente los slices pedidos del SPEC, no toda la investigación.
4. **Commitear cada pieza verde** y pushear la rama después del primer slice: si el cupo se agota, el trabajo queda a salvo y la sesión siguiente retoma desde el commit.
5. **No correr la suite e2e completa en local**: la corre CI. Cada sesión corre solo su spec.
6. **Integrar con `/integrar <PR>` en una sesión aparte** (cuesta poco), de a un PR por vez y en el orden de la tabla.
7. Las decisiones del producto no se piden a mitad de una sesión: se resuelven con el default del SPEC y se anotan en el PR. Las preguntas abiertas están al final de este documento.

## Cómo lanzar una sesión

```bash
# desde la raíz del repo, en una terminal nueva
claude --worktree insp-s4 --model sonnet
# ya dentro de la sesión:
/modulo inspecciones S4 S5
```

Cuando el PR esté abierto y con CI en verde, en otra sesión: `/integrar <número del PR>`.

## Módulos: dónde está cada cosa

| Módulo (`/modulo …`) | SPEC | Nombre de entorno | Rama | Clave en el catálogo |
|---|---|---|---|---|
| `inspecciones` | `SPEC-inspections.md` | `insp` | `feat/inspecciones-<slices>` | `inspections` |
| `calibraciones` | `SPEC-calibration.md` | `cal` | `feat/calibraciones-<slices>` | `instruments` |
| `accidentabilidad` | `SPEC-accident-stats.md` | `acc` | `feat/accidentabilidad-<slices>` | `safety_stats` |
| `proveedores` | `SPEC-suppliers.md` | `prov` | `feat/proveedores-<slices>` | `suppliers` |
| `capacitaciones` | `SPEC-training.md` | `cap` | `feat/capacitaciones-<slices>` | `training` |
| `seguridad-vial` (ver abajo) | `SPEC-road-safety.md` (aprobado 2026-10-28; 18.0 es un PR serial, no `/modulo`) | `vial` | `feat/seguridad-vial-<slices>` | `road_safety` |

Los slices se nombran como en cada SPEC (S1…S11 en inspecciones; 16.x, 17.x, 19.x, 20.x en el resto).

## Lo que ya está en `main`

| Módulo | Entregado | PR |
|---|---|---|
| Base común | Panel contado en la base, resumen diario por persona, módulos por empresa, `Finding.origin`, fechas de asignación para la gracia | #9, #11 |
| Accidentabilidad | 17.1 dominio e índices, 17.2 ficha de accidente · 17.3 exposición mensual, 17.4 tablero de índices · 17.5 exportación CSV, resumen imprimible y guía | #13, #24, #28 |
| Proveedores | 19.1 dominio, 19.2 registro, lista, importación y aprobados · 19.3 criterios con versiones, evaluación y documentos · 19.4 reevaluación y evaluación inicial pendiente (solo críticos, #31) · 19.5 hallazgos, comunicaciones, evolución y guía | #14, #19, #30, #31 |
| Capacitaciones | 20.1 dominio y consulta agregada, 20.2 cursos y editor de la matriz · 20.3 sesiones y registros · 20.4 seguimiento por sede y persona · 20.5 avisos por persona, eficacia y plan anual · 20.6 habilitación para tareas críticas | #12, #18, #22 |
| Inspecciones | S1 dominio, S2 activos y vencimientos de extintores, S3 registro de la inspección en el celular · S4–S5 consecuencias y lista con contadores · S6 editor de plantillas, guía y e2e del extintor no apto · S7 obradores y S9 arneses y cabos de vida · S8 vehículos livianos · S10 equipos y vehículos pesados con izaje · S11 auditoría de seguridad en campo con meta por sede | #15, #17, #29, #33, #34, #38, #39 |
| Calibraciones | 16.1 dominio y modelo, 16.2 registro y lista de equipos de medición con semáforo · 16.3 carga por puntos, 16.4 vencimientos y evaluación de impacto, 16.5 prueba funcional, tablero y guía | #20, #25 |
| Seguridad vial | 18.0 fundación (`ISO39001` opt-in, `manage_road_safety`, daño material) · 18.1 dominio y modelos, 18.2 registro del hecho vial, km y aviso mensual · 18.3 tablero, exportación y guía, 18.4 conductores habilitados, ajustes, excesos de velocidad y módulo disponible | #44, #45, #46 |

## Lo que falta, en orden

Una fila = una sesión. Dos filas con el mismo número de ventana pueden correr juntas.

| Ventana | Sesión | Qué entrega | Depende de | Tamaño |
|---|---|---|---|---|
| 9 | Checkpoint E | Flujo completo del plan, privacidad y permisos por rol, revisión humana | Todo lo anterior | M |

**Seguridad vial (decisión del PO, 2026-10-28; hecha el 2026-10-29):** el PO aprobó `SPEC-road-safety.md` (ISO 39001 como norma propia, D1–D26 con sus defaults) y adelantó el módulo; se entregó en cuatro PR (fundación 18.0, 18.1 y 18.2, 18.3 y 18.4). **Ninguna cláusula de ISO 39001 está verificada**: los requisitos se cargan con el tag `sin-verificar` y el PO lo retira cuando confirme el índice contra la norma licenciada.

Después de cada ventana, un PR chico de documentación actualiza `tasks/todo.md` y el README con lo entregado (lo hace la sesión de `/integrar`, no las de módulo).

## Preguntas abiertas para el PO

Surgieron en los reportes de los agentes; cada una tiene un default aplicado.

- **Accidentabilidad:** si un hallazgo se anula, su vencimiento de seguimiento hoy se cierra recién en el siguiente seguimiento. Si no alcanza, hay que enganchar la anulación, que es del módulo de hallazgos.
- **Proveedores (decididas por el PO el 2026-10-27):** la evaluación inicial pendiente solo para críticos (también al importar CSV) y el cierre del plan de mejora no pasa a ser un vencimiento real. Pendiente: "aprobados vigentes" en la franja de conteos significa aprobados o con condiciones y habilitados. El responsable de un proveedor es opcional en el servicio y el formulario lo propone.
- **Capacitaciones:** confirmar las cuatro etiquetas de confianza del catálogo sugerido ("En la norma", "Tema en la norma", "Práctica habitual", "A validar").
- **Inspecciones:** el PO aprobó las plantillas como default (decisión 20 de `SPEC-inspections.md`, 2026-10-27). No autoriza activar el módulo en ningún cliente.
- **Seguridad vial (decididas por el PO el 2026-10-29):** el conductor es una marca de la persona (vive en el módulo, en la pestaña Conductores, con el vencimiento de su licencia) y una tarea de conducción sin curso obligatorio no habilita a nadie. Opcional a futuro: mostrar la marca en la ficha de la persona de Datos maestros. Con `road_safety` disponible ya no queda ningún módulo `planned` en el catálogo.
- **Antes de activar en clientes:** inspecciones (plantillas y criticidades), capacitaciones (vigencias), proveedores (pesos y documentos) y accidentabilidad (Ley 25.326) necesitan la revisión de un profesional, tal como indican sus SPEC.
- **Seguridad vial:** pendiente del PO confirmar el índice de cláusulas de ISO 39001 contra la norma licenciada. Hay que validar con profesionales la lesión grave (D8), el umbral de poca exposición (D16), el reparto por días (D12) y la base legal (Ley 25.326, D21/D24/D26).
- **Inspecciones:** los PR #33 y #34 usan defaults que conviene revisar: vida útil del arnés de 5 años por activo (sin ajuste por empresa), service obligatorio al dar de alta un vehículo, intervalos de referencia de seguro y RTO a 12 meses, service a 6 y monitoreo a 12.
