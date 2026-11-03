// Evaluación inicial en 3 pasos (RF-02, RF-03, RF-05) y re-evaluaciones (RF-14):
// #/evaluacion                       → seguridad → síntomas + ICIQ → fuerza → plan → Resultado
// #/evaluacion?tipo=fuerza|iciq|eva|seguridad&semana=N&dia=X → solo ese bloque

import { html, montar, h, $, $$ } from '../../util/dom.js';
import { evaluarSeguridad } from '../../engine/seguridad.js';
import { puntajeIciq, clasificar } from '../../engine/clasificador.js';
import { nivelInicial } from '../../engine/nivel.js';
import { generarPlan, regenerarConSeguridad, REEVAL } from '../../engine/planificador.js';
import { compararIciq } from '../../engine/progresion.js';
import { leer, guardar, agregarA, nuevoId, marcarEntrada, guardarAjustes } from '../../store/repo.js';
import { hoyISO, DIAS } from '../../util/fechas.js';
import { navegar } from '../../router.js';
import { confirmar } from '../componentes/modal.js';

const TITULOS = {
  inicial: 'Evaluación',
  fuerza: 'Re-evaluación de fuerza',
  iciq: 'Cuestionario de síntomas (ICIQ)',
  eva: 'Escala de dolor',
  seguridad: 'Cuestionario de seguridad',
};
const ENTRADA_DE = { fuerza: REEVAL.fuerza, iciq: REEVAL.iciq, eva: REEVAL.eva };

function sino(nombre, valor) {
  return html`<div class="sino">
    <label class="opcion"><input type="radio" name="${nombre}" value="si" ${valor === true ? 'checked' : ''}><span>Sí</span></label>
    <label class="opcion"><input type="radio" name="${nombre}" value="no" ${valor === false ? 'checked' : ''}><span>No</span></label>
  </div>`;
}

function preguntaSino(nombre, texto, valor, ayuda = '') {
  return html`<fieldset class="pregunta" data-req="${nombre}"><legend>${texto}</legend>${ayuda ? html`<p class="ayuda">${ayuda}</p>` : ''}${sino(nombre, valor)}</fieldset>`;
}

function opciones(nombre, lista, valor) {
  return html`<div class="opciones">${lista.map((o) => html`<label class="opcion"><input type="radio" name="${nombre}" value="${o.valor}" ${valor === o.valor ? 'checked' : ''}><span>${o.texto}</span></label>`)}</div>`;
}

function deslizador(id, valor, min, max, extremos) {
  return html`<div class="deslizador"><input type="range" id="${id}" min="${min}" max="${max}" step="1" value="${valor}" aria-describedby="${id}-ext"><output for="${id}" id="${id}-out">${valor}</output></div>
    <div class="escala-extremos" id="${id}-ext"><span>${extremos[0]}</span><span>${extremos[1]}</span></div>`;
}

function contador(clave, valor, max = 10) {
  return html`<div class="paso-contador">
    <button type="button" class="btn" data-menos="${clave}" aria-label="Restar uno">−</button>
    <output id="out-${clave}" aria-live="polite">${valor}</output>
    <button type="button" class="btn" data-mas="${clave}" data-max="${max}" aria-label="Sumar uno">+</button>
  </div>`;
}

/** Busca el día de la semana en que el plan tiene la entrada `tipo`. */
function diaDeEntrada(plan, semana, tipo) {
  const s = plan?.semanas?.find((x) => x.numero === semana);
  return DIAS.find((d) => s?.dias?.[d]?.some((e) => e.tipo === tipo)) ?? null;
}

