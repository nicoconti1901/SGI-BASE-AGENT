# Informe de legibilidad de la plataforma SGI Base

**Fecha:** 20 de noviembre de 2026
**Alcance:** tipografía, color y contraste, jerarquía entre títulos y descripciones, tarjetas y contenedores. Incluye los dos temas (claro y oscuro) y las pantallas de cliente y de plataforma.
**Método:** revisé el código de los componentes compartidos (`src/components/ui/*`), los tokens de diseño (`src/styles/tokens.css`), y medí el uso de clases en las 246 pantallas y componentes. Calculé el contraste de los colores con la fórmula de WCAG 2.2. No hice pruebas con usuarios ni capturas de pantalla, así que conviene validar las conclusiones con usuarios reales (ver la sección 6).

---

## 1. Resumen

Tu primera impresión es correcta y los números la confirman. Ningún texto incumple el contraste mínimo de accesibilidad, así que el problema no es que el texto «no se vea». El problema es que **casi todo el texto tiene el mismo tamaño, el mismo gris y el mismo tipo de caja**. El ojo no encuentra por dónde empezar.

Hay tres causas principales:

1. **Títulos y descripciones se parecen demasiado.** La mayoría del texto es chico (14 px o menos) y gris. Los títulos son apenas más grandes que el texto que los acompaña y algunos ni siquiera llevan negrita.
2. **Las tarjetas no se despegan del fondo.** El borde existe, pero tiene menos contraste del mínimo recomendado para límites de componentes. El fondo de la tarjeta y el de la pantalla son casi iguales.
3. **Todas las cajas son la misma caja.** Las secciones, las tarjetas de registro, las métricas, las listas y los estados vacíos usan el mismo borde, el mismo fondo y el mismo radio. En 10 pantallas hay tarjetas dentro de secciones con el mismo estilo, es decir, cajas iguales dentro de cajas iguales.

La buena noticia es que casi todo se corrige en pocos lugares: los tokens de color y 5 o 6 componentes compartidos. No hace falta rehacer las pantallas una por una.

---

## 2. Jerarquía: qué es título y qué es descripción

### 2.1 Casi todo el texto es chico

| Tamaño | Usos en el código |
|---|---|
| 10 px (`text-[10px]`) | 4 |
| 11 px (`text-[11px]`) | 57 |
| 12 px (`text-xs`) | 343 |
| 14 px (`text-sm`) | 799 |
| **16 px (`text-base`), el tamaño normal de lectura** | **29** |

El tamaño de lectura recomendado para pantallas (16 px) casi no se usa. El contenido corre a 14 px y las etiquetas a 11 o 12 px. Esto pesa más en nuestro público: responsables de calidad y de seguridad, muchos de más de 40 años, que a veces trabajan en notebooks chicas o en monitores de planta.

**Usuarios afectados:** todos, y sobre todo quienes tienen presbicia, poca visión, o leen de lejos o con reflejos.

### 2.2 El gris del texto secundario se usa en todas partes

- El color de texto secundario (`--color-ink-muted`) aparece **647 veces**. El color de texto principal se usa mucho menos.
- La diferencia entre el texto principal y el secundario es baja: **2,4 a 1 en tema claro y 2,1 a 1 en oscuro**. A simple vista se leen como «gris oscuro» y «gris un poco más claro», no como «importante» y «complementario».
- Cuando casi todo es gris, el gris deja de indicar algo.

### 2.3 Los títulos no se distinguen lo suficiente del texto

- **Título de sección** (`SectionBlock.tsx:37`): mide 18 px y la descripción de abajo mide 14 px. Es poco salto para un título que encabeza una sección entera.
- **Título de tarjeta de registro** (`RecordList.tsx:60`): mide 18 px pero **no tiene negrita** (peso normal). Al lado de los datos de la tarjeta, que sí están en negrita media (`RecordFacts`), el título parece texto común y los datos parecen más importantes que el título.
- **Subtítulos (`h3`) inconsistentes:** hay 6 tamaños distintos (11 px, 14, 16, 18, 20 y variantes) y 26 de ellos no usan la fuente de títulos. El usuario no puede aprender un patrón del tipo «esto, en este estilo, es un subtítulo».
- **Títulos que parecen etiquetas:** algunos títulos de sección son de 11 a 12 px, en mayúsculas y en gris:
  - `Telemetry.tsx:36` y `DashboardStrip.tsx:113`: títulos de 11 px en fuente monoespaciada y en mayúsculas.
  - `safety/stats/parts.tsx:31` y `platform/tenants/[slug]/ModulesSection.tsx:22`: lo mismo en subtítulos.

### 2.4 Caso crítico: la ficha del hallazgo

En `findings/[findingId]/page.tsx:264-268`, el **hecho del hallazgo** es el contenido más importante de la pantalla, y se muestra así:

- el título «Hecho» en 12 px, mayúsculas y el gris más claro (`ink-subtle`);
- la descripción en 14 px y gris secundario.

El contenido principal de la pantalla se ve como una nota al pie. En cambio, la causa raíz justo debajo (línea 276) está en 20 px con fuente de títulos. La jerarquía queda invertida: el título se lee como etiqueta y el contenido principal como texto secundario.

