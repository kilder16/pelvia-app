# PROMPT PARA CLAUDE CODE — PELVIA (fases 3 a 6)

> Cómo usarlo: en la carpeta del proyecto, abre Claude Code y escribe:
> `Lee PROMPT-CLAUDE-CODE.md y ejecútalo completo en modo autónomo, sin pedirme confirmación entre fases.`

---

## 0. Contexto y reglas de trabajo

Eres el equipo de implementación de **PELVIA**, una PWA de celular para que una usuaria adulta haga terapia de suelo pélvico guiada
con su electroestimulador/biofeedback. Las fases 1 y 2 (especificación y diseño) **ya están hechas y aprobadas**; tu trabajo son las
fases 3 (implementación), 4 (pruebas), 5 (documentación) y 6 (despliegue), en ese orden, dejando el artefacto de cada fase.

Lee primero, completos y en este orden:
1. `docs/spec.md` — requisitos RF-01..RF-21, RNF-01..RNF-11 y criterios de aceptación Gherkin.
2. `docs/diseno.md` — arquitectura C4, estructura de carpetas (§3, obligatoria), secuencias, modelo de datos, tablas de decisión (§6), pantallas (§7), tokens (§8), ilustraciones (§9), temporizador (§10).
3. `docs/adr/0001..0006` — decisiones que no puedes cambiar sin escribir un ADR nuevo.
4. `content/protocolos.json` — el catálogo clínico ya validado (JSON correcto, referencias cruzadas verificadas). **No cambies parámetros clínicos**; si detectas una incoherencia, repórtala en el informe final y deja el valor tal cual.
5. `docs/matriz-trazabilidad.md` — nombres previstos de archivos y tests; úsalos tal cual para que la matriz cierre.
6. `PENDIENTES-EXTERNOS.md` — lo que no puedes resolver tú; no te detengas por esos puntos.

Reglas duras:
- **Modo autónomo**: no pidas confirmación entre fases ni gates. Decide, documenta en un ADR si la decisión es grande, y avanza. Solo detente ante un bloqueador externo real (no hay ninguno para la implementación).
- **Stack**: HTML + CSS + JavaScript ES modules, **sin build step, sin npm, sin package.json, sin librerías externas en runtime** (ADR-0001). Gráficas en SVG propio. Tests con el runner nativo `node --test` (Node ≥ 20).
- **Idioma**: toda la UI, textos, comentarios de código orientados a la usuaria y documentación en **español**. Nombres de archivos y funciones en español consistente (como en `docs/diseno.md`).
- **El motor (`js/engine/`) no importa nada de `ui/` ni de `store/`** y no toca el DOM; recibe datos planos y devuelve datos planos con `motivo` y `reglasAplicadas[]` (ADR-0004).
- **Seguridad clínica es prioritaria sobre cualquier otra cosa**: ninguna sesión EST-*/TENS-* puede iniciarse con contraindicación absoluta, con seguridad vencida (> 90 días) o sin pasar el checklist (RF-02, RF-21, RNF-08). El aviso "No sustituye la valoración de un profesional de salud." aparece en Resultado, en cada sesión y en el Informe.
- **Privacidad**: cero llamadas de red con datos; el único `fetch` permitido es a `content/protocolos.json` (ADR-0003).
- **Ilustraciones**: SVG originales, esquemáticas, no explícitas, con `role="img"` y `aria-label` en español (ADR-0006, `docs/diseno.md §9`). Nunca copies imágenes de internet.
- **Commits**: Conventional Commits con el ID del requisito: `feat(engine): clasificador de perfiles [RF-04]`. Un commit por RF o por componente; `git init` si no hay repo.
- Cada test lleva el ID del requisito en el nombre (`rf04_mixtaPredominioUrgencia`).
- Al terminar cada fase imprime la **tabla de avance** (sección 6) y sigue con la siguiente.

## 1. Particionado para `diseno-paralelo`

