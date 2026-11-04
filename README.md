# PELVIA — Terapia de suelo pélvico guiada

PELVIA es una aplicación web para celular (PWA, se instala desde el navegador) que acompaña la rehabilitación conservadora del
suelo pélvico con un electroestimulador con biofeedback de uso doméstico:

- cuestionario de **seguridad** (contraindicaciones, precauciones y banderas rojas) que bloquea la electroestimulación cuando no es segura;
- cuestionario de **síntomas** con el ICIQ-UI SF y clasificación en 8 perfiles (esfuerzo, urgencia, mixta, fecal, dolor/hipertonía,
  prolapso, postparto, prevención);
- **autoevaluación de fuerza** (PERFECT simplificado) → nivel 0–5 y plan de **12 semanas** con ejercicios, biofeedback,
  electroestimulación, relajación, entrenamiento vesical y hábitos;
- **sesión guiada** con temporizador sincronizado al ON/OFF del equipo, vibración, sonido y pantalla encendida;
- progresión de nivel automática, re-evaluaciones, gráficas de progreso, informe imprimible para el profesional y respaldo JSON.

> **No sustituye la valoración de un profesional de salud.** PELVIA no diagnostica ni controla el equipo (ADR-0002). El contenido
> clínico viene de guías publicadas (NICE NG123, POGP 2021, ICIQ, Laycock & Jerwood…) y está pendiente de revisión profesional
> (`content/protocolos.json → meta.revisionProfesionalPendiente`).

**Privacidad:** todos los datos quedan en el celular (`localStorage`). No hay servidor, cuentas ni analítica; la única descarga es la
propia app (ADR-0003).

## Requisitos
- **Para usarla:** un navegador moderno (Chrome ≥ 100 en Android, Safari ≥ 15 en iPhone). Nada más.
- **Para desarrollarla:** Node.js ≥ 20 (solo para correr los tests) y cualquier servidor estático (Python o Live Server de VS Code).
  **No se usa npm**: no hay `package.json`, ni dependencias, ni build (ADR-0001).

## Ejecutar en local
```powershell
cd D:\pelvia-app            # o la carpeta donde esté el repo
python -m http.server 8080
```
Abrir `http://localhost:8080` y pulsar **Ver ejemplo** para cargar el caso ficticio. (Alternativa: extensión *Live Server* de VS Code.)
Para probarla desde el celular en la misma red Wi-Fi: `http://<IP-de-la-PC>:8080` (el service worker solo se activa en
`localhost` o HTTPS; en la IP local funciona sin modo offline).

## Tests
```powershell
node --test "tests/*.test.js"                                  # 77 tests, uno o más por requisito (rfNN_…)
node --test --experimental-test-coverage "tests/*.test.js"     # cobertura (js/engine/ ≈ 99 % de líneas)
node tools/generar-precache.mjs --check                        # lista de precache del service worker al día y peso < 2 MB
```
Las comillas en el patrón son necesarias: Node 22 expande el glob por sí mismo (en PowerShell y en Bash).

## Estructura
```
index.html               App shell (cabecera, banda DEMO, <main id="vista">, navegación inferior)
manifest.webmanifest     PWA instalable          sw.js   precache explícito + cache-first (CACHE_VERSION)
css/                     tokens.css (colores, tipografía, modo oscuro) · app.css (layout, sesión, impresión)
js/app.js                arranque: catálogo, migración, PIN, consentimiento, cierre de semanas, service worker
js/router.js             rutas por hash (#/hoy, #/sesion/EST-IUE?semana=3&dia=L, …)
js/engine/               motor de reglas puro, sin DOM (seguridad, clasificador, nivel, planificador, sesión, progresión, vesical, reporte)
js/store/                repo.js (localStorage versionado, caso DEMO) · respaldo.js (exportar/importar)
js/ui/vistas/            una vista por pantalla       js/ui/componentes/  temporizador, gráficas SVG, ficha, checklist, modal, PIN
js/util/                 fechas, dom (escape de HTML), audio (WebAudio), vibrar, wakelock
content/protocolos.json  catálogo clínico versionado (ADR-0005): cambiar un parámetro no requiere tocar código
assets/il/               ilustraciones SVG originales IL-01..IL-14     assets/icons/  iconos PWA y logo
assets/capturas/         capturas para el manual (no se precachean)
tests/                   node --test                  tools/   generar-precache.mjs, generadores de ilustraciones e iconos (Python)
docs/                    spec, diseño, ADR, matriz de trazabilidad, plan de pruebas, manuales, runbook, despliegues
```
Regla de dependencias: `js/engine/` no importa nada de `ui/` ni de `store/` (ADR-0004).

## Documentación
- Para la usuaria: [`docs/manual-usuario.md`](docs/manual-usuario.md)
- Técnica: [`docs/manual-tecnico.md`](docs/manual-tecnico.md) · [`docs/diseno.md`](docs/diseno.md) · [`docs/adr/`](docs/adr/) ·
  [`docs/matriz-trazabilidad.md`](docs/matriz-trazabilidad.md) · [`docs/plan-pruebas.md`](docs/plan-pruebas.md)
- Requisitos: [`docs/spec.md`](docs/spec.md) · Cambios: [`CHANGELOG.md`](CHANGELOG.md)

## Despliegue
GitHub Pages desde `main` / raíz del repo `kilder16/pelvia-app` → `https://kilder16.github.io/pelvia-app/`.
Pasos completos, verificación y rollback: [`docs/runbook.md`](docs/runbook.md). Registro: [`docs/despliegues.md`](docs/despliegues.md).
Al publicar una versión nueva: subir `CACHE_VERSION` en `sw.js` y ejecutar `node tools/generar-precache.mjs`.

## Autor
Kilder Leyva. El crédito visual de la pantalla *Acerca de* es el logo del autor (`assets/icons/logo-kolh.png`, pendiente de copiar;
mientras tanto se muestra un marcador). Uso personal; el ICIQ-UI SF está incluido como adaptación libre (ver `PENDIENTES-EXTERNOS.md` #7).
