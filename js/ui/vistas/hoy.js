// Pantalla "Hoy" (RF-12): sesiones del día con estado, próxima re-evaluación, racha y avisos.

import { html, montar, $ } from '../../util/dom.js';
import { leer, ajustes } from '../../store/repo.js';
import { hoyISO, diaSemana, semanaDelPlan, DIAS, NOMBRES_DIA, diasEntre, fechaDePlan, formatoCorto } from '../../util/fechas.js';
import { entradasDelDia, REEVAL } from '../../engine/planificador.js';
import { conteoSemana, reevaluacionesPendientes } from '../../engine/progresion.js';
import { seguridadVigente, banderaRojaActiva } from '../../engine/seguridad.js';
import { tarjetaSesion, nombreEntrada, hrefEntrada } from '../componentes/tarjeta-sesion.js';
import { ultimaEvaluacionSeguridad, marcarConsultada } from '../componentes/checklist-seguridad.js';
import { abrirModal, confirmar } from '../componentes/modal.js';

const NOMBRE_REEVAL = { fuerza: 'Re-evaluación de fuerza', iciq: 'Cuestionario ICIQ', eva: 'Escala de dolor', diario: 'Diario miccional' };

export function hrefReevaluacion(r) {
  if (r.tipo === 'diario') return `#/vesical?semana=${r.semana}`;
  return `#/evaluacion?tipo=${r.tipo}&semana=${r.semana}&dia=${r.tipo === 'fuerza' ? 'L' : 'D'}`;
}