Usa el skill `diseno-paralelo` con estos subagentes (si el skill solo define backend-java / oracle-sql / frontend-spa / revisor, usa
`frontend-spa` para la UI y crea agentes general-purpose con los nombres de abajo para el resto). Todos leen `docs/diseno.md` antes de empezar.

```
ENTREGA POR SUBAGENTE
├── motor-js/          COMPLETABLE: js/engine/{catalogo,seguridad,clasificador,nivel,planificador,sesion,progresion,vesical,reporte}.js
│                                   + js/store/{repo,respaldo}.js + tests/ (node --test) + docs/plan-pruebas.md
│                      BLOQUEADO: nada
├── frontend-spa/      COMPLETABLE: index.html, css/, js/app.js, js/router.js, js/ui/vistas/*, js/ui/componentes/*, js/util/*
│                      BLOQUEADO: nada (usa placeholder para logo-kolh.png si no existe)
├── ilustraciones-svg/ COMPLETABLE: assets/il/IL-01.svg .. IL-14.svg (+ IL-13 en 8 variantes) e iconos PWA 192/512
│                      BLOQUEADO: nada
├── pwa-infra/         COMPLETABLE: manifest.webmanifest, sw.js (precache explícito + cache-first + versión), README.md,
│                                   docs/runbook.md, docs/despliegues.md, .gitignore, CHANGELOG.md
│                      BLOQUEADO: crear el repo remoto y activar Pages (Kilder, PENDIENTES-EXTERNOS #4)
└── revisor/           valida: código vs diseño (estructura §3, dependencias §2.3) · cada RF tiene test verde ·
                       catálogo intacto · seguridad clínica (RNF-08) · sin CDN ni npm · ilustraciones referenciadas existen ·
                       doc refleja el código · matriz de trazabilidad cerrada · tabla de avance final
```

Orden recomendado: `motor-js` y `ilustraciones-svg` en paralelo → `frontend-spa` (necesita el motor) → `pwa-infra` → `revisor`.

## 2. Fase 3 — Implementación (qué construir, por componente)

### 2.1 `js/engine/catalogo.js`
- `cargarCatalogo(url = 'content/protocolos.json')` (fetch + validación mínima de `meta.esquema === 1`) y `crearCatalogo(json)` para tests.
- Accesores: `tipoSesion(id)`, `nivel(id)`, `programaDePerfil(perfil)`, `parametrosParaSemana(tipoSesionId, semana)` (aplica `progresionSemanal`: devuelve los parámetros base con los campos sobrescritos de la fila cuya `semanas` [a,b] contiene la semana), `equivalenciaEquipo(tipoSesionId, equipo)`.

### 2.2 `js/engine/seguridad.js`
- `evaluarSeguridad(respuestas, catalogo)` → `{contraindicacionEST, contraindicaciones[], precauciones[], banderasRojas[], fecha}` con los textos del catálogo.
- `seguridadVigente(evaluacion, hoy, dias = catalogo.seguridad.vigenciaDias)` → boolean.
- `puedeIniciarEST(estado)` → `{ok, motivo}`; `ok=false` si contraindicación, vencida, o bandera roja sin `consultada = true`.

### 2.3 `js/engine/clasificador.js`
- `puntajeIciq({q1,q2,q3}, catalogo)` → `{total, severidad}`.
- `clasificar(sintomas, contexto, iciq, catalogo)` → `{perfil, predominio?, severidad, derivar, motivo, reglasAplicadas[]}` aplicando `reglasClasificacion.orden` en orden (operadores `>=`, `>`, `<=`, `<`, `==`), `predominioMixta` y `derivar`.

### 2.4 `js/engine/nivel.js`
- `nivelInicial({P,E,R,F}, catalogo)` → `{nivel, motivo}` con `reglasNivel.orden` (primera regla que cumple, en orden; `[]` = por defecto) y tope `nivelMaximoInicial`.

