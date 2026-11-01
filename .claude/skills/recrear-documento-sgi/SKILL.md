---
name: recrear-documento-sgi
description: "Redacta en el formato SGI Base un procedimiento, instructivo o registro del cliente que se ajusta, recrea o crea: encabezado codificado, estructura fija, responsables por cargo, registros asociados y vínculo con los módulos de la plataforma. Usar en la fase 4 de /incorporar-cliente o cuando se pida pasar un documento a nuestro formato."
---

# Recrear un documento en formato SGI Base

## Modelo
Sonnet, esfuerzo medio; alto para procedimientos núcleo (información documentada, NC y acción correctiva, auditoría interna, revisión por la dirección, operación principal). Haiku solo para exportar a .docx/.xlsx un .md ya aprobado.

## Fuente de verdad
El `.md` en `clientes/<slug>/entregables/procedimientos/` o `entregables/registros/`, con el nombre que fija la skill `codificacion-documental`. Se exporta solo después de que el usuario lo aprueba.

## Cómo se escribe
- Español, impersonal y en presente: «El Responsable de Compras evalúa…». Frases cortas. Un paso es un cargo, una acción y un resultado.
- Se describe el proceso del cliente, no la norma. No se copia texto de las normas ISO: se cita la cláusula («ISO 9001 7.5.3»). Una frase del tipo «La organización debe…» es señal de que se está copiando la norma.
- `ajustar`: se preserva el contenido del cliente (responsables, criterios, frecuencias) y solo se pasa al formato y se completa la identificación. `recrear`: se reescribe, reutilizando lo que el original tenga de válido.
- Un dato del cliente que no se conoce va como `[[A COMPLETAR: qué falta]]`, con una línea en `trabajo/pendientes-cliente.md` (código, dato, a quién pedirlo). Nunca se inventan nombres, cargos, cifras, frecuencias, sitios ni leyes aplicables.
- Si un paso se registra en la plataforma, se dice dónde: «Se registra en el módulo Hallazgos (RG 01 PG 23)».
- Cargos, no personas, tomados del organigrama o los perfiles del cliente.
- Si aplican varias normas, un solo procedimiento integrado; lo propio de cada norma se marca solo donde difiere.
- Terminología de la estructura armonizada: «información documentada», «riesgos y oportunidades» (no «acción preventiva»).
- Un procedimiento ocupa de 2 a 6 páginas. Si se pasa, el detalle va a un instructivo.

## Plantillas
- `plantillas/procedimiento.md`: también para instructivos (sin secciones 7 y 8 si no aplican).
- `plantillas/registro.md`: variante A, planilla en papel o Excel; variante B, ficha de un registro que vive en un módulo.

## Pasos por documento
1. Leé su fila de la evaluación, el texto del original (`trabajo/texto/`), las filas de `cobertura.md` de sus cláusulas y su código en el listado.
2. Pasá la fila del listado a `en redacción`.
3. Escribí el .md desde la plantilla.
4. Revisá: el código y la revisión del encabezado coinciden con el listado; cada registro citado está en el listado; todos los responsables son cargos; las cláusulas coinciden con la cobertura; no hay texto copiado de la norma; cada `[[A COMPLETAR]]` está en `pendientes-cliente.md`.
5. Pasá la fila a `para revisión` con la ruta en «Archivo». El hook de codificación te devuelve los problemas que encuentre; corregilos antes de seguir.

## Exportar (después de la aprobación)
- Procedimientos e instructivos con la skill `anthropic-skills:docx`; planillas con `anthropic-skills:xlsx`. El encabezado es una tabla: logo del cliente | TÍTULO | código, «Revisión NN», «Fecha: MM/AAAA». En el pie, «Página X de Y». Al final, el cuadro Elaboró / Revisó / Aprobó en blanco: lo firma el cliente.
- El exportado lleva el mismo nombre que el .md, y se agrega en «Archivo» del listado (separado por coma).
