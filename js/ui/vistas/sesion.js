// Sesión guiada a pantalla completa (RF-07, RF-08, RF-09, RF-21; docs/diseno.md §7 wireframe y §10).
// #/sesion/<TIPO>?semana=N&dia=X&series=S
// Puerta de seguridad → checklist "Confirmo" (solo con corriente) → ficha y pasos → temporizador → registro → fin.

import { html, montar, h, $, $$ } from '../../util/dom.js';
import { construirLineaTiempo, registroDeSesion } from '../../engine/sesion.js';
import { entradasDelDia } from '../../engine/planificador.js';
import { leer, guardarSesion } from '../../store/repo.js';
import { hoyISO, diaSemana, mmss, DIAS, NOMBRES_DIA } from '../../util/fechas.js';
import { navegar, volver } from '../../router.js';
import { prepararAudio } from '../../util/audio.js';
import { pedirWakeLock, soltarWakeLock } from '../../util/wakelock.js';
import { crearTemporizador } from '../componentes/temporizador.js';
import { fichaParametros, resumenParametros } from '../componentes/ficha-parametros.js';
import { puertaEST, bloqueBloqueo, montarChecklist, marcarConsultada } from '../componentes/checklist-seguridad.js';
import { nombreEntrada, hrefEntrada } from '../componentes/tarjeta-sesion.js';
import { confirmar } from '../componentes/modal.js';

const RADIO = 52;
const CIRC = 2 * Math.PI * RADIO;

/** Nombre visible de la fase. */
export function nombreFase(f) {
  if (!f) return '';
  if (f.nombre === 'CONTRAE' && f.pasiva) return 'EQUIPO ON';
  return {
    CONTRAE: 'CONTRAE', RELAJA: 'RELAJA', RAPIDA: 'RÁPIDA', SUELTA: 'SUELTA', DESCANSO: 'DESCANSO',
    INHALA: 'INHALA', EXHALA: 'EXHALA', POSTURA: 'POSTURA', CAMBIO_PROGRAMA: 'CAMBIO DE PROGRAMA',
  }[f.nombre] ?? f.nombre;
}

/** "Ciclo 12 / 80" · "Serie 1/3 · Rep 4/8" · "Bloque 1/2 · …" */
export function textoContador(f) {
  if (!f) return '';
  if (f.ciclos) return `Ciclo ${f.ciclo} / ${f.ciclos}${f.bloques ? ` · bloque ${f.bloque}/${f.bloques}` : ''}`;
  if (f.series && f.rep) return `Serie ${f.serie}/${f.series} · Rep ${f.rep}/${f.reps}`;
  if (f.series && f.serie) return `Serie ${f.serie}/${f.series}`;
  if (f.rep) return `Rep ${f.rep}/${f.reps}`;
  if (f.bloque) return `Parte ${f.bloque}/${f.bloques ?? f.bloque}`;
  return '';
}

function ahoraLocalISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${hoyISO()}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function render({ cat, main, params, query }) {
  const tipoId = params[0];
  const tipo = cat.tipoSesion(tipoId);
  if (!tipo) {
    montar(main, html`<section class="pantalla-error"><h1>Sesión no encontrada</h1><a class="btn btn-primario" href="#/hoy">Ir a Hoy</a></section>`);
    return;
  }
  if (tipoId === 'VES-DIARIO') { navegar(`#/vesical?semana=${query.semana ?? ''}&dia=${query.dia ?? ''}`, { reemplazar: true }); return; }

  const plan = leer('plan');
  const hoy = hoyISO();
  const semana = Number(query.semana ?? plan?.semanaActual ?? 1) || 1;
  const dia = DIAS.includes(query.dia) ? query.dia : diaSemana(hoy);
  const semPlan = plan?.semanas?.find((s) => s.numero === semana);
  let nivel = semPlan?.nivel ?? plan?.nivelActual ?? Math.max(1, tipo.nivelMin ?? 0);
  if (!cat.nivel(nivel)) nivel = 1;
  const series = query.series ? Number(query.series) : undefined;
  const equipo = leer('equipo');
  const corriente = cat.usaCorriente(tipoId);
  const lt = construirLineaTiempo(tipoId, { nivel, semana, series, equipo }, cat);
  const aviso = html`<p class="aviso-corto">${cat.meta.avisoCorto}</p>`;

  const raiz = h('div', { class: 'sesion' });
  main.append(raiz);
  let temp = null;
  let guardado = false;
  let terminadoNatural = false;

  const cabecera = () => html`<div class="sesion-cabecera">
    <button type="button" class="btn-volver" data-accion="volver" aria-label="Salir de la sesión">←</button>
    <h1 tabindex="-1">${tipoId} · Semana ${semana} · Nivel ${nivel}</h1></div>`;

  function enlazarVolver() {
    $('[data-accion="volver"]', raiz)?.addEventListener('click', async () => {
      const st = temp?.estado();
      if (st?.iniciado && !guardado) {
        const ok = await confirmar('¿Salir de la sesión?', 'Se guardará como no completada con el tiempo que llevas.', { si: 'Salir' });
        if (!ok) return;
      }
      volver('#/hoy');
    });
  }

  function guardarIncompleta() {
    if (guardado || !temp) return;
    const st = temp.estado();
    if (!st.iniciado) return;
    guardado = true;
    temp.terminar();
    guardarSesion({
      fecha: ahoraLocalISO(), dia, semana, tipoSesionId: tipoId, nivel,
      duracionRealSeg: Math.round(st.t), completada: false, repsPlanificadas: lt.repsPlanificadas,
    });
  }

  // --- 1. Puerta de seguridad ------------------------------------------------------------------
  function pantallaBloqueo(puerta) {
    montar(raiz, html`${cabecera()}${bloqueBloqueo(puerta)}
      <a class="btn btn-secundario btn-ancho" href="#/biblioteca">Ver sesiones sin equipo</a>${aviso}`);
    enlazarVolver();
    $('[data-accion="consulte"]', raiz)?.addEventListener('click', async () => {
      const ok = await confirmar('Ya consulté con un médico', 'Confirmas que un médico revisó la señal de alarma y te autorizó a seguir. El plan se recalculará.', { si: 'Sí, ya consulté' });
      if (ok) { marcarConsultada(cat); inicio(); }
    });
    $('h1', raiz).focus();
  }

  // --- 2. Checklist ----------------------------------------------------------------------------
  function pantallaChecklist(evaluacion) {
    montar(raiz, html`${cabecera()}<div id="chk"></div>${aviso}`);
    enlazarVolver();
    montarChecklist($('#chk', raiz), { cat, seguridad: evaluacion?.seguridad, alConfirmar: pantallaPreparar });
    $('h1', raiz).focus();
  }

  // --- 3. Ficha y pasos ------------------------------------------------------------------------
  function pantallaPreparar() {
    const registro = lt.modo === 'registro';
    const minutos = Math.round(lt.totalSeg / 60);
    montar(raiz, html`${cabecera()}
      <h2>${tipo.nombre}</h2>
      <p>${tipo.resumen}</p>
      ${!registro ? html`<p class="texto-suave">Duración: ${minutos >= 1 ? `${minutos} min` : `${lt.totalSeg} s`}${lt.repsPlanificadas ? ` · ${lt.repsPlanificadas} contracciones` : ''}</p>` : ''}
      ${lt.parametros ? fichaParametros({ tipo, parametros: lt.parametros, bloques: lt.bloques, semana, equipo, catalogo: cat, abierta: corriente }) : ''}
      ${corriente && !equipo ? html`<div class="aviso aviso-info"><p>No tienes un equipo registrado. Configura el tuyo a mano con la ficha o regístralo en <a href="#/equipo">Mi equipo</a>.</p></div>` : ''}
      <div class="tarjeta"><h3>Pasos</h3><ol class="pasos-lista">${tipo.pasos.map((p) => html`<li>${p}</li>`)}</ol></div>
      ${tipo.seguridad?.length ? html`<div class="aviso aviso-alerta"><h3>Seguridad</h3><ul>${tipo.seguridad.map((x) => html`<li>${x}</li>`)}</ul></div>` : ''}
      ${registro && tipo.estructura?.checklist ? html`<form id="form-habitos" class="tarjeta"><h3>Esta semana…</h3>
        ${tipo.estructura.checklist.map((c, i) => html`<label class="casilla"><input type="checkbox" name="hab" value="${i}"><span>${c}</span></label>`)}
        <button type="submit" class="btn btn-primario btn-grande">Guardar revisión</button></form>`
        : html`<button type="button" class="btn btn-primario btn-grande" data-accion="empezar">${corriente ? 'Equipo configurado, empezar' : 'Empezar'}</button>`}
      ${aviso}`);
    enlazarVolver();
    $('[data-accion="empezar"]', raiz)?.addEventListener('click', pantallaTemporizador);
    $('#form-habitos', raiz)?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const marcados = $$('input[name="hab"]:checked', raiz).length;
      const total = tipo.estructura.checklist.length;
      guardado = true;
      guardarSesion({
        fecha: ahoraLocalISO(), dia, semana, tipoSesionId: tipoId, nivel, duracionRealSeg: 0, completada: true,
        repsPlanificadas: 0, nota: `Hábitos cumplidos: ${marcados} de ${total}`,
      });
      pantallaFin({ completada: true, dolor: false, extra: `Cumpliste ${marcados} de ${total} hábitos esta semana.` });
    });
    $('h1', raiz).focus();
  }

  // --- 4. Temporizador -------------------------------------------------------------------------
  function pantallaTemporizador() {
    prepararAudio();
    const f0 = lt.fases[0];
    montar(raiz, html`${cabecera()}
      ${lt.parametros && corriente ? html`<p class="texto-suave" style="text-align:center;margin:0">${lt.bloques ? lt.bloques.map((b) => resumenParametros(b.parametros)).join(' → ') : resumenParametros(lt.parametros)}</p>` : ''}
      <div class="temporizador" data-fase="${f0?.nombre}">
        <p class="fase-nombre" id="fase-nombre" aria-live="assertive" aria-atomic="true">${nombreFase(f0)}</p>
        <div class="anillo">
          <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
            <circle class="fondo-anillo" cx="60" cy="60" r="${RADIO}" fill="none" stroke-width="10"/>
            <circle class="progreso-anillo" id="anillo" cx="60" cy="60" r="${RADIO}" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="${CIRC.toFixed(2)}" stroke-dashoffset="0"/>
          </svg>
          <div class="cuenta" id="cuenta" aria-hidden="true">${f0?.seg ?? 0}</div>
        </div>
        <p class="instruccion" id="instruccion">${f0?.instruccion ?? ''}</p>
        <p class="contador-ciclos" id="contador">${textoContador(f0)}</p>
        <p class="aviso-tens" id="aviso-tens" role="status" hidden></p>
        <button type="button" class="btn btn-primario btn-grande" id="btn-continuar" hidden>Listo, continuar</button>
        <div class="controles-sesion">
          <button type="button" class="btn btn-secundario" id="btn-pausa">Pausa</button>
          <button type="button" class="btn btn-peligro" id="btn-terminar">Terminar</button>
        </div>
      </div>${aviso}`);
    enlazarVolver();
    const el = {
      tmp: $('.temporizador', raiz), nombre: $('#fase-nombre', raiz), cuenta: $('#cuenta', raiz), anillo: $('#anillo', raiz),
      instr: $('#instruccion', raiz), cont: $('#contador', raiz), tens: $('#aviso-tens', raiz),
      pausa: $('#btn-pausa', raiz), terminar: $('#btn-terminar', raiz), continuar: $('#btn-continuar', raiz),
    };
    let ultimaCuenta = null;
    let ultimoCont = null;
    temp = crearTemporizador({
      fases: lt.fases,
      avisosSeg: lt.avisosSeg ?? [],
      alCambiarFase: (e) => {
        el.tmp.dataset.fase = e.fase.nombre;
        el.nombre.textContent = nombreFase(e.fase);
        el.instr.textContent = e.fase.instruccion ?? '';
        const auto = e.pausaAuto;
        el.continuar.hidden = !auto;
        el.pausa.textContent = auto || e.pausado ? 'Reanudar' : 'Pausa';
        if (auto) el.continuar.focus();
      },
      alTick: (e) => {
        if (!e.fase) return;
        const c = Math.max(1, Math.ceil(e.restanteFase - 1e-6));
        if (c !== ultimaCuenta) { el.cuenta.textContent = c; ultimaCuenta = c; }
        el.anillo.setAttribute('stroke-dashoffset', (CIRC * (e.transcurridoFase / e.fase.seg)).toFixed(2));
        const txt = `${textoContador(e.fase)}${textoContador(e.fase) ? ' · ' : ''}${mmss(e.restanteTotal)} restan`;
        if (txt !== ultimoCont) { el.cont.textContent = txt; ultimoCont = txt; }
      },
      alAviso: () => {
        el.tens.hidden = false;
        el.tens.textContent = 'Revisa cómo te sientes: si hay molestia o quemazón, baja la intensidad.';
        setTimeout(() => { el.tens.hidden = true; }, 12000);
      },
      alTerminar: () => {
        terminadoNatural = true;
        pantallaRegistro();
      },
    });
    el.pausa.addEventListener('click', () => {
      const st = temp.estado();
      if (st.pausado) { temp.reanudar(); el.pausa.textContent = 'Pausa'; el.continuar.hidden = true; } else { temp.pausar(); el.pausa.textContent = 'Reanudar'; }
    });
    el.continuar.addEventListener('click', () => { temp.saltarFase(); el.pausa.textContent = 'Pausa'; el.continuar.hidden = true; });
    el.terminar.addEventListener('click', async () => {
      const ok = await confirmar('¿Terminar la sesión?', 'Pasarás al registro de cómo te fue.', { si: 'Terminar' });
      if (ok) pantallaRegistro();
    });
    pedirWakeLock();
    temp.iniciar();
  }

  // --- 5. Registro -----------------------------------------------------------------------------
  function pantallaRegistro() {
    const st = temp ? temp.terminar() : { t: 0 };
    soltarWakeLock();
    const dur = Math.round(st.t);
    const completada = terminadoNatural || dur >= lt.totalSeg * 0.5;
    const campos = registroDeSesion(tipoId, cat);
    const mAMax = Number(equipo?.mAMax) > 0 ? Number(equipo.mAMax) : 100;
    const tieneEMG = equipo?.tieneEMG === true;
    const presion = equipo?.tipo === 'biofeedback-presion';
    const reqMA = campos.includes('intensidadMA') && !(equipo && Number(equipo.mAMax) === 0);
    montar(raiz, html`${cabecera()}
      <h2>¿Cómo te fue?</h2>
      <p class="texto-suave">Duración: ${mmss(dur)}${completada ? '' : ' · la terminaste antes de la mitad: se guardará como no completada.'}</p>
      <form id="form-registro" novalidate>
        ${campos.includes('intensidadMA') ? html`<div class="campo"><label for="r-ma">Intensidad usada (mA)${reqMA ? '' : ' — opcional'}</label>
          <input type="number" id="r-ma" inputmode="numeric" min="0" max="${mAMax}" step="1" ${reqMA ? 'required' : ''}>
          <span class="texto-suave">Máximo de tu equipo: ${mAMax} mA.</span></div>` : ''}
        ${campos.includes('esfuerzo') ? html`<fieldset class="pregunta"><legend><label for="r-esf">Esfuerzo percibido (1 = muy fácil, 10 = máximo)</label></legend>
          <div class="deslizador"><input type="range" id="r-esf" min="1" max="10" step="1" value="5"><output id="r-esf-out">5</output></div></fieldset>` : ''}
        ${campos.includes('repsLogradas') && lt.repsPlanificadas ? html`<div class="campo"><label for="r-reps">Repeticiones logradas con buena calidad (de ${lt.repsPlanificadas})</label>
          <input type="number" id="r-reps" inputmode="numeric" min="0" max="${lt.repsPlanificadas}" step="1" value="${completada ? lt.repsPlanificadas : ''}"></div>` : ''}
        ${campos.includes('emgPicoUV') || campos.includes('emgReposoUV') || (tieneEMG && tipo.categoria === 'biofeedback') ? html`<fieldset class="pregunta"><legend>${presion ? 'Puntaje del sensor (opcional)' : 'Valores del biofeedback (opcional)'}</legend>
          <div class="campo"><label for="r-pico">${presion ? 'Puntaje o presión máxima' : 'Pico de la contracción (µV)'}</label><input type="number" id="r-pico" inputmode="decimal" min="0" step="0.1"></div>
          <div class="campo"><label for="r-reposo">${presion ? 'Valor en reposo' : 'Reposo (µV)'}</label><input type="number" id="r-reposo" inputmode="decimal" min="0" step="0.1"></div></fieldset>` : ''}
        ${campos.includes('dolor') ? html`<fieldset class="pregunta" data-req="dolor"><legend>¿Sentiste dolor durante o después de la sesión?</legend>
          <div class="sino"><label class="opcion"><input type="radio" name="dolor" value="si"><span>Sí</span></label><label class="opcion"><input type="radio" name="dolor" value="no"><span>No</span></label></div></fieldset>` : ''}
        <div class="campo"><label for="r-nota">Nota (opcional)</label><textarea id="r-nota" maxlength="500"></textarea></div>
        <p class="aviso aviso-peligro" id="r-error" role="alert" hidden></p>
        <button type="submit" class="btn btn-primario btn-grande">Guardar</button>
      </form>${aviso}`);
    enlazarVolver();
    $('#r-esf', raiz)?.addEventListener('input', (e) => { $('#r-esf-out', raiz).textContent = e.target.value; });
    $('#form-registro', raiz).addEventListener('submit', (ev) => {
      ev.preventDefault();
      const errores = [];
      const num = (sel) => { const v = $(sel, raiz)?.value; return v === '' || v == null ? null : Number(v); };
      const ma = num('#r-ma');
      if (campos.includes('intensidadMA')) {
        if (ma == null && reqMA) errores.push('Anota la intensidad que usaste (mA).');
        else if (ma != null && (ma < 0 || ma > mAMax)) errores.push(`La intensidad debe estar entre 0 y ${mAMax} mA.`);
      }
      const dolorSel = $('input[name="dolor"]:checked', raiz);
      if (campos.includes('dolor') && !dolorSel) errores.push('Indica si sentiste dolor.');
      const reps = num('#r-reps');
      if (reps != null && (reps < 0 || reps > lt.repsPlanificadas)) errores.push(`Las repeticiones deben estar entre 0 y ${lt.repsPlanificadas}.`);
      const err = $('#r-error', raiz);
      if (errores.length) { err.hidden = false; err.textContent = errores.join(' '); err.focus?.(); return; }
      const ses = {
        fecha: ahoraLocalISO(), dia, semana, tipoSesionId: tipoId, nivel, duracionRealSeg: dur, completada,
        repsPlanificadas: lt.repsPlanificadas,
      };
      if (ma != null) ses.intensidadMA = ma;
      if ($('#r-esf', raiz)) ses.esfuerzo = Number($('#r-esf', raiz).value);
      if (dolorSel) ses.dolor = dolorSel.value === 'si';
      if (reps != null) ses.repsLogradas = reps;
      const pico = num('#r-pico');
      const reposo = num('#r-reposo');
      if (pico != null) ses.emgPicoUV = pico;
      if (reposo != null) ses.emgReposoUV = reposo;
      const nota = $('#r-nota', raiz).value.trim();
      if (nota) ses.nota = nota;
      guardado = true;
      guardarSesion(ses);
      pantallaFin({ completada, dolor: ses.dolor === true });
    });
    $('h1', raiz).focus();
  }

  // --- 6. Fin ----------------------------------------------------------------------------------
  function proximaSesion() {
    const p = leer('plan');
    if (!p) return null;
    const idx = DIAS.indexOf(diaSemana(hoyISO()));
    for (let w = semana; w <= Math.min(semana + 1, p.duracionSemanas); w++) {
      for (let i = (w === semana ? idx : 0); i < 7; i++) {
        const d = DIAS[i];
        const e = entradasDelDia(p, w, d).find((x) => x.estado !== 'hecha');
        if (e) return { e, semana: w, dia: d };
      }
    }
    return null;
  }

  function pantallaFin({ completada, dolor, extra = '' }) {
    const prox = proximaSesion();
    montar(raiz, html`<section style="text-align:center">
      <h1 tabindex="-1">${completada ? 'Sesión completada' : 'Sesión guardada'}</h1>
      <p class="objetivo-grande" aria-hidden="true">${completada ? '✓' : '•'}</p>
      ${extra ? html`<p>${extra}</p>` : ''}
      ${dolor ? html`<div class="aviso aviso-peligro" role="alert"><p><strong>Si el dolor continúa, consulta con tu profesional.</strong> Baja la intensidad la próxima vez.</p></div>` : ''}
      ${prox ? html`<div class="tarjeta"><p class="texto-suave" style="margin:0">Próxima sesión</p>
        <p><strong>${nombreEntrada(prox.e.tipo, cat)}</strong> — ${NOMBRES_DIA[prox.dia]}${prox.semana !== semana ? ' de la próxima semana' : ''}</p>
        <a class="btn btn-secundario" href="${hrefEntrada(prox.e, prox.semana, prox.dia)}">Abrir</a></div>` : ''}
      <a class="btn btn-primario btn-grande" href="#/hoy">Volver a Hoy</a>
      ${aviso}</section>`);
    $('h1', raiz).focus();
  }

  function inicio() {
    if (corriente) {
      const puerta = puertaEST(cat, hoy);
      if (!puerta.ok) { pantallaBloqueo(puerta); return; }
      pantallaChecklist(puerta.evaluacion);
      return;
    }
    pantallaPreparar();
  }

  const alSalirPagina = () => guardarIncompleta();
  window.addEventListener('pagehide', alSalirPagina);
  inicio();

  return () => {
    window.removeEventListener('pagehide', alSalirPagina);
    guardarIncompleta();
    temp?.terminar();
    soltarWakeLock();
  };
}