### 2.5 `js/engine/planificador.js`
- `generarPlan({perfil, nivel, seguridad, equipo, fechaInicio, iciqInicial, evaInicial}, catalogo)` → objeto PLAN de `docs/diseno.md §5` con `semanas[1..12]`, cada una `{numero, dias:{L..D:[{tipo, series?, estado:'pendiente'}]}, reevaluaciones:[...]}`.
- Aplica, en este orden: filtros `nivelMin/nivelMax/semanasMax` de cada entrada; `reemplazoSinEST` si `contraindicacionEST` **o** `equipo.tieneEstimulacion === false`; `reemplazoSinEMG` si `!equipo.tieneEMG`; `reemplazoSinSondaAnal` si `equipo.tipoSonda !== 'anal'` y no hay sonda anal; `reemplazoSinElectrodos` si no hay electrodos; `banderaRojaActiva`; `desdeSemana5` (PROG-DOLOR); inserción de VES-DIARIO, autoevaluación de fuerza, ICIQ y EVA según `insercionDiario` / `insercionReevaluaciones`; sin duplicados en un mismo día.
- `regenerarSemanaActual(plan, nivelNuevo, catalogo)` para cambios de nivel.
- `planMantenimiento(plan, catalogo)` para la semana 13 si `mejoraParaMantenimiento`.

### 2.6 `js/engine/sesion.js`
- `construirLineaTiempo(tipoSesionId, {nivel, semana}, catalogo)` → `{fases:[{nombre:'CONTRAE'|'RELAJA'|'DESCANSO'|'RAPIDA'|'SUELTA'|'INHALA'|'EXHALA'|'POSTURA'|'CAMBIO_PROGRAMA', seg, instruccion, serie?, rep?}], totalSeg, parametros, bloques?}`.
  - EST con `onS/offS`: ciclos hasta cubrir `duracionMin` (p. ej. 5/10 × 20 min = 80 ciclos); la rampa va dentro del ON (instrucción "sube").
  - EST-MIX: bloque 1 → fase `CAMBIO_PROGRAMA` de 30 s (pausa automática) → bloque 2.
  - TENS (`continuo`): una sola fase de `duracionMin` con avisos cada 5 min.
  - PFMT-SERIE / BIO-LENTAS: usan `niveles[nivel].pfmt` (sostén, descanso, reps, rápidas; `series` según la entrada del día); descanso entre series 60 s.
  - BIO-RESIST: sostén = `metaE + 2` del nivel; PFMT-CONCIENCIA, BIO-RELAJ, RELAJ-*: `estructura.bloques`.
- `registroDeSesion(tipoSesionId)` → lista de campos a pedir al final (`intensidadMA`, `esfuerzo`, `dolor`, `repsLogradas`, `emgPicoUV`, `emgReposoUV`, `nota`) según `estructura.registra` y categoría.

### 2.7 `js/engine/progresion.js`
- `cerrarSemana({plan, sesiones, evaluaciones, hoy}, catalogo)` → `{accion:'subir'|'bajar'|'mantener', nivelDesde, nivelHasta, motivo, reevaluacionPendiente:[...], mejoraInsuficiente:boolean}` con las reglas de `docs/diseno.md §6.5` y `reglasProgresion`.
- `adherencia(plan, sesiones, semana)` → fracción hechas/planificadas.
- `compararIciq(inicial, actual, catalogo)` → `{delta, mejoraSuficiente}` (RF-14).

### 2.8 `js/engine/vesical.js`
- `intervaloMedio(diario3dias)`, `intervaloObjetivo(intervaloMedio, semana, catalogo)` (= min(media + 15·semana, 240)).

### 2.9 `js/engine/reporte.js`
- `resumen({evaluaciones, sesiones, plan})` → adherencia por semana, series E/F/mA/ICIQ con fechas, nivel actual e historial, texto para el informe.

