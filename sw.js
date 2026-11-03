// Service worker de PELVIA (RNF-01; ADR-0001, ADR-0003).
// Estrategia: precache explícito de toda la app + cache-first con actualización en segundo plano.
// Al publicar una versión nueva: sube CACHE_VERSION (y APP_VERSION en js/store/repo.js) y ejecuta
//   node tools/generar-precache.mjs
// para regenerar la lista PRECACHE. La UI muestra "Nueva versión disponible — recargar".

const CACHE_VERSION = 1;
const CACHE = `pelvia-v${CACHE_VERSION}`;

// <precache> (generado por tools/generar-precache.mjs; no editar a mano)
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'css/tokens.css',
  'js/app.js',
  'js/engine/catalogo.js',
  'js/engine/clasificador.js',
  'js/engine/nivel.js',
  'js/engine/planificador.js',
  'js/engine/progresion.js',
  'js/engine/reglas.js',
  'js/engine/reporte.js',
  'js/engine/seguridad.js',
  'js/engine/sesion.js',
  'js/engine/vesical.js',
  'js/router.js',
  'js/store/repo.js',
  'js/store/respaldo.js',
  'js/ui/componentes/checklist-seguridad.js',
  'js/ui/componentes/ficha-parametros.js',
  'js/ui/componentes/grafica-svg.js',
  'js/ui/componentes/modal.js',
  'js/ui/componentes/pin.js',
  'js/ui/componentes/tarjeta-sesion.js',
  'js/ui/componentes/temporizador.js',
  'js/ui/vistas/acerca.js',
  'js/ui/vistas/ajustes.js',
  'js/ui/vistas/aprende.js',
  'js/ui/vistas/biblioteca.js',
  'js/ui/vistas/equipo.js',
  'js/ui/vistas/evaluacion.js',
  'js/ui/vistas/hoy.js',
  'js/ui/vistas/informe.js',
  'js/ui/vistas/onboarding.js',
  'js/ui/vistas/progreso.js',
  'js/ui/vistas/resultado.js',
  'js/ui/vistas/sesion.js',
  'js/ui/vistas/vesical.js',
  'js/util/audio.js',
  'js/util/dom.js',
  'js/util/fechas.js',
  'js/util/vibrar.js',
  'js/util/wakelock.js',
  'content/protocolos.json',
  'assets/il/IL-01.svg',
  'assets/il/IL-02.svg',
  'assets/il/IL-03.svg',
  'assets/il/IL-04.svg',
  'assets/il/IL-05.svg',
  'assets/il/IL-06.svg',
  'assets/il/IL-07.svg',
  'assets/il/IL-08.svg',
  'assets/il/IL-09.svg',
  'assets/il/IL-10.svg',
  'assets/il/IL-11.svg',
  'assets/il/IL-12.svg',
  'assets/il/IL-13-dolor.svg',
  'assets/il/IL-13-esfuerzo.svg',
  'assets/il/IL-13-fecal.svg',
  'assets/il/IL-13-mixta.svg',
  'assets/il/IL-13-postparto.svg',
  'assets/il/IL-13-prevencion.svg',
  'assets/il/IL-13-prolapso.svg',
  'assets/il/IL-13-urgencia.svg',
  'assets/il/IL-13.svg',
  'assets/il/IL-14.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/icon.svg',
  'assets/icons/logo-kolh-placeholder.svg',
];
// </precache>

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)),
    // No se llama skipWaiting aquí: la usuaria decide cuándo recargar (mensaje SKIP_WAITING).
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter((k) => k.startsWith('pelvia-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.tipo === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // nada de terceros (no hay, pero por si acaso)

  evento.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const enCache = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    const red = fetch(req).then((resp) => {
      if (resp && resp.ok && resp.type === 'basic') cache.put(req, resp.clone());
      return resp;
    }).catch(() => null);
    if (enCache) {
      evento.waitUntil(red); // actualización en segundo plano
      return enCache;
    }
    const resp = await red;
    if (resp) return resp;
    if (req.mode === 'navigate') {
      const shell = await cache.match('index.html');
      if (shell) return shell;
    }
    return new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
