// Biblioteca: todos los tipos de sesión y todos los niveles (RF-10).

// --- Lógica pura (probada en tests/biblioteca.test.js; no cambiar firmas) ------------------------
/**
 * Recomendación de un tipo de sesión para un perfil.
 * @returns {{estado:'recomendada'|'no-recomendada'|'neutral', etiqueta:string, motivo:string}}
 */
export function recomendacionPara(tipo, perfil) {
  if (!perfil) return { estado: 'neutral', etiqueta: '', motivo: '' };
  const no = (tipo.perfilesNoRecomendados ?? []).find((x) => x.perfil === perfil);
  if (no) return { estado: 'no-recomendada', etiqueta: 'No recomendada para tu perfil', motivo: no.motivo };
  if ((tipo.perfilesRecomendados ?? []).includes(perfil)) {
    return { estado: 'recomendada', etiqueta: 'Recomendada para tu perfil', motivo: '' };
  }
  return { estado: 'neutral', etiqueta: '', motivo: '' };
}

/** Lista completa para la biblioteca, en el orden del catálogo, con la marca de recomendación. */
export function itemsBiblioteca(catalogo, perfil) {
  return catalogo.tiposSesion().map((t) => ({ tipo: t, ...recomendacionPara(t, perfil) }));
}
// --- Fin de la lógica pura -----------------------------------------------------------------------

// --- Render (solo navegador) ---------------------------------------------------------------------
import { html, montar, il } from '../../util/dom.js';
import { leer } from '../../store/repo.js';
import { construirLineaTiempo } from '../../engine/sesion.js';
import { fichaParametros } from '../componentes/ficha-parametros.js';

const CATEGORIAS = {
  electroestimulacion: 'Electroestimulación',
  tens: 'TENS para el dolor',
  biofeedback: 'Biofeedback',
  ejercicio: 'Ejercicios sin equipo',
  relajacion: 'Relajación',
  vesical: 'Entrenamiento vesical',
  habitos: 'Hábitos',
};

