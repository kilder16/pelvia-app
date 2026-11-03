// Puerta de seguridad y lista de verificación antes de cada sesión con corriente (RF-02, RF-21, RNF-08).

import { html, montar, $, $$ } from '../../util/dom.js';
import { puedeIniciarEST } from '../../engine/seguridad.js';
import { regenerarConSeguridad } from '../../engine/planificador.js';
import { leer, guardar } from '../../store/repo.js';
import { hoyISO } from '../../util/fechas.js';

/** Última evaluación que contiene un cuestionario de seguridad (orden de registro). */
export function ultimaEvaluacionSeguridad(evaluaciones) {
  const lista = (evaluaciones ?? []).filter((e) => e.seguridad);
  return lista.length ? lista[lista.length - 1] : null;
}

/** Resultado de puedeIniciarEST con la seguridad de la última evaluación. */
export function puertaEST(cat, hoy = hoyISO()) {
  const ev = ultimaEvaluacionSeguridad(leer('evaluaciones', []));
  return { ...puedeIniciarEST({ evaluacion: ev?.seguridad ?? null, hoy, catalogo: cat }), evaluacion: ev };
}

/** "Ya consulté con un médico": marca consultada=true y recalcula el plan. */
export function marcarConsultada(cat) {
  const evs = leer('evaluaciones', []);
  const ev = ultimaEvaluacionSeguridad(evs);
  if (!ev) return false;
  ev.seguridad.consultada = true;
  ev.seguridad.fechaConsulta = hoyISO();
  guardar('evaluaciones', evs);
  const plan = leer('plan');
  if (plan) guardar('plan', regenerarConSeguridad(plan, ev.seguridad, cat));
  return true;
}

/** Bloque que explica por qué no se puede iniciar y ofrece la salida adecuada. */
export function bloqueBloqueo(puerta) {
  const reHacer = ['vencida', 'incompleta', 'sin-evaluacion'].includes(puerta.codigo);
  return html`<div class="aviso aviso-peligro" role="alert">
    <h2>${puerta.codigo === 'bandera-roja' ? 'Bandera roja: consulta médica antes de continuar'
      : puerta.codigo === 'contraindicacion' ? 'Consulta con tu profesional antes de usar el electroestimulador'
        : 'Antes de usar el equipo'}</h2>
    <p>${puerta.motivo}</p>
    ${reHacer ? html`<a class="btn btn-primario" href="#/evaluacion?tipo=seguridad">Responder el cuestionario de seguridad</a>` : ''}
    ${puerta.codigo === 'bandera-roja' ? html`<button type="button" class="btn btn-primario" data-accion="consulte">Ya consulté con un médico</button>` : ''}
    ${puerta.codigo === 'contraindicacion' ? html`<p class="texto-suave">Si tu situación cambió (por ejemplo, ya se trató una infección), actualiza el cuestionario.</p><a class="btn btn-secundario" href="#/evaluacion?tipo=seguridad">Actualizar cuestionario de seguridad</a>` : ''}
  </div>`;
}

/**
 * Lista de verificación con "Confirmo" deshabilitado hasta marcar todas las casillas.
 * @param {HTMLElement} cont
 * @param {{cat:object, seguridad?:object, alConfirmar:()=>void}} op
 */
export function montarChecklist(cont, { cat, seguridad = null, alConfirmar }) {
  const s = cat.seguridad;
  const precauciones = seguridad?.precauciones ?? [];
  montar(cont, html`<section class="tarjeta checklist" aria-labelledby="chk-t">
    <h2 id="chk-t">Antes de empezar, confirma</h2>
    <fieldset class="lista-casillas"><legend class="solo-lectores">Lista de verificación de seguridad</legend>
      ${s.checklistSesionEST.map((texto, i) => html`<label class="casilla"><input type="checkbox" name="chk" value="${i}"><span>${texto}</span></label>`)}
    </fieldset>
    ${precauciones.length ? html`<div class="aviso aviso-alerta"><h3>Tus precauciones</h3><ul>${precauciones.map((p) => html`<li>${p.mensaje}</li>`)}</ul></div>` : ''}
    <details class="recordatorio"><summary>No uses el equipo si…</summary>
      <ul>${s.contraindicacionesAbsolutas.map((c) => html`<li>${c.pregunta.replace(/^¿/, '').replace(/\?$/, '')}</li>`)}</ul>
    </details>
    <div class="aviso aviso-info"><h3>Intensidad y cuidado</h3><ul>${s.reglasIntensidad.map((r) => html`<li>${r}</li>`)}</ul></div>
    <button type="button" class="btn btn-primario btn-grande" data-accion="confirmo" disabled>Confirmo</button>
    <p class="texto-suave" id="chk-falta" aria-live="polite">Marca todas las casillas para continuar.</p>
  </section>`);
  const btn = $('[data-accion="confirmo"]', cont);
  const casillas = $$('input[name="chk"]', cont);
  const revisar = () => {
    const faltan = casillas.filter((c) => !c.checked).length;
    btn.disabled = faltan > 0;
    $('#chk-falta', cont).textContent = faltan ? `Faltan ${faltan} casilla(s).` : 'Listo.';
  };
  casillas.forEach((c) => c.addEventListener('change', revisar));
  btn.addEventListener('click', () => { if (!btn.disabled) alConfirmar(); });
}