### 2.5 Exceso de mayúsculas en fuente monoespaciada

- Hay 94 textos en mayúsculas y 119 en fuente monoespaciada: los rótulos sobre los títulos (por ejemplo «ISO 9001 · §6.1»), el tipo de registro, las etiquetas de las métricas y los títulos de los paneles.
- Las mayúsculas borran la forma de las palabras y obligan a leer letra por letra. A 11 px y con espaciado ancho, cuestan bastante.
- La fuente monoespaciada sirve para códigos, cláusulas y fechas. Usarla también para etiquetas descriptivas («Riesgos abiertos», «Responsable») suma ruido.

### 2.6 Las líneas de texto son muy largas

El contenido ocupa hasta 1024 px de ancho y solo 2 lugares limitan el largo de línea (`max-w-[52ch]`, `max-w-prose`). Una descripción de 14 px en ese ancho llega a más de 130 caracteres por línea, cuando lo cómodo es entre 60 y 75. Además, solo 10 textos tienen interlineado amplio (`leading-relaxed`).

---

## 3. Tarjetas y contenedores

### 3.1 El borde de las tarjetas tiene poco contraste

| Elemento | Tema claro | Tema oscuro | Mínimo WCAG 1.4.11 |
|---|---|---|---|
| Borde de tarjeta (`--color-card-line`) sobre la tarjeta | 2,61 | 2,64 | **3,0** |
| Borde de tarjeta sobre el fondo de pantalla | 2,41 | 2,80 | **3,0** |
| Divisores internos (`--color-line`) | 1,52 | 1,33 | (no aplica, pero son casi invisibles) |

El borde está en todas las tarjetas (se usa 247 veces), pero queda por debajo del mínimo de contraste para límites de componentes. Por eso se percibe como «sin borde», sobre todo en monitores con poco brillo o con el brillo automático.

### 3.2 La tarjeta y el fondo son casi del mismo color

- Tarjeta contra fondo de pantalla: **1,08 a 1 en claro** (blanco sobre gris muy claro) y **1,06 a 1 en oscuro** (casi negro sobre negro).
- La sombra del tema claro tiene 6 % de opacidad, que no se nota. El tema oscuro no tiene sombra.
- Resultado: la tarjeta no «flota» ni se recorta del fondo. Solo la separa un borde que ya es débil.

### 3.3 Todas las cajas son iguales

Estos componentes comparten el mismo borde, el mismo fondo blanco (o negro), el mismo radio y la misma sombra:

- la sección (`SectionBlock`);
- la franja de métricas (`StatGrid`);
- la tarjeta de registro (`RecordCard`);
- la lista de entidades (`EntityList`);
- la tarjeta de vencimiento (`DueCard`);
- la caja de detalle de la ficha del hallazgo.

Además, en **10 pantallas** las tarjetas van dentro de una sección con el mismo estilo (por ejemplo `risks/page.tsx:125-139`: una `SectionBlock` con una `RecordList` adentro). El usuario ve un recuadro que contiene recuadros idénticos y no distingue qué agrupa a qué. Pasa en riesgos, auditorías, indicadores, inspecciones, instrumentos, proveedores (lista y ficha), capacitación y dos pantallas de plataforma.

### 3.4 El paso del mouse casi no se nota

En `RecordCard`, al pasar el mouse el borde pasa de `card-line` a `line-strong`, dos grises parecidos. El usuario no recibe una señal clara de que la tarjeta se puede abrir. El título sí se subraya, pero solo al pasar por encima del título.

---

## 4. Otros puntos (menor prioridad)

- **Texto de 10 px en 4 lugares**, dos de ellos con el gris más claro: `GapAssessmentForm.tsx:145`, `indicators/page.tsx:183`, `HubStage.tsx:247` y `Telemetry.tsx:25`. Es demasiado chico para cualquier texto que haya que leer.
- **El gris más claro (`ink-subtle`) se usa en 55 lugares**, 38 de ellos en texto de 11 o 12 px. Cumple el contraste (5,0 a 5,5), pero combinar letra chica con el gris más tenue es lo que más cansa la vista.
- **Tema oscuro:** el fondo es casi negro puro (`#06080b`) y el texto casi blanco (17 a 1). Un contraste tan alto genera halo o «vibración» del texto para las personas con astigmatismo, que son muchas. Un fondo gris muy oscuro (por ejemplo `#0f1318`) lee mejor.
- **Dos fuentes de títulos según el tema** (Instrument Sans en claro, Sora en oscuro): quien cambia de tema ve otra personalidad tipográfica. No afecta la lectura, pero suma inconsistencia.

---

## 5. Lo que está bien

- Todo el texto cumple el contraste mínimo AA (4,5 a 1). El texto secundario está en 7,5 a 1.
- Hay un sistema de tokens único, así que corregir un color lo corrige en toda la plataforma.
- Los estados nunca se indican solo con color: los chips llevan texto e ícono.
- El foco del teclado es visible y las pantallas tienen una estructura base clara (rótulo, título, métricas, secciones).
- Los campos de los formularios tienen borde fuerte y un estilo propio (`.sgi-form`), distinto de las tarjetas.