### 2.10 `js/store/repo.js` y `js/store/respaldo.js`
- Claves `pelvia.meta`, `pelvia.perfil`, `pelvia.equipo`, `pelvia.evaluaciones`, `pelvia.plan`, `pelvia.sesiones`, `pelvia.cambiosNivel`, `pelvia.diario`, `pelvia.ajustes`. `leer(clave)`, `guardar(clave, valor)`, `migrar()`, `cargarDemo(catalogo)` (construye el estado desde `casoEjemplo` ejecutando el motor real, no copiando resultados), `restablecer()`.
- `exportar()` → Blob JSON `pelvia-respaldo-AAAA-MM-DD.json`; `importar(json)` valida `meta.esquema`, migra y reemplaza todo.

### 2.11 UI (`index.html`, `css/`, `js/ui/`, `js/util/`)
- App shell con navegación inferior (Hoy · Biblioteca · Progreso · Aprende · Ajustes), router por hash, vistas de `docs/diseno.md §7`.
- Onboarding (RF-01), Evaluación en 3 pasos con barra de progreso (seguridad → síntomas+ICIQ → fuerza guiada con el temporizador), Resultado (perfil, severidad, nivel, semana tipo, fichas, derivación), Hoy, Sesión guiada a pantalla completa (wireframe §7; `js/ui/componentes/temporizador.js` según §10: `performance.now`, vibración `js/util/vibrar.js`, beep WebAudio `js/util/audio.js`, Wake Lock `js/util/wakelock.js`, recálculo al volver de segundo plano), Biblioteca (todos los tipos y niveles; etiqueta "No recomendada para tu perfil" con motivo), Progreso (gráficas SVG), Re-evaluaciones, Entrenamiento vesical (diario con botón "Acabo de orinar", urgencia, escape; intervalo objetivo), Mi equipo (selector marca → modelo desde `equiposConocidos`, que fija `tipo` según `tiposEquipo` y con él `tieneEstimulacion`/`tieneEMG`/`aplicaFicha`; tabla editable de programas del equipo → tipo de sesión; texto `equipoNoIdentificado` cuando elige genérico; si `aplicaFicha = false` con `parametrosFijos`, la ficha y el temporizador usan esos valores), Aprende (educación + ilustraciones), Ajustes (vibración, sonido, PIN, exportar/importar, informe, ver ejemplo, restablecer), Acerca de (versión, fuentes, logo KOLH **solo como imagen**, sin nombre en texto), Informe imprimible (`@media print`).
- Tokens de `docs/diseno.md §8`; modo oscuro; banda DEMO cuando `perfil.demo`.
- Accesibilidad RNF-05 (≥ 44 px, contraste AA, temporizador ≥ 96 px el número).

### 2.12 Ilustraciones (`assets/il/`)
- IL-01..IL-14 según `docs/diseno.md §9`; IL-13 como 8 archivos `IL-13-<perfil>.svg`. Estilo único (viewBox 400×300, trazo 3 px, 3 colores, etiquetas en español). Todas con `role="img"` y `aria-label`. Esquemáticas: siluetas y formas simples; IL-07/IL-08 solo silueta + sonda + cable + gel, sin detalle anatómico explícito.
- Iconos PWA `assets/icons/icon-192.png` e `icon-512.png` (genera el PNG desde un SVG propio con Python/Pillow si está disponible; si no, deja el SVG y anótalo en el informe).

### 2.13 PWA (`manifest.webmanifest`, `sw.js`)
- `display: standalone`, `lang: es`, `theme_color` del token primario, iconos.
- `sw.js`: lista explícita de archivos a precachear (shell, css, js, content, assets), `CACHE_VERSION` incremental, estrategia cache-first con actualización en segundo plano; mensaje en UI "Nueva versión disponible — recargar".

