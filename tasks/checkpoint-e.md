# Checkpoint E: guía para cerrarlo

Qué es: la puerta de calidad después de las Tasks 14–20 (`tasks/todo.md`, «Checkpoint E»). Se cierra cuando las 5 partes de abajo están en `[x]`. Las partes A y B las corre un agente; C, D y E las hace una persona en el ambiente de demo.

No hace falta un worktree aparte: se hace sobre `main` con la base de demo (`npm run db:seed` y `npm run db:seed:demo`; cuentas `*@tisico.test`, contraseña común `Tisico123!`).

## A. Automático (agente)
- [ ] `npx tsc --noEmit` y `npm run lint` sin errores.
- [ ] `npm test` verde.
- [ ] `npm run build` compila.
- [ ] `npx playwright test` verde (50 specs). Levantar antes el servidor con `npm run dev -- --port 3000`: la primera compilación en frío supera los 5 s del login y hace fallar specs que no están rotos.

## B. Flujo completo (e2e o a mano, ~20 min)
Entrar como `ana.admin@tisico.test` (tenant_admin) y recorrer, en este orden:
1. **Nómina:** `/t/tisico/master-data/people/import` → importar un CSV con 3 personas.
2. **Matriz de capacitación:** `/t/tisico/training` → ver a esas personas sin cursos y registrar una sesión con asistentes.
3. **Inspección no apta:** `/t/tisico/inspections` → completar una inspección con un ítem crítico no conforme → debe nacer un hallazgo y bloquear el activo.
4. **Hallazgo:** `/t/tisico/findings` → el hallazgo aparece con su origen «inspección» y un vencimiento de seguimiento.
5. **Accidente con índices:** `/t/tisico/safety` → cargar un accidente con días perdidos y horas trabajadas (`/safety/exposure`) → ver frecuencia, gravedad e incidencia en `/safety/stats`.
6. **Evento vial:** `/t/tisico/road-safety` → cargar un evento y los km del mes (`/road-safety/km`).
7. **Proveedor:** `/t/tisico/suppliers` → evaluar un proveedor, volver a evaluarlo y ver que la evaluación anterior queda como historial.

Pasa si cada paso funciona sin errores y deja el dato en el módulo siguiente.

## C. Tableros coherentes (persona)
- [ ] El tablero de accidentabilidad (`/safety/resumen`) y el vial (`/road-safety`) están separados: ningún accidente de tránsito se cuenta dos veces en el mismo índice.
- [ ] El accidente del paso 5 y el evento vial del paso 6 suman en su tablero y no en el del otro.
- [ ] Un hallazgo anulado desaparece de los conteos y cierra su vencimiento.

## D. Privacidad y permisos por rol (persona)
Repetir con cada cuenta y anotar qué ve:

| Cuenta | Rol | Debe ver | No debe ver |
|---|---|---|---|
| ana.admin | tenant_admin | todo, incluido nombres de conductores y lesiones | — |
| bruno.procesos / facundo.sst | process_owner | nombres de conductores y lesiones | ajustes de la empresa |
| carla.calidad / diego.ops | contributor | totales y sus propios registros | nombres de conductores (D24), datos de salud |
| elena.consulta | viewer | tableros de solo lectura | botones de crear, anular o editar; nombres de conductores |

- [ ] DNI y datos de salud (lesión, días perdidos) no aparecen en listados ni exportaciones para contributor y viewer.
- [ ] Un usuario de otro tenant no abre una URL de `tisico` (probar con una cuenta `demo-*`).

## E. Revisión humana (administrador)
- [x] Las 5 actas de `tasks/revisiones-profesionales.md` firmadas y aprobadas el 2026-11-08.
- [ ] Decidir si se sigue con la siguiente fase (módulo de registros de ensayo, ver `docs/specs/SPEC-inspections.md`, «Planillas del PO incorporadas»).

## Registro de la corrida
**2026-11-08, parte A (agente), contra la base de desarrollo `sgi_base`:**
- `tsc`, `lint` y `npm test` verdes (1469 tests; una corrida falló un test de integración por timeout y la siguiente pasó).
- `npm run build` no se corrió.
- e2e: 30 de 50 verdes en la corrida serial; 13 fallaron y 7 no se repitieron. Las fallas son de entorno, no de lógica: el acceso rápido de la pantalla de inicio no muestra a Carla ni a Elena (la base tiene más de 50 empresas `e2e-*` acumuladas) y el login en frío del servidor de desarrollo supera los 5 s. Un spec estaba desactualizado (`road-safety`, esperaba el tag «sin verificar» ya retirado): corregido.
- Pendiente para cerrar A: correr el e2e en una base limpia (`npm run wt:setup -- checkpoint-e` en un worktree) y con `npm run build && npx next start`.
- Partes B a E: sin hacer.
