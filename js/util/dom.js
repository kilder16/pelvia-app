// Utilidades de DOM seguras (escape de texto). No toca `document` al importarse: solo dentro de funciones.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para insertarlo en HTML (contenido o atributo entre comillas). */
export function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

/** Fragmento HTML ya seguro (generado por `html` o por código propio, nunca por texto de la usuaria). */
export class Seguro {
  constructor(s) { this.s = String(s); }
  toString() { return this.s; }
}

/** Marca como seguro un HTML generado por el propio código (p. ej. un SVG construido con esc()). */
export const crudo = (s) => (s instanceof Seguro ? s : new Seguro(s));

function aTexto(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Seguro) return v.s;
  if (Array.isArray(v)) return v.map(aTexto).join('');
  return esc(v);
}

/**
 * Plantilla etiquetada: todo valor interpolado se escapa salvo que sea `Seguro` (otra plantilla html``).
 * Los arreglos se concatenan. `null`, `undefined`, `true` y `false` no imprimen nada.
 */
export function html(partes, ...valores) {
  let out = partes[0];
  for (let i = 0; i < valores.length; i++) out += aTexto(valores[i]) + partes[i + 1];
  return new Seguro(out);
}

/** Reemplaza el contenido de `el` con una plantilla segura. */
export function montar(el, contenido) {
  el.innerHTML = contenido instanceof Seguro ? contenido.s : esc(contenido);
  return el;
}

/** Crea un elemento: h('button', {class:'btn', onclick: fn}, 'Texto', otroNodo). */
export function h(tag, attrs = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html' && v instanceof Seguro) el.innerHTML = v.s;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const hijo of hijos.flat()) {
    if (hijo == null || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return el;
}

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

/** Textos alternativos en español para cada ilustración. */
export const ALT_IL = {
  'IL-01': 'Esquema de la pelvis: vejiga, útero, recto y el suelo pélvico como una hamaca de soporte',
  'IL-02': 'Contracción correcta (aprieta y eleva, abdomen y glúteos relajados) frente a incorrecta (empuja hacia abajo)',
  'IL-03': 'Posición acostada boca arriba con las rodillas flexionadas',
  'IL-04': 'Posición sentada en una silla con los pies apoyados',
  'IL-05': 'Posición de pie con los pies separados al ancho de las caderas',
  'IL-06': 'Respiración diafragmática: al inhalar el suelo pélvico se suelta, al exhalar se contrae',
  'IL-07': 'Colocación de la sonda vaginal con gel, acostada, con el cable hacia el equipo',
  'IL-08': 'Colocación de la sonda anal, esquema simple',
  'IL-09': 'Línea de tiempo del equipo encendido y apagado con la contracción voluntaria sincronizada',
  'IL-10': 'El Knack: contraer antes de toser, estornudar o levantar peso',
  'IL-11': 'Posturas de relajación del suelo pélvico: mariposa acostada y bebé feliz',
  'IL-12': 'Tarjeta de parámetros del equipo: hercios, microsegundos, encendido y apagado, rampa y miliamperios',
  'IL-13': 'Iconos de los perfiles',
  'IL-14': 'Diario miccional y reloj del intervalo objetivo',
  'IL-13-esfuerzo': 'Icono de incontinencia de esfuerzo',
  'IL-13-urgencia': 'Icono de urgencia',
  'IL-13-mixta': 'Icono de incontinencia mixta',
  'IL-13-fecal': 'Icono de incontinencia fecal',
  'IL-13-dolor': 'Icono de dolor o tensión pélvica',
  'IL-13-prolapso': 'Icono de prolapso',
  'IL-13-postparto': 'Icono de postparto',
  'IL-13-prevencion': 'Icono de prevención',
};

/** Ilustración del catálogo como <img> dentro de una tarjeta (fondo blanco propio, también en modo oscuro). */
export function il(id, clase = 'il') {
  if (!id) return html``;
  return html`<figure class="${clase}"><img src="assets/il/${id}.svg" alt="${ALT_IL[id] ?? 'Ilustración'}" loading="lazy" width="400" height="300"></figure>`;
}
