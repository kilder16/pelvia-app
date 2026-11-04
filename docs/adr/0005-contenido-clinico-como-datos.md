# ADR 0005 — Todo el contenido clínico se modela como datos versionados (`content/protocolos.json`) con fuente por protocolo
Estado: Aceptada
Fecha: 2026-11-03

## Contexto
Parámetros (Hz, µs, ON/OFF, minutos, veces por semana), niveles, cuestionarios, textos educativos y el caso ejemplo cambian con la
evidencia y con la revisión de un profesional. Si viven en el código, cada ajuste exige tocar lógica y rehacer pruebas.

## Opciones consideradas
1. **Un JSON único, versionado, con `fuentes` por ítem, cargado por `fetch` y precacheado por el service worker** — pros: edición sin
   código, validable en tests (esquema + rangos seguros), revisable por un fisioterapeuta como documento; contras: un archivo grande.
2. **Contenido embebido en módulos JS** — pros: sin fetch; contras: mezcla datos y lógica, difícil de revisar por no programadores.
3. **CMS remoto** — contras: contradice ADR-0001 y ADR-0003.

## Decisión
Opción 1. Estructura de alto nivel: `version, fecha, aviso, fuentes[], seguridad, cuestionarioSintomas, iciq, perfiles[],
autoevaluacionFuerza, niveles[], tiposSesion[], programas[], reglasProgresion, entrenamientoVesical, educacion[],
equiposConocidos[], casoEjemplo`. Un test valida: JSON parseable, todos los `tipoSesionId` referenciados existen, rangos de
seguridad (Hz 1–120, µs 50–500, ON ≥ 3 s cuando hay contracción, ON:OFF de al menos 1:2 — OFF ≥ 2 × ON — en fortalecimiento, duración ≤ 30 min). Los `parametrosFijos` de equipos externos en `equiposConocidos` (p. ej. Innovo) no se validan: llevan `exentoValidacion = true` porque la app no los recomienda, solo sincroniza el temporizador con ellos.

## Consecuencias
+ Un profesional puede revisar `protocolos.json` (o su versión tabulada en `docs/spec.md §10` y la biblioteca de la app) sin leer código.
+ El cambio de un parámetro no toca `engine/` ni `ui/`.
− Hay que mantener la coherencia entre `version` del catálogo y el esquema que espera `engine/catalogo.js` (test de compatibilidad).
