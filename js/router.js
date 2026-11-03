// Router por hash (#/hoy, #/sesion/EST-IUE?semana=3&dia=L). Funciona en subcarpeta de GitHub Pages.
// No toca `window` al importarse.

/** '#/sesion/EST-IUE?semana=3' → { ruta:'sesion', params:['EST-IUE'], query:{semana:'3'} } */
export function parsearHash(hash) {
  const limpio = String(hash ?? '').replace(/^#?\/?/, '');
  const [camino, qs = ''] = limpio.split('?');
  const partes = camino.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  const query = {};
  for (const [k, v] of new URLSearchParams(qs)) query[k] = v;
  return { ruta: partes[0] ?? '', params: partes.slice(1), query, hash: `#/${limpio}` };
}

/** ruta('sesion', ['EST-IUE'], {semana:3}) → '#/sesion/EST-IUE?semana=3' */
export function ruta(nombre, params = [], query = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v != null && v !== '') q.set(k, String(v));
  const qs = q.toString();
  return `#/${[nombre, ...params].map(encodeURIComponent).join('/')}${qs ? `?${qs}` : ''}`;
}

let navegacionesInternas = 0;

export function navegar(hash, { reemplazar = false } = {}) {
  if (reemplazar) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}

/** Vuelve a la pantalla anterior de la app si existe; si no, a `porDefecto`. */
export function volver(porDefecto = '#/hoy') {
  if (navegacionesInternas > 1) history.back();
  else navegar(porDefecto, { reemplazar: true });
}

/** @param {(destino: ReturnType<typeof parsearHash>) => void} alCambiar */
export function iniciarRouter(alCambiar) {
  const manejar = () => {
    navegacionesInternas++;
    alCambiar(parsearHash(location.hash));
  };
  window.addEventListener('hashchange', manejar);
  manejar();
}