export function render({ cat, main, query }) {
  const tipo = TITULOS[query.tipo] ? query.tipo : 'inicial';
  const plan = leer('plan');
  const semana = query.semana != null ? Number(query.semana) : (tipo === 'inicial' ? 0 : plan?.semanaActual ?? 0);
  const pasos = tipo === 'inicial' ? ['seguridad', 'sintomas', 'fuerza'] : [tipo === 'eva' ? 'eva' : tipo === 'iciq' ? 'iciq' : tipo];
  const s = cat.seguridad;
  const preguntasSeg = [...s.contraindicacionesAbsolutas, ...s.precauciones, ...s.banderasRojas];
  const st = {
    i: 0,
    revision: false,
    fin: null,
    seg: {},
    sint: {},
    ctx: { ctxDiagnostico: '' },
    iciq: { q3: 0, situaciones: [] },
    eva: 0,
    fuerza: { P: null, E: 0, R: 0, F: 0 },
    evSeg: null,
  };
  let crono = null;
  const raiz = h('div', { class: 'evaluacion' });
  main.append(raiz);

  const pararCrono = () => { if (crono) { clearInterval(crono.id); crono = null; } };

  // --- Bloques ---------------------------------------------------------------------------------
  const bloqueSeguridad = () => html`
    <p>Responde todas las preguntas. Sirven para saber si puedes usar el electroestimulador con seguridad.</p>
    <h2 class="seccion-titulo">Para usar la corriente con seguridad</h2>
    ${s.contraindicacionesAbsolutas.map((p) => preguntaSino(`seg:${p.id}`, p.pregunta, st.seg[p.id]))}
    <h2 class="seccion-titulo">Precauciones</h2>
    ${s.precauciones.map((p) => preguntaSino(`seg:${p.id}`, p.pregunta, st.seg[p.id]))}
    <h2 class="seccion-titulo">Señales de alarma</h2>
    ${s.banderasRojas.map((p) => preguntaSino(`seg:${p.id}`, p.pregunta, st.seg[p.id]))}`;

  const bloqueIciq = () => {
    const q = cat.iciq.items;
    return html`
      <h2 class="seccion-titulo">Escapes de orina (ICIQ)</h2>
      <fieldset class="pregunta" data-req="iciq:q1"><legend>${q[0].texto}</legend>${opciones('iciq:q1', q[0].opciones, st.iciq.q1)}</fieldset>
      <fieldset class="pregunta" data-req="iciq:q2"><legend>${q[1].texto}</legend>${opciones('iciq:q2', q[1].opciones, st.iciq.q2)}</fieldset>
      <fieldset class="pregunta"><legend><label for="iciq-q3">${q[2].texto}</label></legend>${deslizador('iciq-q3', st.iciq.q3, q[2].min, q[2].max, ['0 = nada', '10 = muchísimo'])}</fieldset>
      <fieldset class="pregunta"><legend>${cat.iciq.situaciones.texto}</legend>
        ${cat.iciq.situaciones.opciones.map((o) => html`<label class="casilla"><input type="checkbox" name="iciq:sit" value="${o}" ${st.iciq.situaciones.includes(o) ? 'checked' : ''}><span>${o}</span></label>`)}
      </fieldset>`;
  };

  const bloqueEva = () => html`<fieldset class="pregunta"><legend><label for="eva">En general, ¿cuánto dolor pélvico sientes? (0 = ninguno, 10 = el peor imaginable)</label></legend>
    ${deslizador('eva', st.eva, 0, 10, ['0 = sin dolor', '10 = máximo'])}</fieldset>`;

  const bloqueSintomas = () => {
    const cs = cat.cuestionarioSintomas;
    const ctxSiNo = cs.contexto.filter((c) => c.tipo === 'si-no');
    const ctxTexto = cs.contexto.find((c) => c.tipo === 'texto');
    return html`
      <p>¿Con qué frecuencia te pasa cada cosa?</p>
      ${cs.preguntas.map((p) => html`<fieldset class="pregunta" data-req="sint:${p.id}"><legend>${p.texto}</legend><p class="ayuda">${p.ayuda}</p>${opciones(`sint:${p.id}`, cs.escala, st.sint[p.id])}</fieldset>`)}
      <h2 class="seccion-titulo">Tu contexto</h2>
      ${ctxSiNo.map((c) => preguntaSino(`ctx:${c.id}`, c.texto, st.ctx[c.id]))}
      ${ctxTexto ? html`<div class="campo"><label for="ctxDiagnostico">${ctxTexto.texto}</label><input type="text" id="ctxDiagnostico" maxlength="200" value="${st.ctx.ctxDiagnostico}"></div>` : ''}
      ${bloqueIciq()}
      <h2 class="seccion-titulo">Dolor</h2>
      ${bloqueEva()}`;
  };

  const bloqueFuerza = () => {
    const af = cat.autoevaluacionFuerza;
    const corriendo = crono?.clave === 'E';
    return html`
      <div class="aviso aviso-info"><p>${af.instrucciones}</p></div>
      <fieldset class="pregunta" data-req="fza:P"><legend>1. ${af.P.nombre}: al contraer, ¿qué sientes?</legend>${opciones('fza:P', af.P.escala, st.fuerza.P)}<p class="ayuda">${af.P.nota}</p></fieldset>
      <fieldset class="pregunta"><legend>2. ${af.E.nombre}</legend><p>${af.E.instruccion}</p>
        <div class="tarjeta" style="text-align:center"><p class="texto-suave">Cronómetro de apoyo</p>
          <p class="objetivo-grande" id="crono-E" aria-live="off">${corriendo ? '0' : st.fuerza.E} s</p>
          <button type="button" class="btn ${corriendo ? 'btn-secundario' : 'btn-primario'} btn-grande" data-crono="E">${corriendo ? 'Ya bajó la fuerza' : 'Empezar a contar'}</button></div>
        <p><strong>Segundos que sostuviste (0 a ${af.E.max}):</strong></p>${contador('E', st.fuerza.E, af.E.max)}</fieldset>
      <fieldset class="pregunta"><legend>3. ${af.R.nombre}</legend><p>${af.R.instruccion}</p>
        <button type="button" class="btn btn-secundario btn-grande" data-mas="R" data-max="${af.R.max}">Toca en cada repetición (+1)</button>
        <p><strong>Repeticiones logradas (0 a ${af.R.max}):</strong></p>${contador('R', st.fuerza.R, af.R.max)}</fieldset>
      <fieldset class="pregunta"><legend>4. ${af.F.nombre}</legend><p>${af.F.instruccion}</p>
        <button type="button" class="btn btn-secundario btn-grande" data-mas="F" data-max="${af.F.max}">Toca en cada rápida (+1)</button>
        <p><strong>Rápidas logradas (0 a ${af.F.max}):</strong></p>${contador('F', st.fuerza.F, af.F.max)}</fieldset>`;
  };

  const bloqueRevisionSeguridad = (ev) => html`
    <h2>Resultado del cuestionario de seguridad</h2>
    ${ev.contraindicacionEST ? html`<div class="aviso aviso-peligro" role="alert"><h3>Consulta con tu profesional antes de usar el electroestimulador</h3><p>${s.mensajes.contraindicacion}</p>
      <ul>${ev.contraindicaciones.map((c) => html`<li><strong>${c.pregunta}</strong> ${c.motivo}</li>`)}</ul></div>` : ''}
    ${ev.banderasRojas.length ? html`<div class="aviso aviso-peligro" role="alert"><h3>Bandera roja: consulta médica antes de continuar</h3><p>${s.mensajes.banderaRoja}</p>
      <ul>${ev.banderasRojas.map((b) => html`<li><strong>${b.pregunta}</strong> ${b.mensaje}</li>`)}</ul></div>` : ''}
    ${ev.precauciones.length ? html`<div class="aviso aviso-alerta"><h3>Precauciones</h3><ul>${ev.precauciones.map((p) => html`<li>${p.mensaje}</li>`)}</ul></div>` : ''}
    ${!ev.contraindicacionEST && !ev.banderasRojas.length && !ev.precauciones.length ? html`<div class="aviso aviso-exito"><p>No marcaste contraindicaciones ni señales de alarma. Podrás usar el electroestimulador siguiendo la lista de verificación de cada sesión.</p></div>` : ''}
    <p class="texto-suave">Este cuestionario vale ${s.vigenciaDias} días; luego te lo volveremos a pedir.</p>`;

  // --- Pintar ----------------------------------------------------------------------------------
  function pintar() {
    if (st.fin) {
      montar(raiz, st.fin);
      $('[data-ir]', raiz)?.addEventListener('click', (e) => navegar(e.currentTarget.dataset.ir));
      $('h1', raiz)?.focus();
      return;
    }
    const paso = pasos[st.i];
    const total = pasos.length;
    let cuerpo;
    if (st.revision) cuerpo = bloqueRevisionSeguridad(st.evSeg);
    else if (paso === 'seguridad') cuerpo = bloqueSeguridad();
    else if (paso === 'sintomas') cuerpo = bloqueSintomas();
    else if (paso === 'fuerza') cuerpo = bloqueFuerza();
    else if (paso === 'iciq') cuerpo = bloqueIciq();
    else cuerpo = bloqueEva();
    const nombres = { seguridad: 'Seguridad', sintomas: 'Síntomas', fuerza: 'Fuerza', iciq: 'Síntomas', eva: 'Dolor' };
    const ultimo = st.i === total - 1 && !(paso === 'seguridad' && !st.revision && tipo === 'seguridad');
    const textoSig = st.revision ? (tipo === 'seguridad' ? 'Guardar' : 'Continuar')
      : ultimo ? (tipo === 'inicial' ? 'Ver mi resultado' : 'Guardar') : 'Siguiente';
    montar(raiz, html`
      <div class="encabezado-vista">
        <h1 tabindex="-1">${TITULOS[tipo]}</h1>
        ${total > 1 ? html`<div class="pasos-barra" aria-hidden="true">${pasos.map((_, k) => html`<span class="${k <= st.i ? 'hecho' : ''}"></span>`)}</div>
          <p class="pasos-texto">Paso ${st.i + 1} de ${total}: ${nombres[paso]}</p>` : ''}
        ${tipo === 'inicial' && plan && st.i === 0 && !st.revision ? html`<div class="aviso aviso-alerta"><p>Ya tienes un plan. Al terminar esta evaluación se creará un plan nuevo (tus sesiones anteriores se conservan en el historial).</p></div>` : ''}
      </div>
      <form novalidate>${cuerpo}
        <p class="aviso aviso-peligro" id="error-form" role="alert" hidden></p>
        <div class="acciones-pie">
          <button type="submit" class="btn btn-primario btn-grande">${textoSig}</button>
          ${st.i > 0 || st.revision ? html`<button type="button" class="btn btn-secundario" data-atras>Atrás</button>` : ''}
        </div>
      </form>`);
    $('h1', raiz).focus();
  }

  // --- Lectura de respuestas (delegación) ------------------------------------------------------
  raiz.addEventListener('change', (ev) => {
    const t = ev.target;
    const [grupo, id] = String(t.name ?? '').split(':');
    if (grupo === 'seg') st.seg[id] = t.value === 'si';
    else if (grupo === 'sint') st.sint[id] = Number(t.value);
    else if (grupo === 'ctx') st.ctx[id] = t.value === 'si';
    else if (grupo === 'iciq' && id === 'sit') {
      st.iciq.situaciones = $$('input[name="iciq:sit"]:checked', raiz).map((x) => x.value);
    } else if (grupo === 'iciq') st.iciq[id] = Number(t.value);
    else if (grupo === 'fza') st.fuerza[id] = Number(t.value);
    t.closest('.pregunta')?.classList.remove('falta');
  });
  raiz.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.id === 'iciq-q3') { st.iciq.q3 = Number(t.value); $('#iciq-q3-out', raiz).textContent = t.value; }
    if (t.id === 'eva') { st.eva = Number(t.value); $('#eva-out', raiz).textContent = t.value; }
    if (t.id === 'ctxDiagnostico') st.ctx.ctxDiagnostico = t.value;
  });
  raiz.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.mas || b.dataset.menos) {
      const k = b.dataset.mas ?? b.dataset.menos;
      const max = Number(b.dataset.max ?? 10);
      st.fuerza[k] = Math.max(0, Math.min(max, st.fuerza[k] + (b.dataset.mas ? 1 : -1)));
      const out = $(`#out-${k}`, raiz);
      if (out) out.textContent = st.fuerza[k];
    } else if (b.dataset.crono) {
      if (crono) {
        const seg = Math.min(10, Math.floor((performance.now() - crono.inicio) / 1000));
        pararCrono();
        st.fuerza.E = seg;
        b.textContent = 'Empezar a contar';
        b.className = 'btn btn-primario btn-grande';
        $('#crono-E', raiz).textContent = `${seg} s`;
        $('#out-E', raiz).textContent = seg;
      } else {
        const inicio = performance.now();
        const id = setInterval(() => {
          const sg = Math.floor((performance.now() - inicio) / 1000);
          const el = $('#crono-E', raiz);
          if (el) el.textContent = `${sg} s`;
          if (sg >= 15) b.click();
        }, 200);
        crono = { clave: 'E', inicio, id };
        b.textContent = 'Ya bajó la fuerza';
        b.className = 'btn btn-secundario btn-grande';
      }
    } else if ('atras' in b.dataset) {
      pararCrono();
      if (st.revision) st.revision = false;
      else st.i = Math.max(0, st.i - 1);
      pintar();
    }
  });
  raiz.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    pararCrono();
    const paso = pasos[st.i];
    if (!st.revision) {
      const faltan = $$('[data-req]', raiz).filter((fs) => !fs.querySelector('input:checked'));
      $$('.pregunta.falta', raiz).forEach((x) => x.classList.remove('falta'));
      if (faltan.length) {
        faltan.forEach((fs) => fs.classList.add('falta'));
        const err = $('#error-form', raiz);
        err.hidden = false;
        err.textContent = `Faltan ${faltan.length} respuesta(s). Están marcadas en rojo.`;
        faltan[0].scrollIntoView({ block: 'center' });
        faltan[0].querySelector('input')?.focus({ preventScroll: true });
        return;
      }
    }
    if (paso === 'seguridad' && !st.revision) {
      st.evSeg = evaluarSeguridad(st.seg, cat, hoyISO());
      const hayAlgo = st.evSeg.contraindicacionEST || st.evSeg.banderasRojas.length || st.evSeg.precauciones.length;
      if (hayAlgo || tipo === 'seguridad') {
        st.revision = true;
        pintar();
        window.scrollTo(0, 0);
        return;
      }
    }
    if (st.revision && tipo === 'seguridad') { guardarSeguridad(); return; }
    st.revision = false;
    if (st.i < pasos.length - 1) {
      st.i++;
      pintar();
      window.scrollTo(0, 0);
      return;
    }
    if (tipo === 'inicial') await terminarInicial();
    else if (tipo === 'fuerza') guardarFuerza();
    else if (tipo === 'iciq') guardarIciq();
    else if (tipo === 'eva') guardarEva();
  });

  // --- Guardado --------------------------------------------------------------------------------
  function iciqCompleto() {
    const p = puntajeIciq({ q1: st.iciq.q1, q2: st.iciq.q2, q3: st.iciq.q3 }, cat);
    return { q1: st.iciq.q1, q2: st.iciq.q2, q3: st.iciq.q3, situaciones: [...st.iciq.situaciones], total: p.total, severidad: p.severidad };
  }

  function marcar(tipoEntrada) {
    if (!plan || !semana) return;
    const dia = query.dia ?? diaDeEntrada(plan, semana, tipoEntrada);
    if (dia) marcarEntrada(semana, dia, tipoEntrada);
  }

  function pantallaFin(titulo, contenido) {
    st.fin = html`<section><h1 tabindex="-1">${titulo}</h1>${contenido}
      <button type="button" class="btn btn-primario btn-grande" data-ir="#/hoy">Volver a Hoy</button>
      <p class="aviso-corto">${cat.meta.avisoCorto}</p></section>`;
    pintar();
    window.scrollTo(0, 0);
  }

  async function terminarInicial() {
    if (plan) {
      const ok = await confirmar('Crear un plan nuevo', 'Tu plan actual se reemplazará por uno nuevo basado en esta evaluación.', { si: 'Crear plan nuevo' });
      if (!ok) return;
    }
    const hoy = hoyISO();
    const iciq = iciqCompleto();
    const sintomas = { ...st.sint };
    const contexto = { ctxPostparto: st.ctx.ctxPostparto === true, ctxMenopausia: st.ctx.ctxMenopausia === true, ctxDiagnostico: st.ctx.ctxDiagnostico.trim() };
    const res = clasificar(sintomas, contexto, { total: iciq.total, severidad: iciq.severidad }, cat);
    const niv = nivelInicial(st.fuerza, cat);
    const nuevoPlan = generarPlan({
      perfil: res.perfil, nivel: niv.nivel, seguridad: st.evSeg, equipo: leer('equipo'), fechaInicio: hoy,
      iciqInicial: iciq.total, evaInicial: st.eva,
    }, cat);
    agregarA('evaluaciones', {
      id: nuevoId('eval'), fecha: hoy, semana: 0, tipo: 'inicial',
      seguridad: st.evSeg, sintomas, contexto, iciq, fuerza: { ...st.fuerza }, eva: st.eva,
      resultado: { ...res, nivel: niv.nivel, motivoNivel: niv.motivo },
    });
    guardar('plan', nuevoPlan);
    guardar('cambiosNivel', []);
    guardarAjustes({ ultimaSemanaCerrada: 0 });
    navegar('#/resultado');
  }

  function guardarSeguridad() {
    agregarA('evaluaciones', { id: nuevoId('eval'), fecha: hoyISO(), semana, tipo: 'seguridad', seguridad: st.evSeg });
    let txt = 'Guardamos tu cuestionario de seguridad.';
    if (plan) {
      guardar('plan', regenerarConSeguridad(plan, st.evSeg, cat));
      txt += ' Tu plan se recalculó desde esta semana.';
    }
    pantallaFin('Cuestionario guardado', html`${bloqueRevisionSeguridad(st.evSeg)}<div class="aviso aviso-exito"><p>${txt}</p></div>`);
  }

  function guardarFuerza() {
    const evs = leer('evaluaciones', []);
    const previa = [...evs].reverse().find((e) => e.fuerza);
    agregarA('evaluaciones', { id: nuevoId('eval'), fecha: hoyISO(), semana, tipo: 'reevaluacion', fuerza: { ...st.fuerza } });
    marcar(ENTRADA_DE.fuerza);
    const metas = cat.nivel(plan?.nivelActual ?? 0)?.metas ?? {};
    const f = st.fuerza;
    pantallaFin('Re-evaluación guardada', html`<div class="tarjeta">
      <table class="tabla"><thead><tr><th scope="col"></th><th scope="col">Antes</th><th scope="col">Hoy</th><th scope="col">Meta</th></tr></thead><tbody>
        <tr><th scope="row">Fuerza (P)</th><td>${previa?.fuerza.P ?? '—'}</td><td>${f.P}</td><td>${metas.P ?? '—'}</td></tr>
        <tr><th scope="row">Sostén (E)</th><td>${previa?.fuerza.E ?? '—'} s</td><td>${f.E} s</td><td>${metas.E != null ? `${metas.E} s` : '—'}</td></tr>
        <tr><th scope="row">Repeticiones (R)</th><td>${previa?.fuerza.R ?? '—'}</td><td>${f.R}</td><td>—</td></tr>
        <tr><th scope="row">Rápidas (F)</th><td>${previa?.fuerza.F ?? '—'}</td><td>${f.F}</td><td>${metas.F ?? '—'}</td></tr>
      </tbody></table></div>
      <p>Al cerrar la semana, PELVIA usará estos datos para decidir si subes de nivel.</p>`);
  }

  function guardarIciq() {
    const iciq = iciqCompleto();
    const evs = leer('evaluaciones', []);
    const inicial = evs.find((e) => e.iciq);
    agregarA('evaluaciones', { id: nuevoId('eval'), fecha: hoyISO(), semana, tipo: 'reevaluacion', iciq });
    marcar(ENTRADA_DE.iciq);
    const sev = cat.iciq.severidad.find((x) => x.id === iciq.severidad)?.nombre ?? iciq.severidad;
    let comp = html``;
    if (inicial) {
      const c = compararIciq(inicial.iciq, iciq, cat);
      if (semana >= 12 && !c.mejoraSuficiente) comp = html`<div class="aviso aviso-peligro" role="alert"><p><strong>${c.mensaje}</strong></p></div>`;
      else if (c.mejoraSuficiente) comp = html`<div class="aviso aviso-exito"><p>${c.mensaje}</p></div>`;
      else comp = html`<div class="aviso aviso-info"><p>Tu ICIQ pasó de ${inicial.iciq.total} a ${iciq.total}. Sigue con tu plan: la mejora suele notarse entre las semanas 8 y 12.</p></div>`;
    }
    pantallaFin('Cuestionario guardado', html`<div class="tarjeta"><p class="objetivo-grande">${iciq.total} / 21</p><p>Severidad: <strong>${sev}</strong></p></div>${comp}`);
  }

  function guardarEva() {
    const evs = leer('evaluaciones', []);
    const previa = [...evs].reverse().find((e) => e.eva != null);
    agregarA('evaluaciones', { id: nuevoId('eval'), fecha: hoyISO(), semana, tipo: 'reevaluacion', eva: st.eva });
    marcar(ENTRADA_DE.eva);
    pantallaFin('Registro de dolor guardado', html`<div class="tarjeta"><p class="objetivo-grande">${st.eva} / 10</p>
      ${previa ? html`<p>La vez anterior: ${previa.eva} / 10.</p>` : ''}</div>
      ${st.eva >= 7 ? html`<div class="aviso aviso-peligro"><p>Tu dolor es alto. Si continúa, consulta con tu profesional.</p></div>` : ''}`);
  }

  pintar();
  return () => pararCrono();
}
