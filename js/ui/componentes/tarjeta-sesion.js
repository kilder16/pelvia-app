// Tarjeta de una entrada del plan (RF-12): nombre, duración, estado pendiente/hecha y destino al tocarla.

import { html } from '../../util/dom.js';
import { REEVAL } from '../../engine/planificador.js';
import { construirLineaTiempo } from '../../engine/sesion.js';
import { ruta } from '../../router.js';

export const NOMBRES_REEVAL = {
  [REEVAL.fuerza]: 'Re-evaluación de fuerza',
  [REEVAL.iciq]: 'Cuestionario de síntomas (ICIQ)',
  [REEVAL.eva]: 'Escala de dolor (0 a 10)',
};
const TIPO_REEVAL = { [REEVAL.fuerza]: 'fuerza', [REEVAL.iciq]: 'iciq', [REEVAL.eva]: 'eva' };

export function nombreEntrada(tipoId, cat) {
  return NOMBRES_REEVAL[tipoId] ?? cat.tipoSesion(tipoId)?.nombre ?? tipoId;
}

export function esReevaluacion(tipoId) {
  return tipoId in TIPO_REEVAL;
}

/** Destino (hash) de una entrada del plan. */
export function hrefEntrada(entrada, semana, dia) {
  const t = entrada.tipo;
  if (TIPO_REEVAL[t]) return ruta('evaluacion', [], { tipo: TIPO_REEVAL[t], semana, dia });
  if (t === 'VES-DIARIO') return ruta('vesical', [], { semana, dia });
  return ruta('sesion', [t], { semana, dia, series: entrada.series });
}

/** Duración estimada en minutos. */
export function duracionEntradaMin(entrada, { nivel = 0, semana = 1, equipo = null } = {}, cat) {
  if (esReevaluacion(entrada.tipo)) return entrada.tipo === REEVAL.fuerza ? 5 : 2;
  const t = cat.tipoSesion(entrada.tipo);
  if (!t) return null;
  try {
    const lt = construirLineaTiempo(entrada.tipo, { nivel, semana, series: entrada.series, equipo }, cat);
    if (lt.totalSeg > 0) return Math.max(1, Math.round(lt.totalSeg / 60));
  } catch { /* tipo sin línea de tiempo */ }
  return t.duracionMin ?? null;
}

/** Texto legible del motivo de un reemplazo del planificador. */
export function textoReemplazo(entrada, cat) {
  if (!entrada.reemplazaA) return '';
  const m = String(entrada.motivoReemplazo ?? '');
  let porque = 'adaptado a tu situación';
  if (m.startsWith('reemplazoSinEST')) {
    porque = m.includes('sin equipo') ? 'aún no registras tu equipo'
      : m.includes('equipo sin') ? 'tu equipo no electroestimula' : 'sin electroestimulación por seguridad';
  } else if (m.startsWith('reemplazoSinEMG')) porque = 'tu equipo no tiene biofeedback (EMG)';
  else if (m.startsWith('reemplazoSinSondaAnal')) porque = 'no tienes sonda anal';
  else if (m.startsWith('reemplazoSinElectrodos')) porque = 'no tienes electrodos adhesivos';
  else if (m.startsWith('banderaRoja')) porque = 'señal de alarma: solo ejercicios suaves hasta consultar';
  else if (m.startsWith('nivel')) porque = 'adaptado a tu nivel';
  const original = cat.tipoSesion(entrada.reemplazaA)?.id ?? entrada.reemplazaA;
  return `en lugar de ${original}: ${porque}`;
}

/**
 * @param {object} entrada  entrada del plan {tipo, estado, series?, reemplazaA?, condicion?}
 * @param {{semana:number, dia:string, nivel:number, equipo?:object, cat:object, enlace?:boolean}} op
 */
export function tarjetaSesion(entrada, { semana, dia, nivel, equipo = null, cat, enlace = true }) {
  const hecha = entrada.estado === 'hecha';
  const min = duracionEntradaMin(entrada, { nivel, semana, equipo }, cat);
  const reemplazo = textoReemplazo(entrada, cat);
  const series = entrada.tipo === 'PFMT-SERIE' && entrada.series ? ` · ${entrada.series} ${entrada.series === 1 ? 'serie' : 'series'}` : '';
  const cuerpo = html`
    <span class="ts-estado" aria-hidden="true">${hecha ? '✓' : ''}</span>
    <span class="ts-texto">
      <span class="ts-nombre">${nombreEntrada(entrada.tipo, cat)}</span>
      <span class="ts-meta">${entrada.tipo}${min ? ` · ${min} min` : ''}${series}</span>
      ${entrada.condicion === 'dolorSemanalMenor' ? html`<span class="ts-nota">Solo si tu dolor bajó</span>` : ''}
      ${reemplazo ? html`<span class="ts-nota">${reemplazo}</span>` : ''}
    </span>
    <span class="ts-etiqueta ${hecha ? 'ok' : ''}">${hecha ? 'Hecha' : 'Pendiente'}</span>`;
  const clase = `tarjeta-sesion${hecha ? ' hecha' : ''}`;
  if (!enlace) return html`<div class="${clase}">${cuerpo}</div>`;
  return html`<a class="${clase}" href="${hrefEntrada(entrada, semana, dia)}" aria-label="${nombreEntrada(entrada.tipo, cat)}, ${hecha ? 'hecha' : 'pendiente'}">${cuerpo}</a>`;
}
