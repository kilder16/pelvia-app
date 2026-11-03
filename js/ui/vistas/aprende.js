// Aprende (RF-20): tarjetas de educación con ilustración, errores comunes y galería de posiciones.

import { html, montar, il, ALT_IL } from '../../util/dom.js';

const POSICIONES = ['IL-03', 'IL-04', 'IL-05', 'IL-06', 'IL-10', 'IL-11'];

/** Separa "Errores comunes: a, b, c o d." del texto de una tarjeta. */
export function separarErrores(texto) {
  const m = /Errores comunes:\s*(.+?\)?)\.(\s|$)/.exec(texto ?? '');
  if (!m) return { antes: texto ?? '', errores: [], despues: '' };
  const errores = m[1].split(/,\s*|\s+o\s+(?![^(]*\))/).map((s) => s.trim()).filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  const i = texto.indexOf(m[0]);
  return { antes: texto.slice(0, i).trim(), errores, despues: texto.slice(i + m[0].length).trim() };
}

export function render({ cat, main }) {
  montar(main, html`<section>
    <div class="encabezado-vista"><h1>Aprende</h1><p>Lo esencial para entrenar bien tu suelo pélvico.</p></div>
    <nav class="chips" aria-label="Temas">${cat.educacion.map((e) => html`<a href="#/aprende" data-ancla="${e.id}">${e.titulo}</a>`)}</nav>
    ${cat.educacion.map((e) => {
      const partes = e.id === 'EDU-02' ? separarErrores(e.texto) : { antes: e.texto, errores: [], despues: '' };
      return html`<article class="tarjeta" id="${e.id}" tabindex="-1">
        <h2>${e.titulo}</h2>
        ${e.ilustracion ? il(e.ilustracion) : ''}
        <p>${partes.antes}</p>
        ${partes.errores.length ? html`<h3>Errores comunes</h3><ul>${partes.errores.map((x) => html`<li>${x}</li>`)}</ul>` : ''}
        ${partes.despues ? html`<p>${partes.despues}</p>` : ''}
      </article>`;
    })}
    <h2 class="seccion-titulo">Posiciones y ejercicios</h2>
    <div class="galeria">${POSICIONES.map((id) => html`<figure class="il"><img src="assets/il/${id}.svg" alt="${ALT_IL[id]}" loading="lazy" width="400" height="300"><figcaption>${ALT_IL[id]}</figcaption></figure>`)}</div>
    <p class="aviso-corto">${cat.meta.avisoCorto}</p>
  </section>`);
  main.querySelectorAll('[data-ancla]').forEach((a) => a.addEventListener('click', (ev) => {
    ev.preventDefault();
    const el = document.getElementById(a.dataset.ancla);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el?.focus({ preventScroll: true });
  }));
}