export function render({ cat, main, app }) {
  const plan = leer('plan');
  const hoy = hoyISO();
  const aj = ajustes();
  const avisoCorto = html`<p class="aviso-corto">${cat.meta.avisoCorto}</p>`;
  const respaldoViejo = !aj.ultimoRespaldo || diasEntre(aj.ultimoRespaldo, hoy) > 30;
  const tarjetaRespaldo = respaldoViejo && plan && !leer('perfil')?.demo
    ? html`<div class="aviso aviso-info"><h2>Haz un respaldo</h2><p>${aj.ultimoRespaldo ? `Tu último respaldo es del ${aj.ultimoRespaldo}.` : 'Aún no has guardado un respaldo.'} Si se borran los datos del navegador, perderías tu progreso.</p><a class="btn btn-secundario" href="#/ajustes?ir=respaldo">Exportar respaldo</a></div>`
    : '';

  if (!plan) {
    montar(main, html`<section>
      <h1>Hoy</h1>
      <div class="tarjeta"><h2>Empieza con tu evaluación</h2>
        <p>En unos 10 minutos respondes un cuestionario de seguridad, tus síntomas y una prueba de fuerza. Con eso PELVIA arma tu plan de 12 semanas.</p>
        <a class="btn btn-primario btn-grande" href="#/evaluacion">Hacer la evaluación</a></div>
      <ul class="enlace-lista tarjeta"><li><a href="#/equipo">Registrar mi equipo</a></li><li><a href="#/aprende">Aprender sobre el suelo pélvico</a></li></ul>
      ${avisoCorto}</section>`);
    return;
  }

  const semHoy = semanaDelPlan(plan.fechaInicio, hoy);
  const dia = diaSemana(hoy);
  const semana = Math.max(1, Math.min(semHoy, plan.duracionSemanas));
  const fuera = semHoy > plan.duracionSemanas || plan.estado === 'finalizado';
  const semPlan = plan.semanas.find((s) => s.numero === semana);
  const nivel = semPlan?.nivel ?? plan.nivelActual;
  const equipo = leer('equipo');
  const sesiones = leer('sesiones', []);
  const evaluaciones = leer('evaluaciones', []);
  const entradas = fuera ? [] : entradasDelDia(plan, semana, dia);
  const conteo = conteoSemana(plan, sesiones, semana);
  const evSeg = ultimaEvaluacionSeguridad(evaluaciones);
  const seg = evSeg?.seguridad;
  const hayCorriente = plan.semanas.some((s) => Object.values(s.dias).flat().some((e) => cat.usaCorriente(e.tipo) || cat.usaCorriente(e.reemplazaA)));
  const nombreNivel = cat.nivel(plan.nivelActual)?.nombre ?? '';

  // Racha: días de esta semana (hasta hoy) con todo hecho.
  const idxHoy = DIAS.indexOf(dia);
  const completo = (d) => {
    const l = (semPlan?.dias?.[d] ?? []).filter((e) => e.condicion !== 'dolorSemanalMenor');
    return l.length > 0 && l.every((e) => e.estado === 'hecha');
  };
  const racha = DIAS.filter((d, i) => i <= idxHoy && completo(d)).length;

  // Próxima re-evaluación pendiente (desde hoy) y atrasadas.
  let proxima = null;
  for (const s of plan.semanas.filter((x) => x.numero >= semana)) {
    for (const d of DIAS) {
      if (s.numero === semana && DIAS.indexOf(d) < idxHoy) continue;
      const e = s.dias[d].find((x) => Object.values(REEVAL).includes(x.tipo) && x.estado !== 'hecha');
      if (e) { proxima = { e, semana: s.numero, dia: d }; break; }
    }
    if (proxima) break;
  }
  const atrasadas = reevaluacionesPendientes(plan, evaluaciones, Math.min(semana, plan.duracionSemanas))
    .filter((r) => r.semana < semana || (r.semana === semana && !(proxima && proxima.semana === semana)));

  const avisos = [];
  if (seg && banderaRojaActiva(seg)) {
    avisos.push(html`<div class="aviso aviso-peligro" role="alert"><h2>Bandera roja: consulta médica antes de continuar</h2><p>${cat.seguridad.mensajes.banderaRoja}</p>
      <button type="button" class="btn btn-primario" data-accion="consulte">Ya consulté con un médico</button></div>`);
  }
  if (seg?.contraindicacionEST) {
    avisos.push(html`<div class="aviso aviso-alerta"><h2>Sin electroestimulación por ahora</h2><p>${cat.seguridad.mensajes.contraindicacion}</p>
      <a class="btn btn-secundario" href="#/evaluacion?tipo=seguridad">Actualizar cuestionario de seguridad</a></div>`);
  } else if (seg && !seguridadVigente(seg, hoy, cat.seguridad.vigenciaDias) && hayCorriente) {
    avisos.push(html`<div class="aviso aviso-alerta"><h2>Renueva tu cuestionario de seguridad</h2><p>${cat.seguridad.mensajes.vencida}</p>
      <a class="btn btn-primario" href="#/evaluacion?tipo=seguridad">Responder ahora</a></div>`);
  }
  if (!equipo && !seg?.contraindicacionEST) {
    avisos.push(html`<div class="aviso aviso-info"><p>¿Tienes electroestimulador? Regístralo en <a href="#/equipo">Mi equipo</a> para que tu plan incluya sus sesiones.</p></div>`);
  }
  const perfilVesical = ['URGENCIA', 'MIXTA'].includes(plan.perfil);

  montar(main, html`<section>
    <div class="encabezado-vista">
      <h1>Hoy</h1>
      <p>${NOMBRES_DIA[dia]} · ${formatoCorto(hoy)}</p>
    </div>
    ${avisos}
    ${fuera ? html`<div class="aviso ${plan.decisionFinal ? 'aviso-peligro' : 'aviso-info'}"><h2>Terminaste tu programa</h2>
      <p>${plan.mensajeFinal ?? 'Completaste todas las semanas del plan.'}</p>
      <a class="btn btn-primario" href="#/informe">Ver informe para mi profesional</a>
      <a class="btn btn-secundario" href="#/evaluacion">Hacer una nueva evaluación</a></div>` : html`
    <div class="resumen-hoy">
      <div class="dato"><strong>${semana}<small>/${plan.duracionSemanas}</small></strong><span>Semana</span></div>
      <div class="dato"><strong>${plan.nivelActual}</strong><span>Nivel${nombreNivel ? ` · ${nombreNivel}` : ''}</span></div>
      <div class="dato"><strong>${conteo.planificadas ? Math.round((conteo.hechas / conteo.planificadas) * 100) : 0} %</strong><span>Esta semana</span></div>
    </div>
    <h2>Sesiones de hoy</h2>
    <div class="lista-sesiones">
      ${entradas.length ? entradas.map((e) => tarjetaSesion(e, { semana, dia, nivel, equipo, cat })) : html`<div class="tarjeta"><p>Hoy no tienes sesiones planificadas. Descansa o repasa la sección Aprende.</p></div>`}
    </div>
    ${tarjetaRespaldo}
    <div class="tarjeta" style="margin-top:var(--esp-4)">
      <h2>Racha de la semana</h2>
      <p>${racha} de ${idxHoy + 1} día(s) con todo hecho · ${conteo.hechas} de ${conteo.planificadas} sesiones de la semana.</p>
      <div class="racha" aria-hidden="true">${DIAS.map((d, i) => html`<span class="${completo(d) ? 'completo' : ''} ${i === idxHoy ? 'hoy' : ''}">${d}</span>`)}</div>
    </div>
    ${atrasadas.length ? html`<div class="aviso aviso-alerta"><h2>Re-evaluaciones pendientes</h2>
      ${atrasadas.map((r) => html`<a class="btn btn-secundario" href="${hrefReevaluacion(r)}">${NOMBRE_REEVAL[r.tipo]} (semana ${r.semana})</a>`)}</div>` : ''}
    <div class="tarjeta"><h2>Próxima re-evaluación</h2>
      ${proxima ? html`<p><a href="${hrefEntrada(proxima.e, proxima.semana, proxima.dia)}">${nombreEntrada(proxima.e.tipo, cat)}</a> — ${NOMBRES_DIA[proxima.dia]} ${formatoCorto(fechaDePlan(plan.fechaInicio, proxima.semana, proxima.dia))} (semana ${proxima.semana}).</p>`
        : html`<p>No hay re-evaluaciones pendientes.</p>`}
    </div>`}
    ${perfilVesical ? html`<ul class="enlace-lista tarjeta"><li><a href="#/vesical">Entrenamiento vesical y diario miccional</a></li></ul>` : ''}
    <ul class="enlace-lista tarjeta"><li><a href="#/resultado">Mi resultado y semana tipo</a></li><li><a href="#/progreso">Mi progreso</a></li></ul>
    ${avisoCorto}
  </section>`);

  $('[data-accion="consulte"]', main)?.addEventListener('click', async () => {
    const ok = await confirmar('Ya consulté con un médico', 'Confirmas que un médico revisó la señal de alarma y te autorizó a seguir. El plan se recalculará.', { si: 'Sí, ya consulté' });
    if (ok) {
      marcarConsultada(cat);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  });

  if (app.avisosPendientes.length) {
    const lista = app.avisosPendientes.splice(0);
    (async () => {
      for (const a of lista) {
        await abrirModal({ titulo: a.titulo, cuerpo: html`${a.lineas.map((l) => html`<p>${l}</p>`)}` });
      }
    })();
  }
}
