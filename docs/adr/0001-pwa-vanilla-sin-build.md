# ADR 0001 — PWA mobile-first en HTML/CSS/JS vanilla, sin build step, publicada en GitHub Pages
Estado: Aceptada
Fecha: 2026-11-03

## Contexto
La app es para el celular de una sola persona (la amiga de Kilder). Debe instalarse sin pasar por una tienda, funcionar sin
conexión durante las sesiones y poder mantenerse desde cualquiera de las tres máquinas de Kilder. En la red corporativa SEDAPAL
el proxy bloquea `registry.npmjs.org`, así que cualquier stack que dependa de `npm install` solo podría desarrollarse en
LAPTOP PERSONAL. Kilder ya publicó "Gastos S/" con Expo/React Native, por lo que la alternativa nativa es conocida.

## Opciones consideradas
1. **PWA vanilla (HTML + CSS + ES modules + service worker)** — pros: cero dependencias, se abre con un enlace, instalable en
   Android e iPhone, se desarrolla en las 3 máquinas, despliegue en GitHub Pages sin pipeline, mismo patrón "sin build" que las
   herramientas HTML de Kilder; contras: sin notificaciones push fiables (iOS), sin acceso a Bluetooth en iOS, sin presencia en Play.
2. **Expo / React Native** — pros: notificaciones, Bluetooth, presencia en Play; contras: requiere npm/EAS (bloqueado en SEDAPAL),
   ciclo de build y firma, instalación por APK o Play para una sola usuaria, mucho más tiempo para el mismo resultado.
3. **PWA + empaquetado posterior (Capacitor/TWA)** — pros: camino incremental a Play; contras: igualmente depende de npm; se deja
   como evolución futura, no como punto de partida.

## Decisión
Opción 1. PWA vanilla con ES modules, sin frameworks ni librerías externas en runtime (las gráficas se dibujan en SVG propio).
Hosting en GitHub Pages desde el repo público `kilder16/pelvia-app`, rama `main`, carpeta raíz. Pruebas del motor con
`node --test` (sin dependencias). Si más adelante se quiere Play, se envuelve con TWA/Capacitor (nuevo ADR).

## Consecuencias
+ Entrega rápida: la usuaria recibe un enlace y "Agregar a pantalla de inicio".
+ Mantenible desde LAPTOP EMPRESA, PC EMPRESA y LAPTOP PERSONAL sin instalar nada.
− Sin push: los recordatorios se resuelven con la pantalla "Hoy" y alarmas del celular.
− Sin Bluetooth: coherente con ADR-0002 (equipo agnóstico).
− Disciplina manual de módulos (sin bundler): la estructura de carpetas de `docs/diseno.md §3` es obligatoria.
