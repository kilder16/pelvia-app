# Plan de pruebas — PELVIA
Versión: 0.1.0 · Fecha: 2026-11-03 · Fase 4 del ciclo · Depende de `docs/spec.md` v0.1 y `docs/diseno.md` v0.1

## 1. Objetivo
Demostrar que cada requisito funcional (RF-01..RF-21) y no funcional verificable (RNF-01..RNF-11) se cumple, con énfasis en la
**seguridad clínica** (RF-02, RF-21, RNF-08): ninguna sesión con corriente puede planificarse ni iniciarse con contraindicación,
con el cuestionario vencido (> 90 días) o incompleto, ni sin pasar la lista de verificación.

## 2. Alcance y niveles
| Nivel | Qué cubre | Herramienta | Cuándo |
|---|---|---|---|
| Unitario | `js/engine/*` (funciones puras), `js/util/fechas.js` | `node --test` (Node ≥ 20, sin dependencias) | En cada cambio |
| Integración | `js/store/*` con almacén en memoria; caso DEMO generado por el motor real; respaldo exportar → importar | `node --test` | En cada cambio |
| Lógica de UI | Funciones puras de `ui/vistas/{onboarding,biblioteca,equipo}.js`, `ui/componentes/pin.js` (y temporizador con reloj inyectado) | `node --test` | En cada cambio |
| Extremo a extremo | Recorrido de la usuaria en el navegador (móvil 390×844) | Playwright (Edge) + revisión manual | Antes de cada publicación |
| Manual en dispositivo | Vibración, sonido, Wake Lock, instalación, offline, sesión real de 20 min | Celular de la usuaria | PENDIENTES-EXTERNOS #5 |

