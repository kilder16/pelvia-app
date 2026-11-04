# Manual técnico — PELVIA 0.1.0
Para quien mantenga la app (Kilder). Complementa `docs/diseno.md` (no lo repite) y `README.md`.

## 1. Arquitectura en una página
- **Diagramas**: contexto, contenedores y componentes C4 → `docs/diseno.md §2`; secuencias evaluación/sesión/cierre de semana/respaldo
  → `§4`; modelo de datos → `§5`; tablas de decisión → `§6`; pantallas → `§7`; tokens → `§8`; ilustraciones → `§9`; temporizador → `§10`.
- **Capas** (regla de dependencia verificada por el revisor):
  `ui/` → `engine/`, `store/`, `util/` · `store/` → `engine/`, `util/` · `engine/` → solo `engine/` y `util/fechas.js`.
  El motor no toca el DOM; recibe y devuelve datos planos con `motivo` y `reglasAplicadas[]`.
- **Arranque** (`js/app.js`): carga el catálogo (único `fetch`) → `migrar()` → PIN (si hay) → puerta de consentimiento → cierre de
  semanas pendientes (`cerrarSemana` + `regenerarSemanaActual`, guarda `cambiosNivel`) → mantenimiento al pasar la semana 12 →
  router por hash → registro del service worker.

## 2. Decisiones (ADR)
| ADR | Decisión | Consecuencia práctica |
|---|---|---|
| 0001 | PWA vanilla, sin build ni npm, GitHub Pages | Se desarrolla en cualquier máquina; rutas siempre relativas |
| 0002 | La app guía el equipo, no se conecta | "Mi equipo" con mapeo de programas; la usuaria anota mA y EMG |
| 0003 | Datos solo en `localStorage` versionado | Respaldo JSON manual; PIN = barrera, no cifrado |
| 0004 | Motor de reglas declarativo y determinista | Cada decisión explicable; Gherkin → tests 1:1 |
| 0005 | Contenido clínico como datos (`protocolos.json`) | Cambiar parámetros sin tocar código; test de validación de rangos |
| 0006 | Ilustraciones SVG originales | Se regeneran con `tools/generar_ilustraciones.py` |
| 0007 | Reglas complementarias del planificador/sesión (nuevo) | Compatibilidad de nivel, fusión de duplicados, sin equipo = sin corriente, bandera roja sin días vacíos, tiempos por defecto |
| 0008 | DEMO generado por el motor con fechas relativas (nuevo) | El ejemplo es una prueba de integración visible |

## 3. Motor (`js/engine/`)
| Módulo | Funciones públicas |
|---|---|
| `catalogo.js` | `cargarCatalogo`, `crearCatalogo`, `validarCatalogo`; accesores `tipoSesion, nivel, perfil, programa, programaDePerfil, parametrosParaSemana, equivalenciaEquipo, equipoConocido, tiposEquipo, tipoEquipo, resolverEquipo, usaCorriente, fuente` |
| `seguridad.js` | `evaluarSeguridad`, `seguridadVigente`, `banderaRojaActiva`, `puedeIniciarEST` (sin `checklistConfirmado` evalúa solo la puerta previa; con `false` bloquea con código `checklist`; la UI siempre pasa por la puerta y luego por el checklist) |
| `reglas.js` | `cumpleCondicion`, `cumpleTodas`, `textoCondicion` (operadores `>= > <= < == !=`) |
| `clasificador.js` | `puntajeIciq`, `severidadDeTotal`, `clasificar` |
| `nivel.js` | `validarFuerza`, `nivelInicial` |
| `planificador.js` | `generarPlan`, `construirSemana`, `normalizarEntrada`, `capacidadesEquipo`, `regenerarSemanaActual`, `regenerarConEquipo`, `regenerarConSeguridad`, `mejoraParaMantenimiento`, `planMantenimiento`, `entradasDelDia`, `fechaEntrada`, `REEVAL` |
| `sesion.js` | `construirLineaTiempo`, `registroDeSesion`, `ciclosEST` |
| `progresion.js` | `cerrarSemana`, `adherencia`, `conteoSemana`, `compararIciq`, `reevaluacionesPendientes`, `semanasEnNivel`, `entradasPlanificadas`, `evaluacionesCon` |
| `vesical.js` | `intervaloMedio`, `intervaloObjetivo`, `intervalosDelDia`, `resumenDia` |
| `reporte.js` | `resumen` |

