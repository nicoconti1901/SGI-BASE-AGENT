---
name: instruccion-corta
description: "Da una instrucción corta de la siguiente tarea a realizar según el plan."
disable-model-invocation: true
---

# Instrucción corta

Al invocar esta skill, responder en forma concisa y corta cuál es la próxima tarea a ejecutar según el plan del proyecto (`tasks/`).

- Si hay un comando de Claude para esa tarea, indicarlo. Si no, indicar la tarea.
- Sobre git, recomendar qué hacer después de la tarea (por ejemplo: solo guardar el cambio, no mergear).