---

## 6. Recomendaciones, por prioridad

### Prioridad 1: cambios de tokens (rápidos y con impacto en toda la plataforma)

1. **Subir el borde de las tarjetas a 3 a 1 o más.**
   - Claro: `--color-card-line` de `#94a1b8` a `#7a879e` (3,6 sobre blanco).
   - Oscuro: de `#4b5870` a `#64728c` (3,7 sobre la tarjeta).
2. **Separar la tarjeta del fondo.**
   - Claro: oscurecer el fondo de pantalla (`--color-canvas`) de `#f4f6fa` a `#eaeef4`. La tarjeta blanca pasa de 1,08 a 1,16 contra el fondo.
   - Oscuro: aclarar la tarjeta (`--color-surface-raised`) de `#0d1117` a `#111720`.
   - Subir un poco la sombra del tema claro (por ejemplo 10 a 12 % de opacidad).
3. **Hacer visibles los divisores internos:** `--color-line` con al menos 1,8 a 2 a 1.

Hay que actualizar también `tests/design-tokens.test.ts` y revisar que los campos de formulario (`line-strong`) sigan viéndose más fuertes que las tarjetas.

### Prioridad 2: una escala tipográfica fija en los componentes compartidos

Propuesta de escala, para fijar como tokens o clases y aplicar en `ui/*`:

| Rol | Tamaño | Peso | Color |
|---|---|---|---|
| Título de página (h1) | 30 px | semibold | principal |
| Título de sección (h2) | 22 px | semibold | principal |
| Título de tarjeta (h3) | 17 a 18 px | **semibold** | principal |
| Contenido (descripciones, hechos, textos que se leen) | **16 px** | normal | **principal** |
| Datos secundarios (fechas, responsable, origen) | 14 px | normal | secundario |
| Etiquetas y rótulos | 12 a 13 px, nunca menos | medium | secundario |

Y estas reglas:

- **El gris secundario se usa solo para datos secundarios.** Las descripciones y el contenido que el usuario tiene que leer van en el color principal.
- **Las etiquetas descriptivas van en minúscula y fuente normal.** Las mayúsculas en fuente monoespaciada quedan solo para códigos, cláusulas y fechas.
- **Las descripciones largas se limitan a unos 70 caracteres por línea** (`max-w-[70ch]`) y llevan interlineado amplio.
- **Se eliminan los textos de 10 y 11 px.**

Componentes a ajustar: `PageHeader`, `SectionBlock`, `RecordCard`, `EntityRow`, `StatTile`, `DueCard`, `StageSection`, `Field` y `EmptyState`.

### Prioridad 3: distinguir los niveles de contenedor

Definir 3 niveles que se vean distintos:

1. **Sección:** sin caja. Se marca con un título grande y una línea arriba, como ya decía la guía de identidad («border-t + pt-6»).
2. **Tarjeta:** caja con borde, fondo y sombra leve. Es la única que «flota».
3. **Bloque dentro de una tarjeta:** fondo hundido (`surface-sunken`) sin borde, o solo un riel a la izquierda.

Con eso, una sección con tarjetas adentro deja de ser «caja en caja». Como `SectionBlock` se usa 324 veces, conviene sacarle el marco solo cuando contiene una lista de tarjetas, por ejemplo con una opción `framed={false}`, o directamente para todos los casos.

Además, el paso del mouse sobre una tarjeta debería cambiar el borde al color de acento y hacer clic en cualquier parte de la tarjeta, no solo en el título.

### Prioridad 4: corregir los casos puntuales

- Ficha del hallazgo (`findings/[findingId]/page.tsx:264-276`): títulos de sección normales (h2 en 18 a 22 px) y el hecho en 16 px con el color principal.
- Quitar el texto de 10 px en los 4 archivos indicados.
- Pasar los títulos de 11 px (`Telemetry`, `DashboardStrip`, `safety/stats`, `ModulesSection`) a la escala de títulos.
- Unificar los `h3` con un solo estilo.

### Validar con usuarios

Antes y después de los cambios, conviene hacer una prueba corta con 4 o 5 usuarios reales (un responsable de calidad, uno de seguridad y un miembro sin experiencia):

- **Prueba de 5 segundos:** mostrar la pantalla de riesgos y preguntar «¿cuál es el título de esta pantalla y cuántos riesgos abiertos hay?».
- **Búsqueda:** «encontrá el hallazgo X y decime cuál fue el hecho».
- Probar en una notebook de 13 a 14 pulgadas con brillo medio y en los dos temas.

---

## 7. Esfuerzo estimado

| Bloque | Archivos | Esfuerzo |
|---|---|---|
| P1: tokens | `tokens.css` y su test | 1 a 2 horas |
| P2: escala tipográfica | 9 componentes de `ui/*` | 1 día |
| P3: niveles de contenedor | `SectionBlock`, `RecordCard` y 10 pantallas | 1 día |
| P4: casos puntuales | unos 8 archivos | medio día |

Las prioridades P1 y P2 resuelven la mayor parte del problema que se percibe hoy.