export function render({ cat, main }) {
  const plan = leer('plan');
  const perfil = plan?.perfil ?? null;
  const equipo = leer('equipo');
  const semana = plan?.semanaActual ?? 1;
  const nivel = plan?.nivelActual ?? 2;
  const items = itemsBiblioteca(cat, perfil);
  const grupos = Object.keys(CATEGORIAS).map((c) => ({ c, lista: items.filter((x) => x.tipo.categoria === c) })).filter((g) => g.lista.length);
  const otras = items.filter((x) => !CATEGORIAS[x.tipo.categoria]);
  if (otras.length) grupos.push({ c: 'otras', lista: otras });

  const item = ({ tipo, estado, etiqueta, motivo }) => {
    let lt = null;
    try {
      const n = Math.min(Math.max(nivel, tipo.nivelMin ?? 0), tipo.nivelMax ?? nivel);
      lt = construirLineaTiempo(tipo.id, { nivel: cat.nivel(n) ? n : nivel, semana, equipo }, cat);
    } catch { lt = null; }
    const href = tipo.id === 'VES-DIARIO' ? '#/vesical' : `#/sesion/${encodeURIComponent(tipo.id)}`;
    return html`<details class="item-bib" id="t-${tipo.id}">
      <summary><span class="ib-nombre">${tipo.nombre}</span>
        <span class="texto-suave">${tipo.id} · ${tipo.duracionMin} min</span>
        ${etiqueta ? html`<span><span class="etiqueta ${estado === 'no-recomendada' ? 'etiqueta-no' : 'etiqueta-ok'}">${etiqueta}</span></span>` : ''}
      </summary>
      <div class="ib-cuerpo">
        ${estado === 'no-recomendada' ? html`<div class="aviso aviso-alerta"><p><strong>No recomendada para tu perfil:</strong> ${motivo}</p></div>` : ''}
        <p>${tipo.resumen}</p>
        <p><strong>Para qué sirve:</strong> ${tipo.paraQue}</p>
        <p class="texto-suave">Niveles ${tipo.nivelMin}–${tipo.nivelMax === 9 ? 'mantenimiento' : tipo.nivelMax}${tipo.frecuenciaSemanal ? ` · ${tipo.frecuenciaSemanal.veces} veces por semana${tipo.frecuenciaSemanal.diasAlternos ? ', días alternos' : ''}` : ''}</p>
        ${lt?.parametros ? fichaParametros({ tipo, parametros: lt.parametros, bloques: lt.bloques, semana, equipo, catalogo: cat, conIlustraciones: false }) : ''}
        ${tipo.ilustraciones?.length ? html`<div class="galeria">${tipo.ilustraciones.map((id) => il(id))}</div>` : ''}
        <h3>Pasos</h3><ol class="pasos-lista">${tipo.pasos.map((p) => html`<li>${p}</li>`)}</ol>
        ${tipo.seguridad?.length ? html`<h3>Seguridad</h3><ul>${tipo.seguridad.map((s) => html`<li>${s}</li>`)}</ul>` : ''}
        ${tipo.fuentes?.length ? html`<h3>Fuentes</h3><ul class="cita">${tipo.fuentes.map((f) => html`<li>${cat.fuente(f)?.cita ?? f}</li>`)}</ul>` : ''}
        <a class="btn btn-primario btn-ancho" href="${href}">Practicar ahora</a>
      </div>
    </details>`;
  };

  montar(main, html`<section>
    <div class="encabezado-vista"><h1>Biblioteca</h1>
      <p>Todos los tipos de sesión y todos los niveles.${perfil ? ` Marcamos las recomendadas para tu perfil (${cat.perfil(perfil)?.nombre ?? perfil}).` : ''}</p></div>
    <nav class="chips" aria-label="Ir a una categoría">${grupos.map((g) => html`<a href="#/biblioteca" data-ancla="cat-${g.c}">${CATEGORIAS[g.c] ?? 'Otras'}</a>`)}<a href="#/biblioteca" data-ancla="niveles">Niveles</a></nav>
    ${grupos.map((g) => html`<h2 class="seccion-titulo" id="cat-${g.c}">${CATEGORIAS[g.c] ?? 'Otras'}</h2>${g.lista.map(item)}`)}
    <h2 class="seccion-titulo" id="niveles">Niveles del programa</h2>
    ${cat.niveles().map((n) => html`<details class="item-bib">
      <summary><span class="ib-nombre">${n.id === 9 ? 'Mantenimiento' : `Nivel ${n.id} · ${n.nombre}`}</span>${plan && plan.nivelActual === n.id ? html`<span><span class="etiqueta etiqueta-ok">Tu nivel actual</span></span>` : ''}</summary>
      <div class="ib-cuerpo">
        <p>${n.objetivo}</p>
        ${n.pfmt ? html`<p><strong>Ejercicios:</strong> sostén ${n.pfmt.sostenS} s, descanso ${n.pfmt.descansoS} s, ${n.pfmt.reps} repeticiones, ${n.pfmt.rapidas} rápidas, ${n.pfmt.series} ${n.pfmt.series === 1 ? 'serie' : 'series'} al día · posición ${n.pfmt.posiciones.join(' / ')}.</p>` : ''}
        ${n.metas && Object.keys(n.metas).length ? html`<p><strong>Metas para subir:</strong> ${Object.entries(n.metas).map(([k, v]) => `${k === 'E' ? 'sostén' : k === 'F' ? 'rápidas' : 'fuerza'} ${v}${k === 'E' ? ' s' : ''}`).join(' · ')}${n.minSemanas ? ` · mínimo ${n.minSemanas} semanas` : ''}</p>` : ''}
        ${n.pfmt?.ilustraciones?.length ? html`<div class="galeria">${n.pfmt.ilustraciones.map((id) => il(id))}</div>` : ''}
      </div></details>`)}
    <p class="aviso-corto">${cat.meta.avisoCorto}</p>
  </section>`);
  main.querySelectorAll('[data-ancla]').forEach((a) => a.addEventListener('click', (ev) => {
    ev.preventDefault();
    document.getElementById(a.dataset.ancla)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}
