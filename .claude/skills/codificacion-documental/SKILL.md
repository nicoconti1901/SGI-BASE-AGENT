---
name: codificacion-documental
description: "Decide y aplica la codificación única de los documentos y registros de un cliente: conservar la del cliente o recodificar con el esquema SGI Base, llevar el listado maestro (clientes/<slug>/trabajo/listado-maestro.md) y validar que no haya códigos repetidos ni referencias rotas. Usar al definir códigos, renombrar entregables, cambiar revisiones o revisar el listado maestro."
---

# Codificación documental

## Modelo
Elegir el esquema: Opus, esfuerzo alto, en la sesión principal (una vez por cliente). Aplicar códigos, renombrar y mantener el listado: Haiku o Sonnet, esfuerzo bajo.

## Reglas
1. Un solo esquema por cliente. Nunca se mezclan el del cliente y el nuestro.
2. El código es único en todo el SGI del cliente y no se reutiliza: un documento descartado conserva su código en el listado, con estado `obsoleto`.
3. El código no cambia al revisar. La revisión va aparte: `NN` en el listado y «Revisión NN» en el encabezado (00 es la emisión inicial).
4. Todo registro tiene código, también los que viven en un módulo de la plataforma.
5. El registro se vincula a su procedimiento por el código.
6. El listado maestro es la única fuente de códigos: primero la fila, después el archivo. Un hook valida el listado cada vez que se edita el listado o un entregable.

## ¿Codificación del cliente o nueva?
Se conserva la del cliente solo si se cumplen las tres condiciones:
- Al menos el 80 % de sus documentos ya tiene código y no hay códigos repetidos (columnas de `inventario-bruto.md`).
- El esquema es consistente y vincula los registros con su procedimiento, o se puede extender sin excepciones.
- El personal del cliente ya lo usa (lo dicen, o lo muestran registros completos).

Si no, se usa el esquema SGI Base. En los dos casos se completa «Código anterior»: lo usan el auditor y el personal del cliente para encontrar sus documentos. Presentá la decisión con AskUserQuestion: primero la opción recomendada, con los números (documentos con código, repetidos, un ejemplo de cada esquema).

## Esquema SGI Base (por defecto)
Es el de las planillas propias (`src/5. Registros en blanco/`, copia local que no se versiona):

| Tipo | Código | Ejemplo |
|---|---|---|
| Manual del SGI | `MS NN` | MS 01 |
| Política | `POL NN` | POL 01 |
| Procedimiento general (de gestión, alcanza a toda la organización) | `PG NN` | PG 05 |
| Procedimiento específico (operativo, de un proceso o servicio) | `PE NN` | PE 02 |
| Instructivo | `IT NN PG MM` o `IT NN PE MM` | IT 01 PE 02 |
| Registro general (del PG MM) | `RG NN PG MM` | RG 01 PG 05 |
| Registro específico (del PE MM) | `RE NN PE MM` | RE 03 PE 12 |
| Documento externo controlado | `EXT NN` | EXT 04 |

En la ficha: ``- patron-codigo: `^(?:MS|POL|EXT) \d{2}$|^P[GE] \d{2}$|^IT \d{2} P[GE] \d{2}$|^R[GE] \d{2} P[GE] \d{2}$` ``

Los PG se numeran siguiendo el mapa de procesos (gestión primero). Los huecos que deja un descarte no se rellenan.

Si se conserva la codificación del cliente, `patron-codigo` es una regex que describe su esquema, y lo nuevo sigue su misma lógica.

## Dónde va el código
- Nombre de archivo: `<código> <Título> R<NN>.<ext>`, por ejemplo `RG 01 PG 05 Matriz de Riesgos y Oportunidades R03.xlsx`.
- Encabezado del documento: título, código, «Revisión NN» y «Fecha: MM/AAAA»; en el pie, «Página X de Y».
- En la plataforma, `Document` todavía no tiene campo de código: se carga como título `<código> <Título>`. La brecha queda en `brechas-plataforma.md` (propuesta: código único por tenant y revisión visible, como PR de fundación vía `/spec`). Este flujo no toca el schema.

## Listado maestro
Plantilla: `plantillas/listado-maestro.md`.

| Columna | Contenido |
|---|---|
| Código | según `patron-codigo`; vacío solo si el dictamen es `descartar` |
| Título | |
| Tipo | Manual, Política, Procedimiento, Instructivo, Registro, Externo |
| Rev. | `NN` |
| Código anterior | el del cliente, o `—` |
| Dictamen | `conservar`, `ajustar`, `recrear`, `crear`, `modulo`, `descartar` |
| Cláusulas | por ejemplo `9001 7.5; 45001 7.5` |
| Plataforma | módulo o Documentos |
| Archivo | ruta relativa a `clientes/<slug>/` (`origen/…` si se conserva tal cual, `entregables/…` si se produce); varios separados por coma |
| Estado | `pendiente`, `en redacción`, `para revisión`, `aprobado`, `cargado`, `obsoleto` |

Validación: `node scripts/clientes/validar-codigos.mjs clientes/<slug>`. Revisa códigos vacíos, repetidos (sin distinguir espacios ni guiones) o fuera del patrón; archivos faltantes en filas `para revisión`, `aprobado` o `cargado`; entregables sin fila; y códigos citados en los .md de `entregables/` que no están en el listado.