Fuera de alcance: el electroestimulador (la app no se conecta a él, ADR-0002) y la validez clínica de los parámetros
(revisión profesional, PENDIENTES-EXTERNOS #2).

## 3. Cómo ejecutar
```powershell
node --test "tests/*.test.js"                                   # todos los tests
node --test --experimental-test-coverage "tests/*.test.js"      # con cobertura
node tools/generar-precache.mjs --check                         # lista de precache al día y peso < 2 MB
```
Criterio de salida: 0 fallos y cobertura de líneas ≥ 80 % en `js/engine/` (RNF-09).

## 4. Cobertura objetivo y obtenida
| Módulo | Líneas objetivo | Obtenida (0.1.0) |
|---|---|---|
| `js/engine/*` | ≥ 80 % | ver `docs/matriz-trazabilidad.md` y el informe de la corrida (≈ 99 %) |
| `js/store/*` | ≥ 80 % | ≈ 97–100 % |

## 5. Casos por requisito
Cada test lleva el ID del requisito en el nombre. Archivo → test.

| Req | Caso (Dado / Cuando / Entonces resumido) | Test |
|---|---|---|
| RF-01 | Sin consentimiento → Evaluación/Hoy/Biblioteca deshabilitados y rutas bloqueadas | `ui.onboarding.test.js → rf01_sinConsentimientoBloquea` |
| RF-02 | Embarazo → `contraindicacionEST`, plan sin EST/TENS, mensaje de consulta | `seguridad.test.js → rf02a_embarazoBloqueaEST` |
| RF-02 | Hematuria → bandera roja, plan solo ejercicios sin equipo, sin días vacíos; "ya consulté" desbloquea | `rf02b_hematuriaBanderaRoja` |
| RF-02 | 90 días vigente, 91 vencida | `rf02c_vigencia90dias` |
| RF-02 | Precauciones con mensaje, no bloquean | `rf02_precaucionesConMensaje` |
| RF-03 | ICIQ 3 + 2 + 6 = 11, moderada; límites de severidad | `clasificador.test.js → rf03_iciq_3_2_6_da11_moderada` |
| RF-04 | esf 3 → IUE; esf 2 + urg 3 → MIXTA (urgencia), empate → esfuerzo; dol ≥ 2 domina y deriva; prol 3 → PROLAPSO deriva; todo 0 → PREVENCIÓN; postparto; urgencia por frecuencia; fecal; severa y vaciado derivan | `rf04_iue`, `rf04_mixtaPredominioUrgencia`, `rf04_dolorDomina`, `rf04_prolapsoDeriva`, `rf04_prevencion`, `rf04_otrasReglas_urgenciaFecalDerivarSeveridad` |
| RF-05 | P2 E4 R6 F4 → nivel 2; P ≤ 1 → nivel 0 con EST-SENS en el plan; tope inicial 4 | `nivel.test.js → rf05_p2e4r6f4_nivel2`, `rf05_p1_nivel0`, `rf05_maximoInicial4` |
| RF-06 | IUE nivel 2: EST-IUE L-X-V, PFMT diario, BIO M-J; re-evaluaciones fuerza 2..12 e ICIQ 4/8/12; diario 0/4/8; reemplazos sin EST/EMG/sonda anal/electrodos; filtros de nivel; regenerar por nivel/equipo/seguridad; semana 13 | `planificador.test.js → rf06_*` (8 tests) |
| RF-07 | EST-IUE semana 1: 35 Hz, 250 µs, 5/10, rampa 1, 15 min; semana 5: 50 Hz; equivalencia con programa del equipo | `catalogo.test.js → rf07_*` |
| RF-08 | 5/10 × 20 min = 80 ciclos con rampa en el ON; EST-MIX 40 + pausa 30 s + 40; TENS continuo; equipo con parámetros fijos | `sesion.test.js → rf08_*` |
| RF-09 | PFMT nivel 2: 8 × 5 s / 10 s + 5 rápidas; BIO-RELAJ 60 + 300 + 60; registro de reps/EMG | `rf09_*` |
| RF-10 | Perfil DOLOR: todos los tipos visibles, EST-IUE "No recomendada para tu perfil" + motivo | `biblioteca.test.js → rf10_marcaNoRecomendadaDolor` |
| RF-11 | Sube con ≥ 2 semanas, adherencia ≥ 70 %, metas E/F en 2 autoevaluaciones, 3 sesiones sin dolor; baja por 2 dolores seguidos o 3 sesiones < 50 % reps; mínimo 0; máximo 5 | `progresion.test.js → rf11_*` |
| RF-12 | Semana ISO y día del plan; completar una sesión marca la entrada "hecha" | `fechas.test.js → rf12_semanaIso_diaPlan`, `repo.test.js → rf12_guardarSesion_marcaHecha` |
| RF-13 | DEMO: adherencia 12/14, 13/14, 12/14, 13/14; series E, F, mA, ICIQ con fecha y orden | `reporte.test.js → rf13_*` |
| RF-14 | Cerrar semana 3 → pendientes fuerza e ICIQ de la semana 4; ICIQ 11 → 10 = mejora insuficiente | `rf14_pendienteSemana4`, `rf14_mejoraInsuficiente_11a10` |
| RF-15 | Basal 90 min → 105 en semana 1; tope 240 | `vesical.test.js → rf15_*` |
| RF-16 | DEMO marcado, resultado = `resultadoEsperado`, 4 semanas, hoy = semana 5; Restablecer borra solo `pelvia.*` | `repo.test.js → rf16_*` |
| RF-17 | TensCare Elise → STRESS/URGE/MIXED/TONE ↔ EST-IUE/URG/MIX/TONO; sensores sin estimulación sin EST; Innovo con parámetros fijos | `equipo.test.js → rf17_*` |
| RF-18 | Exportar → importar en almacén vacío = estado idéntico; nombre `pelvia-respaldo-AAAA-MM-DD.json` | `respaldo.test.js → rf18_exportImportIdentico` |
| RF-19 | SHA-256 del PIN; 5 fallos → ofrecer restablecer | `pin.test.js → rf19_*` |
| RF-20 | Aprende con IL-02 y errores comunes | Revisión visual (Playwright + checklist del revisor) |
| RF-21 | EST-*: no inicia sin "Confirmo" | `puedeIniciarEST(checklistConfirmado=false)` en `rnf08_noIniciaESTconContraindicacion` + e2e Playwright |
| RNF-01 | Instalable y offline | Manual: Lighthouse / modo avión |
| RNF-02 | Sin npm ni CDN | Revisor: búsqueda de `cdn`, `unpkg`, `jsdelivr`, `http` en `<script>`; no existe `package.json` |
| RNF-03 | Único fetch a `content/protocolos.json` | Revisor: búsqueda de `fetch(` en `js/` |
| RNF-06 | Temporizador sin desfase acumulado; peso < 2 MB | Test de temporizador con reloj inyectado (si existe) + `tools/generar-precache.mjs --check` + prueba manual de 20 min |
| RNF-07 | Catálogo válido: referencias, fuentes, Hz 1–120, µs 50–500, ≤ 30 min, ON ≥ 3 s, ON:OFF ≤ 1:2 | `catalogo.test.js → rnf07_jsonValido_referenciasYRangos`, `rnf07_compatibilidadEsquema_y_carga` |
| RNF-08 | Ninguna contraindicación permite iniciar | `seguridad.test.js → rnf08_noIniciaESTconContraindicacion` |
| RNF-09 | Cobertura ≥ 80 % en engine | `node --test --experimental-test-coverage` |

## 6. Estrés y casos negativos (obligatorios)
| Caso | Esperado | Test |
|---|---|---|
| Cuestionario de seguridad vacío o con una pregunta sin responder | Incompleto, `contraindicacionEST = true` si falta una contraindicación, no inicia EST | `rnf08_negativo_respuestasVaciasOIncompletas` |
| Síntomas vacíos / valor 4 / `null` | `RangeError` con las preguntas faltantes | `rf04_negativo_respuestasIncompletas` |
| ICIQ fuera de rango (q1 = 6, q2 = 3, q3 = 11, decimal, falta ítem) | `RangeError` | `rf03_negativo_iciqFueraDeRango` |
| Fuerza fuera de rango / vacía | `RangeError` | `rf05_negativo_valoresFueraDeRango` |
| Equipo sin EMG, sin equipo, sensor sin estimulación, sin evaluación de seguridad | BIO-* → PFMT; sin corriente; motivo explicado | `rf06_negativo_equipoSinEMG_sinEquipo_sinEstimulacion` |
| Perfil DOLOR con contraindicación | Sin EST/TENS; relajación | `rf06_sinEST_reemplazos`, `rf06_dolorDesdeSemana5_condicional` |
| Importar JSON corrupto, sin `meta.esquema`, esquema futuro, claves desconocidas, tipos inválidos | Error legible y estado intacto | `rf18_rechazaSinMeta` |
| Semana 13 (con y sin mejora; DOLOR; PREVENCIÓN) | Mantenimiento nivel 9 desde semana 13 o derivación | `rf06_negativo_semana13_mantenimientoODerivar` |
| Datos de `localStorage` dañados / esquema más nuevo | Valor por defecto / error "versión más nueva" | `rf16_store_leerGuardarMigrar` |
| Catálogo incompatible o no descargable | Error explícito | `rnf07_compatibilidadEsquema_y_carga` |
| Sesión larga (80 ciclos) | Duración exacta 1200 s, sin redondeos acumulados | `rf08_lineaTiempo_5_10_20min_80ciclos` |

## 7. Datos de prueba
Solo datos **ficticios**: el caso ejemplo "Ana (ejemplo)" del catálogo y respuestas generadas en `tests/ayuda.js`
(`respuestasSeguridad`, `sintomas0`, `equipoVaginalEMG`). Fechas fijas (2026) para que los tests sean deterministas.
Ningún test ni captura usa datos de una persona real.

## 8. Pruebas manuales antes de cada publicación (checklist)
1. `node --test "tests/*.test.js"` en verde y `node tools/generar-precache.mjs --check` OK.
2. `python -m http.server 8080` → abrir `http://localhost:8080` en el celular o en el navegador en modo móvil.
3. Primer uso: sin consentimiento no se puede entrar (RF-01).
4. "Ver ejemplo": banda DEMO en todas las pantallas; Progreso con gráficas; Informe imprimible sin barra (RF-16, RF-13, RF-18).
5. Sesión EST-IUE: checklist exige "Confirmo"; ficha correcta; temporizador alterna CONTRAE/RELAJA con vibración/sonido; pausa y
   reanudar; al terminar pide mA, esfuerzo y dolor (RF-07, RF-08, RF-21).
6. Pantalla encendida durante la sesión; bloquear y desbloquear el celular no pierde la fase (§10).
7. Modo avión tras la primera carga: la app abre y funciona (RNF-01).
8. Sesión real de 20 min contra un cronómetro externo: desfase total < 2 s (RNF-06).
