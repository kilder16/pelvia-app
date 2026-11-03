# ADR 0007 — Reglas complementarias del planificador y de la línea de tiempo de sesión
Estado: Aceptada
Fecha: 2026-11-03

## Contexto
El catálogo (`content/protocolos.json`) y `docs/diseno.md §6.4/§10` definen las reglas principales, pero durante la implementación
aparecieron casos que no estaban especificados y que el motor debe resolver de forma determinista y conservadora (ADR-0004):
1. Una entrada de `semanaTipo` cuyo tipo de sesión no admite el nivel del plan (p. ej. IUE nivel 0 con EST-IUE, que tiene `nivelMin = 1`).
   Sin una regla, RF-05 ("P = 0–1 → nivel 0 y, sin contraindicación, el plan incluye EST-SENS") no se cumpliría para IUE.
2. Un reemplazo que produce un tipo ya presente ese día (p. ej. sin EST y sin EMG: EST-IUE → BIO-LENTAS → PFMT-SERIE, y el día ya tiene PFMT-SERIE).
3. Equipo no registrado todavía en "Mi equipo".
4. Bandera roja: la regla del catálogo dice "solo PFMT-CONCIENCIA, RELAJ-RESP y HAB-SEMANAL", pero filtrar dejaría días vacíos.
5. Sesiones sin tiempos explícitos en el catálogo: PFMT-KNACK, PFMT-FUNCIONAL, VES-SUPRESION, TENS continuo.
6. Preguntas de seguridad sin responder.

## Decisión
1. **Compatibilidad de nivel** (paso 2 del planificador, después de los filtros de la entrada): si `nivel < tipo.nivelMin`,
   una sesión de electroestimulación se sustituye por `niveles[nivel].estSugerida` (si existe, admite el nivel y no está en
   `perfilesNoRecomendados` del perfil) y cualquier otra por PFMT-CONCIENCIA (si admite el nivel); si no hay alternativa se omite.
   Si `nivel > tipo.nivelMax` se omite. Las entradas `desdeSemana5` de PROG-DOLOR quedan exentas (las prescribe el programa).
2. **Fusión de duplicados**: no se repite un tipo en el mismo día. Si el duplicado es PFMT-SERIE y alguno viene de un reemplazo,
   se suma una serie a la existente con tope de 3 series/día (NICE NG123: 3 veces al día). Un reemplazo que cae en PFMT-SERIE
   aporta 1 serie (volumen equivalente a la sesión reemplazada).
3. **Sin equipo registrado** = sin electroestimulación (se aplica `reemplazoSinEST`) y sin EMG. Cuando la usuaria guarda
   "Mi equipo", el plan se recalcula desde la semana actual (`regenerarConEquipo`). Igual para `tieneEstimulacion = false`
   (sensores de biofeedback sin corriente).
4. **Bandera roja**: los tipos no permitidos se reemplazan por PFMT-CONCIENCIA (y se deduplica), de modo que ningún día queda vacío
   y RF-02 (b) "el plan se genera igualmente solo con ejercicios sin equipo" se cumple. Al marcar "ya consulté" el plan se recalcula
   desde la semana actual (`regenerarConSeguridad`).
5. **Tiempos por defecto** (no clínicos, solo de guía): Knack = 3 s contrae + 5 s suelta × reps; funcional = 5 s por repetición,
   caminar 120 s, 30 s de descanso entre ejercicios; supresión = 5 rápidas (1 s/1 s) + 10 s sostén + 10 s suelta × 3; TENS = una fase
   continua con avisos cada 5 min; descanso entre series 60 s (catálogo). BIO-RESIST en mantenimiento (nivel 9, sin metas) usa
   `pfmt.sostenS + 2`.
6. **Seguridad incompleta**: una contraindicación sin responder cuenta como "no descartada" (`contraindicacionEST = true`) y
   `puedeIniciarEST` devuelve `incompleta`. La vigencia es ≤ 90 días inclusive.
7. **Equipo con parámetros fijos** (`aplicaFicha = false` + `parametrosFijos`, p. ej. shorts externos): la línea de tiempo de las
   sesiones EST-* usa esos valores y un solo bloque (el equipo gestiona su programa mixto).

## Consecuencias
+ RF-02, RF-05 y RF-06 se cumplen para todos los perfiles sin días vacíos ni sesiones duplicadas.
+ Las decisiones quedan visibles: cada entrada reemplazada lleva `reemplazaA` y `motivoReemplazo`, y el plan `reglasAplicadas[]`.
− Son reglas en código, no en el catálogo: si el profesional quiere otra política, se cambia aquí con un ADR nuevo.
