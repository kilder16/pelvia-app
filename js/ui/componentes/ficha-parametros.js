// Ficha de parámetros de una sesión (RF-07): Hz, µs, ON/OFF, rampa, duración, intensidad, sonda, posición,
// participación activa, rangos aceptables, nota de progresión y equivalencia con "Mi equipo".

import { html, il } from '../../util/dom.js';

const num = (v) => String(v).replace('.', ',');

/** "35 Hz · 250 µs · ON 5 / OFF 10 · rampa 1 s · 15 min" (o el resumen de un ejercicio). */
export function resumenParametros(p) {
  if (!p) return '';
  if (p.frecuenciaHz != null) {
    const partes = [`${num(p.frecuenciaHz)} Hz`, `${num(p.anchoPulsoUs)} µs`];
    if (p.continuo) partes.push('continuo');
    else if (p.onS) partes.push(`ON ${num(p.onS)} / OFF ${num(p.offS)}`);
    if (p.rampaS) partes.push(`rampa ${num(p.rampaS)} s`);
    if (p.duracionMin) partes.push(`${num(p.duracionMin)} min`);
    return partes.join(' · ');
  }
  const partes = [];
  if (p.sostenS) partes.push(`sostén ${num(p.sostenS)} s`);
  if (p.descansoS) partes.push(`descanso ${num(p.descansoS)} s`);
  if (p.reps) partes.push(`${p.reps} repeticiones`);
  if (p.rapidas) partes.push(`${p.rapidas} rápidas`);
  if (p.sostenS == null && p.reps && p.rapidas == null && p.series) partes.push('');
  if (p.series) partes.push(`${p.series} ${p.series === 1 ? 'serie' : 'series'}`);
  return partes.filter(Boolean).join(' · ');
}

function filaProgresion(tipo, semana) {
  return (tipo.progresionSemanal ?? []).find((f) => Array.isArray(f.semanas) && semana >= f.semanas[0] && semana <= f.semanas[1]) ?? null;
}

function rango(r, unidad) {
  return Array.isArray(r) ? `${num(r[0])}–${num(r[1])} ${unidad}` : '';
}

function tablaEST(p) {
  return html`<dl class="ficha-dl">
    <dt>Frecuencia</dt><dd>${num(p.frecuenciaHz)} Hz</dd>
    <dt>Ancho de pulso</dt><dd>${num(p.anchoPulsoUs)} µs</dd>
    ${p.continuo ? html`<dt>Modo</dt><dd>Continuo (sin ON/OFF)</dd>` : html`<dt>Trabajo / descanso</dt><dd>ON ${num(p.onS)} s / OFF ${num(p.offS)} s</dd>`}
    ${p.rampaS ? html`<dt>Rampa</dt><dd>${num(p.rampaS)} s</dd>` : ''}
    <dt>Duración</dt><dd>${num(p.duracionMin)} min</dd>
    ${p.formaOnda ? html`<dt>Forma de onda</dt><dd>${p.formaOnda}</dd>` : ''}
  </dl>`;
}

/**
 * @param {{tipo:object, parametros:object|null, semana?:number, equipo?:object|null, catalogo:object,
 *          bloques?:object[], abierta?:boolean, conIlustraciones?:boolean}} op
 */
export function fichaParametros({ tipo, parametros, semana = 1, equipo = null, catalogo, bloques = null, abierta = false, conIlustraciones = true }) {
  const p = parametros ?? {};
  const esEquipo = catalogo.usaCorriente(tipo.id);
  const programa = esEquipo ? catalogo.equivalenciaEquipo(tipo.id, equipo) : null;
  const fila = filaProgresion(tipo, semana);
  const ra = tipo.rangosAceptables;
  const titulo = bloques?.length
    ? bloques.map((b) => resumenParametros(b.parametros)).join(' → ')
    : resumenParametros(p) || 'Ver detalles';

  const cuerpo = html`
    ${p.fijadosPorEquipo ? html`<p class="aviso aviso-info"><strong>Tu equipo fija sus parámetros:</strong> solo sigue el temporizador.</p>` : ''}
    ${programa ? html`<p class="equivalencia">En tu equipo: programa <strong>${programa}</strong></p>` : ''}
    ${esEquipo && bloques?.length ? bloques.map((b) => html`<h4>${b.nombre}</h4>${tablaEST({ ...b.parametros, formaOnda: null })}`) : ''}
    ${esEquipo && !bloques?.length && p.frecuenciaHz != null ? tablaEST(p) : ''}
    ${!esEquipo && Object.keys(p).length ? html`<dl class="ficha-dl">
      ${p.sostenS ? html`<dt>Sostén</dt><dd>${num(p.sostenS)} s</dd>` : ''}
      ${p.descansoS ? html`<dt>Descanso</dt><dd>${num(p.descansoS)} s</dd>` : ''}
      ${p.reps ? html`<dt>Repeticiones</dt><dd>${p.reps}</dd>` : ''}
      ${p.rapidas ? html`<dt>Rápidas</dt><dd>${p.rapidas} (${num(p.rapidasOnS ?? 1)} s / ${num(p.rapidasOffS ?? 1)} s)</dd>` : ''}
      ${p.series ? html`<dt>Series</dt><dd>${p.series}</dd>` : ''}
      ${p.posiciones?.length ? html`<dt>Posición</dt><dd>${p.posiciones.join(', ')}</dd>` : ''}
    </dl>` : ''}
    ${p.intensidad ? html`<div class="ficha-intensidad"><p><strong>Intensidad:</strong> ${p.intensidad.guia}</p><p class="nunca"><strong>${p.intensidad.nunca}</strong></p></div>` : ''}
    ${p.sonda || p.posicion ? html`<dl class="ficha-dl">
      ${p.sonda ? html`<dt>Sonda / electrodos</dt><dd>${p.sonda}</dd>` : ''}
      ${p.posicion ? html`<dt>Posición</dt><dd>${p.posicion}</dd>` : ''}
    </dl>` : ''}
    ${esEquipo && p.instruccionActiva ? html`<p><strong>${p.participacionActiva ? 'Participa tú también:' : 'Participación:'}</strong> ${p.instruccionActiva}</p>` : ''}
    ${esEquipo && ra ? html`<p class="rangos"><strong>Si tu equipo no permite estos valores exactos</strong>, son aceptables:
      ${[ra.frecuenciaHz && `frecuencia ${rango(ra.frecuenciaHz, 'Hz')}`, ra.anchoPulsoUs && `ancho de pulso ${rango(ra.anchoPulsoUs, 'µs')}`,
        ra.onS && `ON ${rango(ra.onS, 's')}`, ra.offS && `OFF ${rango(ra.offS, 's')}`].filter(Boolean).join(' · ')}.</p>` : ''}
    ${fila?.nota ? html`<p class="nota-progresion"><strong>Progresión:</strong> ${fila.nota}</p>` : ''}
    ${esEquipo && equipo && !programa && !p.fijadosPorEquipo ? html`<p class="texto-suave">Tu equipo no tiene un programa registrado para esta sesión: configúralo a mano con estos valores.</p>` : ''}
    ${conIlustraciones && tipo.ilustraciones?.length ? html`<div class="galeria">${tipo.ilustraciones.map((id) => il(id))}</div>` : ''}
  `;
  return html`<details class="ficha" ${abierta ? 'open' : ''}><summary><span class="ficha-titulo">Parámetros</span> <span class="ficha-resumen">${titulo}</span></summary><div class="ficha-cuerpo">${cuerpo}</div></details>`;
}