**Orden del planificador** (por entrada de `semanaTipo`): filtros de la entrada → compatibilidad de nivel (ADR-0007) →
`reemplazoSinEST` (contraindicación, sin equipo o `tieneEstimulacion = false`) → `reemplazoSinEMG` → `reemplazoSinSondaAnal` →
`reemplazoSinElectrodos` → bandera roja → `desdeSemana5` → VES-DIARIO y re-evaluaciones (`REEVAL-FUERZA` lunes, `REEVAL-ICIQ` y
`REEVAL-EVA` domingo) → sin duplicados. **Equipo**: `resolverEquipo` aplica los valores por defecto de `tiposEquipo`
(`tieneEstimulacion`, `tieneEMG`, `aplicaFicha`); lo que marca la usuaria prevalece. Con `aplicaFicha = false` + `parametrosFijos`,
`construirLineaTiempo` usa esos valores (`parametros.fijadosPorEquipo = true`).

## 4. Modelo de datos y store
Claves `localStorage` (prefijo `pelvia.`): `meta {esquema:1, app}`, `perfil`, `equipo`, `evaluaciones[]`, `plan`, `sesiones[]`,
`cambiosNivel[]`, `diario[]`, `ajustes {vibracion, sonido, pinHash, pinFallos, ultimoRespaldo, ultimaSemanaCerrada}`.
Esquema de entidades: `docs/diseno.md §5`, más estos campos añadidos en la implementación:
- PLAN: `programaId, fase ('principal'|'mantenimiento'), nivelInicial, entrada {perfil, contraindicacionEST, banderaRoja, equipo{…capacidades}},
  semana0, semanas[{numero, nivel, dias{L..D:[{tipo, series?, estado, reemplazaA?, motivoReemplazo?, condicion?, sesionId?}]}, reevaluaciones[]}],
  reevaluaciones {fuerza, iciq, diario, dolorEVA}, motivo, reglasAplicadas, estado, mensajeFinal?`.
- EVALUACION: `semana` (0 = inicial), `tipo ('inicial'|'reevaluacion'|'seguridad')`, `eva?`, `contexto?`.
- SESION: `dia`, `repsPlanificadas` (para la regla de < 50 %).
- CAMBIO_NIVEL: `semana`.

**Migraciones**: `js/store/repo.js → MIGRACIONES` (mapa versión → función). Para un esquema 2: subir `ESQUEMA`, añadir
`MIGRACIONES[2] = (estado) => ({ … })` y un test. `migrar()` corre al abrir; `importar()` migra el respaldo antes de escribirlo.
**Respaldo**: `{formato:'pelvia-respaldo', meta:{esquema, app, exportado}, datos:{perfil, …}}`; la importación valida todo antes de
borrar nada.

## 5. Service worker y versionado
- `sw.js`: precache de la lista `PRECACHE` (generada por `node tools/generar-precache.mjs`, que recorre `css/ js/ content/
  assets/il/ assets/icons/`; `assets/capturas/` no se precachea), cache-first con actualización en segundo plano, borrado de cachés
  `pelvia-*` antiguas en `activate`. No hace `skipWaiting` solo: la UI muestra "Nueva versión disponible — recargar" y envía
  `{tipo:'SKIP_WAITING'}`; en `controllerchange` recarga.
- Cuatro versiones independientes: **app** (`APP_VERSION` en `js/store/repo.js`, visible en Acerca de; SemVer + tag git), **caché**
  (`CACHE_VERSION` en `sw.js`, entero; súbelo en cada publicación), **catálogo** (`meta.version` en `protocolos.json`) y **esquema**
  de datos (`ESQUEMA`, solo cuando cambia la forma de lo guardado).
