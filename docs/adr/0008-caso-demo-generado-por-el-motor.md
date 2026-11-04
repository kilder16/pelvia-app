# ADR 0008 — El caso ejemplo (DEMO) se genera ejecutando el motor, con fechas relativas a hoy
Estado: Aceptada
Fecha: 2026-11-03

## Contexto
RF-16 pide un perfil ficticio "completo" con 4 semanas de datos. `casoEjemplo` en el catálogo trae las **entradas** (evaluación
inicial, equipo, autoevaluaciones y resumen semanal de sesiones) y también **resultados esperados** (perfil, nivel, cambio de nivel).
Si la app copiara los resultados, un error del motor quedaría oculto y el DEMO podría contradecir lo que la usuaria verá con sus datos.
Además, las fechas fijas del ejemplo (octubre 2026) harían que "Hoy" mostrara semanas futuras sin datos.

## Decisión
- `store/repo.js → cargarDemo(catalogo, hoy)` reconstruye todo con el motor real: `evaluarSeguridad`, `puntajeIciq`, `clasificar`,
  `nivelInicial`, `generarPlan`, `construirLineaTiempo` (duración y repeticiones), `cerrarSemana` y `regenerarSemanaActual`.
- Las sesiones se crean marcando como hechas las primeras `hechas` entradas planificadas de cada semana (se omiten las últimas).
- La fecha de inicio se desplaza para que las 4 semanas terminen la semana anterior a `hoy` (hoy = semana 5 del plan), conservando
  el día de la semana.
- `resultadoEsperado` se usa solo en los tests (`rf16_cargaDemoConEtiqueta`) como oráculo.

## Consecuencias
+ El DEMO es una prueba de integración visible del motor.
− Si el catálogo describe un resultado que las reglas no producen, el DEMO muestra lo que dicen las reglas. Con el catálogo 1.0.0
  ocurría en la semana 4 (E = 5 s en la semana 2 impedía subir); el catálogo 1.0.1 corrige la autoevaluación (E = 6 s) y el motor
  sube de nivel 2 a 3 al cerrar la semana 4, como describe `mensajeFinalEjemplo` (test `rf16_cargaDemoConEtiqueta`).