## 3. Fase 4 — Pruebas (`tests/`, `node --test`)
- Implementa **todos** los tests nombrados en `docs/matriz-trazabilidad.md`, más `rnf07_jsonValido_referenciasYRangos` (reproduce las validaciones: tipos referenciados existen, fuentes existen, Hz 1–120, µs 50–500, duración ≤ 30 min, ON ≥ 3 s cuando hay contracción, ON:OFF ≤ 1:2 en EST de fortalecimiento).
- Cobertura: `node --test --experimental-test-coverage tests/` ≥ 80 % en `js/engine/`. Si tu Node no soporta cobertura, reporta líneas probadas manualmente.
- Casos negativos obligatorios: respuestas vacías/incompletas, ICIQ fuera de rango, equipo sin EMG, perfil DOLOR con contraindicación, importar JSON corrupto, semana 13.
- Escribe `docs/plan-pruebas.md` (plantilla del skill de ingeniería: objetivo, cobertura, casos por requisito, estrés/negativos, datos de prueba — solo datos ficticios).
- Corre los tests tú mismo; el `revisor` repite la corrida y solo aprueba con todo verde.

## 4. Fase 5 — Documentación
- `README.md`: qué es, requisitos (solo un navegador y, para desarrollar, Node ≥ 20), ejecución local (`python -m http.server 8080` o Live Server), estructura, tests, despliegue, autor (Kilder Leyva — alias en texto: ninguno; el crédito visual es el logo KOLH).
- `docs/manual-usuario.md`: para la usuaria, sin jerga, una tarea por sección (las 19 secciones listadas en la matriz), con las ilustraciones y, cuando puedas, capturas (`assets/capturas/`). Incluye "Problemas frecuentes" (no vibra en iPhone → es normal; se apaga la pantalla → activar Wake Lock/permiso; perdí mis datos → importar respaldo).
- `docs/manual-tecnico.md`: enlaza los diagramas de `docs/diseno.md`, resume los ADR, modelo de datos, service worker y versionado, troubleshooting (síntomas → causa → solución), deuda técnica y pendientes externos.
- `CHANGELOG.md` (Keep a Changelog) con `0.1.0`.

## 5. Fase 6 — Despliegue
- `docs/runbook.md`: checklist pre-despliegue; pasos copy-paste para **LAPTOP PERSONAL** (y nota de que en LAPTOP EMPRESA son idénticos): `git add -A`, `git commit`, `git tag v0.1.0`, `git push origin main --tags`; activación de GitHub Pages (Settings → Pages → Deploy from a branch → main / root); URL esperada `https://kilder16.github.io/pelvia-app/`; verificación post-despliegue (abre en el celular, instala, modo avión, corre una sesión de 2 min); **rollback**: `git revert` o `git push --force` del tag anterior + subir `CACHE_VERSION`.
- `docs/despliegues.md` con la primera fila vacía lista para que Kilder la complete.
- Deja el repo listo con `git init`, `.gitignore`, todo commiteado y el tag `v0.1.0` creado; **no** intentes crear el repo remoto (PENDIENTES-EXTERNOS #4).

## 6. Informe final (obligatorio, en español)
1. Tabla de avance por fase:
   | Fase | % | Qué queda |
   |---|---|---|
   | 1 Especificación | 100 % | — |
   | 2 Diseño | 100 % | — |
   | 3 Implementación | … | … |
   | 4 Pruebas | … | … |
   | 5 Documentación | … | … |
   | 6 Despliegue | … | pasos de Kilder según runbook |
2. Matriz de trazabilidad actualizada (`docs/matriz-trazabilidad.md`) con Código/Test reales y estado ✅/⚠️.
3. Resultado de `node --test` (resumen) y cobertura.
4. Lista de decisiones tomadas en autonomía (y ADR nuevos si los hubo).
5. Incoherencias detectadas en el catálogo clínico (si las hay) **sin haberlas modificado**.
6. Los 3 pasos exactos que debe hacer Kilder a continuación (máquina explícita en cada uno).