- `node tools/generar-precache.mjs --check` falla si la lista está desactualizada o el peso supera 2 MB (hoy ≈ 460 KB).

## 6. Pruebas
`node --test "tests/*.test.js"` (76 tests) y cobertura con `--experimental-test-coverage` (≈ 99 % de líneas en `js/engine/`).
Detalle por requisito en `docs/plan-pruebas.md`; trazabilidad en `docs/matriz-trazabilidad.md`. Los módulos de UI con lógica pura
(`onboarding`, `biblioteca`, `equipo`, `pin`, `temporizador`, `grafica-svg`) se prueban en Node: **ningún módulo de `js/ui/` puede
tocar `document`/`window` al importarse**.

## 7. Troubleshooting
| Síntoma | Causa probable | Solución |
|---|---|---|
| Pantalla "No se pudo cargar el catálogo" | `content/protocolos.json` con JSON inválido o `meta.esquema ≠ 1` | `node --test "tests/*.test.js"` (el test `rnf07_*` dice qué falla); validar el JSON |
| Cambié el catálogo y el celular no lo ve | Cache-first del SW | Subir `CACHE_VERSION`, publicar, pulsar "recargar" |
| El SW no se instala (consola: `addAll` falló) | Un archivo listado no existe (p. ej. se borró un SVG) | `node tools/generar-precache.mjs` |
| Funciona en local y no en Pages | Ruta absoluta (`/js/...`) | Usar rutas relativas; Pages sirve en `/pelvia-app/` |
| El plan no tiene sesiones con equipo | Contraindicación, bandera roja activa, sin equipo registrado o equipo con `tieneEstimulacion = false` | Ver `plan.motivo` y `plan.reglasAplicadas` (Resultado / Hoy) |
| No sube de nivel aunque "debería" | Falta una condición (2 semanas, 70 %, 2 autoevaluaciones con metas, 3 sesiones sin dolor) | El modal de cierre de semana muestra el motivo exacto |
| `node --test tests/` da "Cannot find module" | Node 22 no acepta un directorio | Usar `node --test "tests/*.test.js"` |
| El temporizador se desfasa | Pestaña en segundo plano (navegador congela rAF) | Se recalcula con `performance.now()` al volver; verificar en el celular real (PENDIENTES #5) |
| Datos "raros" tras importar | Respaldo de otra versión | `importar()` migra; si el esquema es mayor que el de la app, actualizar la app |

## 8. Incoherencias del catálogo clínico detectadas (no modificadas)
Para revisar con el profesional (PENDIENTES-EXTERNOS #2). La app usa siempre el valor del catálogo.
1. **RF-07 vs. catálogo**: la spec dice EST-IUE 20 min en semanas 1–4; `progresionSemanal` da 15 min en semanas 1–2 (coherente con
   `PROG-IUE.resumenFrecuencias` y el caso ejemplo).
2. **Caso ejemplo, semana 4**: `cambioNivel 2 → 3` dice "E ≥ 6 s y F ≥ 5 en dos autoevaluaciones", pero la autoevaluación de la semana 2
   tiene E = 5 s (< meta 6 s). Las reglas mantienen el nivel 2; `mensajeFinalEjemplo` y `semanasEjemplo[3].nivel = 3` no se cumplen (ADR-0008).
3. **Caso ejemplo, equipo**: marca "Genérico EMS/TENS" no coincide con ningún `equiposConocidos` ("Genérico EMS/TENS digital con sonda") ni trae `tipo`.
4. **RF-06 vs. catálogo**: la spec dice "PFMT diario (3 series)"; PROG-IUE da 2 series los días de estimulación y 1 el domingo.
5. **ADR-0005 vs. POGP/PROMPT**: ADR-0005 dice "ON:OFF ≤ 1:1 para fortalecimiento"; POGP y el PROMPT piden descanso mínimo 1:2. El
   test aplica 1:2 (todas las EST del catálogo son 5/10).
6. **Innovo `parametrosFijos`**: 620 µs (fuera del rango de seguridad 50–500 µs de RNF-07) y ON:OFF 5/5 (1:1). No es un tipo de
   sesión, así que el test de rangos no lo cubre; la app lo usa tal cual cuando se elige ese equipo.
7. **NeuroTrac**: la familia es `estimulador-sonda-emg` con `tieneEMG = true`, pero su nota dice que Simplex y Pelvitone no tienen EMG;
   la usuaria debe desmarcarlo.
8. **Mapeos no válidos**: Globus "PED1–PED6 → ajuste manual según ficha" e I-Tech "… → EST-FEC (con sonda anal) o EST-IUE" no son IDs de
   tipo; la UI los muestra como notas del fabricante. Innovo `sondas: ["ninguna: …"]` no es un valor de sonda.
9. **RF-17 vs. catálogo**: la spec habla del programa "STRESS"; la clave de TensCare es "STRESS / STRE".
10. **EST-SENS**: su seguridad dice "Máximo 4 semanas", pero PROG-PROLAPSO y PROG-POSTPARTO la incluyen con `nivelMax: 0` sin
    `semanasMax: 4`; si la usuaria sigue en nivel 0 después de la semana 4, el plan mantiene EST-SENS (y `progresionSemanal` solo cubre 1–4).
11. **diseno §6.2 vs. catálogo**: el diseño deriva {DOLOR, PROLAPSO}; el catálogo también FECAL. El diseño asigna PROLAPSO con
    "bandera bulto visible"; el catálogo solo con `prol ≥ 3` (el bulto es bandera roja BR-BULTO).
12. **diseno §6.3 vs. catálogo**: el diseño exige P ≥ 3 para nivel 3; con las reglas del catálogo P = 2, E = 7, F = 6 da nivel 3.
13. **PROG-PREVENCION / PROG-DOLOR**: re-evaluación de fuerza en 4/8/12 y ninguna, respectivamente, frente a RF-14 "fuerza cada 2 semanas".
14. **PFMT-SERIE en DOLOR**: el motivo dice "se introduce solo desde la semana 5", pero `desdeSemana5` introduce PFMT-CONCIENCIA.
15. **BIO-RESIST** en mantenimiento (nivel 9, `metas: {}`): "metaE + 2" no está definido; el motor usa `pfmt.sostenS + 2` (ADR-0007).
16. **EST-MIX** semanas 5–12: "bloque 2 a 50 Hz" está solo como nota; el bloque 2 conserva 35 Hz en los parámetros.
17. **EST-URG** `rangosAceptables`: `onS [5, 1200]`, `offS [0, 10]` (admite modo continuo); conviene confirmarlo.

## 9. Deuda técnica
- Sin prueba automatizada de extremo a extremo en el repo (los recorridos de Playwright se hicieron durante la implementación; se
  podrían guardar como `tools/e2e.py`).
- `localStorage` es síncrono y limitado (~5 MB); suficiente para 12 semanas (≈ 100 KB). Si crece (diario detallado, varios años),
  evaluar IndexedDB (ADR nuevo).
- Sin internacionalización (solo es-PE).
- El PIN guarda un SHA-256 con sal fija: barrera ante miradas, no protección real; cifrar los datos exigiría un ADR nuevo.
- Los tiempos de PFMT-KNACK, PFMT-FUNCIONAL y VES-SUPRESION son convenciones de la app (ADR-0007), no del catálogo.
- Las ilustraciones se editan regenerándolas desde `tools/generar_ilustraciones.py` (no a mano).

## 10. Pendientes externos
Ver `PENDIENTES-EXTERNOS.md`: modelo real del equipo (#1), revisión profesional del catálogo (#2), logo `assets/icons/logo-kolh.png` (#3;
al copiarlo, ejecutar `node tools/generar-precache.mjs` y subir `CACHE_VERSION`), repo y Pages (#4), prueba en el celular real (#5),
nombre definitivo (#6), licencia ICIQ (#7), empaquetado para Play (#8).
