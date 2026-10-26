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
| `seguridad-vial` | `SPEC-road-safety.md` (a escribir) | `vial` | `feat/seguridad-vial-<slices>` | `road_safety` |

Los slices se nombran como en cada SPEC (S1…S11 en inspecciones; 16.x, 17.x, 19.x, 20.x en el resto).

## Lo que ya está en `main`

| Módulo | Entregado | PR |
|---|---|---|
| Base común | Panel contado en la base, resumen diario por persona, módulos por empresa, `Finding.origin`, fechas de asignación para la gracia | #9, #11 |
| Accidentabilidad | 17.1 dominio e índices, 17.2 ficha de accidente · 17.3 exposición mensual, 17.4 tablero de índices | #13, #24 |
| Proveedores | 19.1 dominio, 19.2 registro, lista, importación y aprobados · 19.3 criterios con versiones, evaluación y documentos | #14, #19 |
| Capacitaciones | 20.1 dominio y consulta agregada, 20.2 cursos y editor de la matriz · 20.3 sesiones y registros · 20.4 seguimiento por sede y persona · 20.5 avisos por persona, eficacia y plan anual · 20.6 habilitación para tareas críticas | #12, #18, #22 |
| Inspecciones | S1 dominio, S2 activos y vencimientos de extintores, S3 registro de la inspección en el celular · S4–S5 consecuencias y lista con contadores | #15, #17 |
| Calibraciones | 16.1 dominio y modelo, 16.2 registro y lista de equipos de medición con semáforo · 16.3 carga por puntos, 16.4 vencimientos y evaluación de impacto, 16.5 prueba funcional, tablero y guía | #20, #25 |

## Lo que falta, en orden

Una fila = una sesión. Dos filas con el mismo número de ventana pueden correr juntas.

| Ventana | Sesión | Qué entrega | Depende de | Tamaño |
|---|---|---|---|---|
| 4 | `/modulo proveedores 19.4 19.5` | Reevaluación, hallazgos, comunicaciones, tablero | 19.3 | M |
| 5 | `/modulo inspecciones S6` | Editor de plantillas, guía, e2e del extintor no apto | S4–S5 | S |
| 5 | `/modulo accidentabilidad 17.5` | Exportación, resumen imprimible, guía, e2e | 17.4 | S |
| 6 | `/modulo inspecciones S7` y `S9` | Zona de obradores; arneses y cabos de vida | S6 | S + S |
| 7 | `/modulo inspecciones S8` y `S10` | Vehículos livianos; equipos y vehículos pesados | S6, 20.6 | S + M |
| 8 | `/modulo inspecciones S11` | Auditoría de seguridad en campo | S6, 16.x, 20.6 | M |
| 9 | Investigación y SPEC de seguridad vial (Task 18) | `RESEARCH-road-safety.md` y `SPEC-road-safety.md` para aprobar | 17.x, S8 | M |
| 10 | `/modulo seguridad-vial 18.1 18.2` y `18.3 18.4` | Eventos viales, km por vehículo, tablero propio | SPEC 18 aprobado | L |
| 11 | Checkpoint E | Flujo completo del plan, privacidad y permisos por rol, revisión humana | Todo lo anterior | M |

Después de cada ventana, un PR chico de documentación actualiza `tasks/todo.md` y el README con lo entregado (lo hace la sesión de `/integrar`, no las de módulo).

## Preguntas abiertas para el PO

Surgieron en los reportes de los agentes; cada una tiene un default aplicado.

- **Accidentabilidad:** si un hallazgo se anula, su vencimiento de seguimiento hoy se cierra recién en el siguiente seguimiento. Si no alcanza, hay que enganchar la anulación, que es del módulo de hallazgos.
- **Proveedores:** "aprobados vigentes" en la franja de conteos significa aprobados o con condiciones y habilitados. El responsable de un proveedor es opcional en el servicio y el formulario lo propone.
- **Capacitaciones:** confirmar las cuatro etiquetas de confianza del catálogo sugerido ("En la norma", "Tema en la norma", "Práctica habitual", "A validar").
- **Antes de activar en clientes:** inspecciones (plantillas y criticidades), capacitaciones (vigencias), proveedores (pesos y documentos) y accidentabilidad (Ley 25.326) necesitan la revisión de un profesional, tal como indican sus SPEC.
