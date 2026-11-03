// Progreso (RF-13): adherencia semanal y curvas de E, F, mA, ICIQ (y EVA), historial de niveles,
// re-evaluaciones pendientes.

import { html, montar } from '../../util/dom.js';
import { leer } from '../../store/repo.js';
import { resumen } from '../../engine/reporte.js';
import { reevaluacionesPendientes } from '../../engine/progresion.js';
import { semanaDelPlan, hoyISO } from '../../util/fechas.js';
import { graficaBarras, graficaLinea } from '../componentes/grafica-svg.js';
import { hrefReevaluacion } from './hoy.js';

const NOMBRE = { fuerza: 'Re-evaluación de fuerza', iciq: 'Cuestionario ICIQ', eva: 'Escala de dolor', diario: 'Diario miccional' };

/** Bloque de gráficas reutilizado por Progreso y por el Informe. */
export function bloqueGraficas(r, plan, { conAdherencia = true } = {}) {
  const ses = (r.series.mA ?? []).length;
  return html`
    ${conAdherencia ? html`<div class="tarjeta"><h3>Adherencia por semana</h3>
      ${graficaBarras(r.adherenciaPorSemana.map((a) => ({ etiqueta: `S${a.semana}`, valor: a.fraccion, texto: `${a.hechas} de ${a.planificadas} (${Math.round(a.fraccion * 100)} %)` })),
        { titulo: 'Adherencia por semana', linea: 0.7, etiquetaLinea: 'meta 70 %' })}
      <p class="texto-suave">Global: ${Math.round(r.adherenciaGlobal * 100)} % de las sesiones planificadas.</p></div>` : ''}
    <div class="tarjeta"><h3>Sostén (E)</h3>${graficaLinea(r.series.E, { titulo: 'Segundos de sostén', unidad: 's', yMin: 0, yMax: 10, color: 'var(--primario)' })}</div>
    <div class="tarjeta"><h3>Rápidas (F)</h3>${graficaLinea(r.series.F, { titulo: 'Contracciones rápidas', unidad: '', yMin: 0, yMax: 10, color: 'var(--relaja-texto)' })}</div>
    <div class="tarjeta"><h3>Intensidad usada (mA)</h3>${graficaLinea(r.series.mA, { titulo: 'Intensidad de electroestimulación', unidad: 'mA', yMin: 0, color: 'var(--acento-texto)' })}
      ${ses ? '' : html`<p class="texto-suave">Se llena con las sesiones de electroestimulación.</p>`}</div>
    <div class="tarjeta"><h3>Síntomas (ICIQ, 0–21)</h3>${graficaLinea(r.series.ICIQ, { titulo: 'Puntaje ICIQ (menos es mejor)', unidad: '', yMin: 0, yMax: 21, color: 'var(--peligro)' })}
      <p class="texto-suave">Menos puntos = menos escapes.</p></div>
    ${plan?.perfil === 'DOLOR_HIPERTONIA' || r.series.EVA.length > 1 ? html`<div class="tarjeta"><h3>Dolor (0–10)</h3>${graficaLinea(r.series.EVA, { titulo: 'Dolor en escala de 0 a 10', unidad: '', yMin: 0, yMax: 10, color: 'var(--alerta-texto)' })}</div>` : ''}`;
}

export function historialNiveles(r, cat) {
  if (!r.historialNiveles.length) return html`<p>Aún no hubo cambios de nivel.</p>`;
  return html`<ul>${r.historialNiveles.map((c) => html`<li><strong>${c.fecha}${c.semana ? ` (semana ${c.semana})` : ''}:</strong> nivel ${c.nivelDesde} → ${c.nivelHasta} (${cat.nivel(c.nivelHasta)?.nombre ?? ''}). ${c.motivo}</li>`)}</ul>`;
}

export function render({ cat, main }) {
  const plan = leer('plan');
  const evaluaciones = leer('evaluaciones', []);
  const sesiones = leer('sesiones', []);
  const cambiosNivel = leer('cambiosNivel', []);
  if (!plan) {
    montar(main, html`<section><h1>Progreso</h1><div class="tarjeta"><p>Tu progreso aparecerá cuando tengas un plan y registres sesiones.</p>
      <a class="btn btn-primario" href="#/evaluacion">Hacer la evaluación</a></div></section>`);
    return;
  }
  const r = resumen({ evaluaciones, sesiones, plan, cambiosNivel }, cat);
  const sem = Math.min(semanaDelPlan(plan.fechaInicio, hoyISO()), plan.duracionSemanas);
  const pendientes = reevaluacionesPendientes(plan, evaluaciones, sem);
  montar(main, html`<section>
    <div class="encabezado-vista"><h1>Progreso</h1>
      <p>Nivel actual ${r.nivelActual} · ${cat.nivel(r.nivelActual)?.nombre ?? ''} · ${r.sesionesCompletadas} sesiones completadas</p></div>
    ${pendientes.length ? html`<div class="aviso aviso-alerta"><h2>Re-evaluaciones pendientes</h2>
      ${pendientes.map((p) => html`<a class="btn btn-secundario" href="${hrefReevaluacion(p)}">${NOMBRE[p.tipo]} · semana ${p.semana}</a>`)}</div>` : ''}
    ${bloqueGraficas(r, plan)}
    <div class="tarjeta"><h2>Historial de niveles</h2>${historialNiveles(r, cat)}</div>
    <a class="btn btn-secundario btn-ancho" href="#/informe">Informe para mi profesional</a>
    <p class="aviso-corto">${cat.meta.avisoCorto}</p>
  </section>`);
}
