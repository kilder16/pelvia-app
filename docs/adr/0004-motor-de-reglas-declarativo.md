# ADR 0004 — Reconocimiento del malestar y progresión mediante un motor de reglas declarativo y determinista
Estado: Aceptada
Fecha: 2026-11-03

## Contexto
La app debe "reconocer el tipo de malestar" y recomendar sesiones y frecuencias. Para una app de salud sin profesional en el
circuito, cada recomendación debe ser explicable (¿por qué este perfil?, ¿por qué subió de nivel?) y reproducible en pruebas.

## Opciones consideradas
1. **Tablas de decisión + umbrales en `protocolos.json`, evaluadas por funciones puras** — pros: trazable a guías (NICE, POGP,
   PERFECT, ICIQ), explicable con un `motivo` textual, testeable con `node --test`, editable sin código; contras: no "aprende".
2. **Modelo de ML / scoring probabilístico** — pros: podría afinar con datos; contras: sin datos de entrenamiento, opaco, imposible
   de validar clínicamente en este contexto, riesgo de recomendaciones inseguras.
3. **LLM en la nube para interpretar síntomas** — pros: flexible; contras: datos de salud salen del dispositivo (viola ADR-0003),
   no determinista, costo y dependencia de red.

## Decisión
Opción 1. `engine/` expone funciones puras: `evaluarSeguridad`, `clasificar`, `nivelInicial`, `generarPlan`,
`construirLineaTiempo`, `cerrarSemana`, `intervaloObjetivo`. Cada salida lleva `motivo` (texto) y `reglasAplicadas[]`.
Criterio conservador ante ambigüedad: dolor/hipertonía domina sobre fortalecimiento; prolapso severo y banderas rojas derivan;
nivel inicial = el más bajo compatible.

## Consecuencias
+ Cada decisión se puede mostrar a la usuaria y al profesional ("Se asignó nivel 2 porque E = 4 s y F = 4").
+ Los criterios Gherkin de la spec se traducen 1:1 a tests.
− Ajustar la lógica requiere editar reglas en el catálogo o en el motor (con un ADR si cambia el criterio clínico).
