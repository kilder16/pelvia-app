# Changelog
Todos los cambios relevantes de PELVIA. Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/);
versionado: [SemVer](https://semver.org/lang/es/). La versión de la app está en `js/store/repo.js → APP_VERSION` y la de la caché en
`sw.js → CACHE_VERSION`; la del catálogo clínico en `content/protocolos.json → meta.version`.

## [Sin publicar]

## [0.1.1] - 2026-11-03
### Cambiado
- Catálogo clínico 1.0.1 (autor): resuelve las 17 incoherencias del revisor de la 0.1.0; `docs/spec.md` (RF-06, RF-07, RF-14),
  `docs/diseno.md` (§6.2, §6.3) y ADR-0005 alineados. Detalle en `docs/manual-tecnico.md` §8.
- El caso DEMO sube de nivel 2 a 3 en la semana 4 (autoevaluación de la semana 2 con E = 6 s), generado por el motor real.
- Mi equipo: NeuroTrac separado en modelos sin EMG y MyoPlus con EMG; TensCare con claves `STRESS` y `STRE`.
- Nivel inicial: P ≤ 2 limita el nivel a 2.
- EST-MIX sin progresión de frecuencia (bloque 2 a 35 Hz); EST-URG con rangos acotados.
- `CACHE_VERSION` 2 en `sw.js` para que los celulares descarguen el catálogo nuevo.

### Corregido
- El planificador respeta `semanasMax` del tipo de sesión: EST-SENS no pasa de la semana 4 aunque entre como sugerida del nivel 0.
- La ficha de un equipo con parámetros fijos ya no recibe los metadatos `exentoValidacion`/`porQue` del catálogo.

### Pruebas
- Tests ajustados al catálogo 1.0.1 y nuevo `rnf07_parametrosFijos_exentoValidacion`; la validación del catálogo comprueba rangos
  aceptables, `semanasMax` de EST-SENS, mapeos de programas y `parametrosFijos` no exentos (77 tests).

## [0.1.0] - 2026-11-03
### Añadido
- Especificación, diseño (C4, secuencias, datos, reglas), ADR 0001–0006 y catálogo clínico 1.0.0 (fases 1–2).
- Motor de reglas puro (`js/engine/`): seguridad con vigencia de 90 días, ICIQ-UI SF, clasificación en 8 perfiles, nivel inicial
  PERFECT simplificado, plan de 12 semanas con reemplazos por seguridad/equipo, línea de tiempo de sesiones (EST, TENS, PFMT, BIO,
  relajación, vesical), progresión y regresión de nivel, re-evaluaciones, entrenamiento vesical, resumen de progreso, mantenimiento.
- Store versionado sobre `localStorage`, caso DEMO generado con el motor real, respaldo JSON exportar/importar.
- Interfaz completa: onboarding con consentimiento, evaluación en 3 pasos, resultado, Hoy, sesión guiada a pantalla completa con
  temporizador (`performance.now`), vibración, sonido y pantalla encendida, biblioteca, progreso con gráficas SVG, entrenamiento
  vesical, Mi equipo (equipos conocidos y tipos de equipo), Aprende, Ajustes, PIN, Acerca de, informe imprimible.
- 22 ilustraciones SVG originales (IL-01..IL-14, IL-13 en 8 variantes) e iconos PWA.
- PWA instalable: `manifest.webmanifest`, `sw.js` con precache explícito y aviso de nueva versión.
- Tests con `node --test` por requisito, plan de pruebas, manuales de usuario y técnico, runbook de despliegue.
- ADR 0007 (reglas complementarias del planificador y de la sesión) y ADR 0008 (DEMO generado por el motor).
