# Manual técnico — PELVIA 0.1.1
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
`node --test "tests/*.test.js"` (77 tests) y cobertura con `--experimental-test-coverage` (≈ 99 % de líneas en `js/engine/`).
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

## 8. Incoherencias del catálogo clínico — resueltas en el catálogo 1.0.1
El revisor de la v0.1.0 detectó 17 incoherencias entre `protocolos.json` 1.0.0, `docs/spec.md`, `docs/diseno.md` y ADR-0005. El
autor las resolvió en el catálogo **1.0.1** y en esos documentos (v3); la app no cambió ningún parámetro clínico por su cuenta. Cada
fila indica el test que fija el comportamiento nuevo. Sigue pendiente la revisión profesional del catálogo (PENDIENTES-EXTERNOS #2).

| # | Incoherencia (1.0.0) | Resolución (1.0.1) | Test | Estado |
|---|---|---|---|---|
| 1 | RF-07 decía 20 min en semanas 1–4; el catálogo da 15 min en 1–2 | spec RF-07: 15 min en 1–2, 20 min en 3–4, 50 Hz desde la 5 (nota: 35 Hz si el equipo no lo permite) | `rf07_estIue_sem1_35hz15min`, `rf07_estIue_sem5_50hz` | ✅ Resuelta |
| 2 | Caso ejemplo: E = 5 s en la semana 2 impedía subir a nivel 3 | `semanasEjemplo[1].autoevaluacion.E = 6`; el motor sube 2 → 3 en la semana 4 | `rf16_cargaDemoConEtiqueta`, `rf13_seriesEF` | ✅ Resuelta |
| 3 | Equipo del ejemplo sin `tipo` y con marca inexistente | marca "Genérico EMS/TENS digital con sonda", `tipo: tens-ems-generico` | `rf16_cargaDemoConEtiqueta` | ✅ Resuelta |
| 4 | RF-06 "PFMT diario (3 series)" vs 2/1 del catálogo | spec RF-06 explica 3 series M-J-S, 2 en días con estimulación, 1 el domingo | `rf06_iueNivel2_semanaTipo` | ✅ Resuelta |
| 5 | ADR-0005 ON:OFF ≤ 1:1 vs POGP 1:2 | ADR-0005: ON:OFF de al menos 1:2 (OFF ≥ 2 × ON) | `rnf07_jsonValido_referenciasYRangos` | ✅ Resuelta |
| 6 | Innovo 620 µs y ON:OFF 1:1 fuera de rangos | `parametrosFijos.exentoValidacion = true` + `porQue`; la validación los omite y la ficha no muestra el metadato | `rnf07_parametrosFijos_exentoValidacion`, `rf08_tensContinuo_y_parametrosFijos` | ✅ Resuelta |
| 7 | NeuroTrac marcado con EMG aunque Simplex/Pelvitone no lo tienen | Separado en "NeuroTrac — sin EMG" y "NeuroTrac MyoPlus — con EMG" (11 entradas) | `rf17_tiposDeEquipo_recalculanPlan`, `rf17_v2_onceFamiliasYEquipoNoIdentificado` | ✅ Resuelta |
| 8 | Mapeos de Globus/I-Tech a texto libre; Innovo sonda "ninguna: …" | Todos los programas apuntan a tipos válidos; Innovo `sondas: ["electrodos-externos"]` | `rnf07_jsonValido_referenciasYRangos` (mapeos), `rf17_v2_onceFamiliasYEquipoNoIdentificado` | ✅ Resuelta |
| 9 | RF-17 "STRESS" vs clave "STRESS / STRE" | Claves separadas `STRESS` y `STRE` → EST-IUE | `rf17_tenscareElise_mapeo`, `rf07_equivalenciaProgramaEquipo` | ✅ Resuelta |
| 10 | EST-SENS "máx. 4 semanas" sin `semanasMax` | `semanasMax: 4` en el tipo y en cada entrada de PROLAPSO/POSTPARTO; el planificador también lo aplica cuando EST-SENS entra como sugerida del nivel 0 | `rf06_filtroNivelMin`, `rnf07_jsonValido_referenciasYRangos` | ✅ Resuelta |
| 11 | diseno §6.2: derivación sin FECAL y bulto como criterio de PROLAPSO | diseno §6.2: derivar incluye FECAL; el bulto es bandera roja BR-BULTO (§6.1) | `rf04_prolapsoDeriva`, `rf04_otrasReglas_urgenciaFecalDerivarSeveridad` | ✅ Resuelta |
| 12 | diseno §6.3 P ≥ 3 para nivel 3 vs catálogo (P = 2 daba nivel 3) | Nueva regla del catálogo `P ≤ 2 → nivel 2` ("aprieta sin elevar"); diseno §6.3 actualizado | `rf05_maximoInicial4` | ✅ Resuelta |
| 13 | Re-evaluaciones de PREVENCION/DOLOR distintas de RF-14 | spec RF-14 describe el calendario por programa (PREVENCIÓN cada 4 semanas; DOLOR con EVA) | `rf06_reevaluacionesInsertadas`, `rf14_pendienteSemana4` | ✅ Resuelta |
| 14 | Motivo de PFMT-SERIE en DOLOR vs `desdeSemana5` | El motivo explica que desde la semana 5 entra PFMT-CONCIENCIA y la serie solo con indicación profesional | `rf06_dolorDesdeSemana5_condicional` | ✅ Resuelta |
| 15 | BIO-RESIST en nivel 9 sin metas | Nivel 9 con `metas {E: 9, F: 10}` → sostén 11 s | `rf17_v2_tipoFijaValoresPorDefecto_usuariaCorrige` | ✅ Resuelta |
| 16 | EST-MIX "bloque 2 a 50 Hz" solo como nota | Sin progresión de Hz (`progresionSemanal` 1–12 sin cambios); el bloque 2 queda a 35 Hz y la seguridad explica cuándo subir a 50 Hz | `rf08_bloquesMix_10y10` | ✅ Resuelta |
| 17 | EST-URG `onS [5, 1200]`, `offS [0, 10]` | `onS [5, 10]`, `offS [5, 10]`, `continuoPermitido: true` | `rnf07_parametrosFijos_exentoValidacion`, `rnf07_jsonValido_referenciasYRangos` (rangos coherentes) | ✅ Resuelta |

Cambios en el código por la 1.0.1 (sin tocar parámetros): el planificador respeta `semanasMax` del tipo de sesión y `sesion.js`
no pasa `exentoValidacion`/`porQue` a la ficha (guarda `porQueFijos` para explicarlo). La validación `rnf07_*` comprueba además
que cada `rangosAceptables` sea `[min, max]` y contenga el valor base, que EST-SENS tenga `semanasMax: 4` en todas partes y que los
`parametrosFijos` sin `exentoValidacion` cumplan los rangos de seguridad.

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
