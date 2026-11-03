// Arranque de PELVIA: catálogo → migración → PIN → cierre de semanas → router (docs/diseno.md §3, §4.3).

import { cargarCatalogo } from './engine/catalogo.js';
import { cerrarSemana } from './engine/progresion.js';
import { regenerarSemanaActual, planMantenimiento } from './engine/planificador.js';
import { migrar, leer, guardar, ajustes, guardarAjustes, restablecer, esDemo } from './store/repo.js';
import { hoyISO, semanaDelPlan, fechaDePlan } from './util/fechas.js';
import { html, montar, $, $$ } from './util/dom.js';
import { prepararAudio } from './util/audio.js';
import { iniciarRouter, navegar } from './router.js';
import { accesoPermitido, tieneConsentimiento } from './ui/vistas/onboarding.js';
import { montarPin } from './ui/componentes/pin.js';
import { confirmar } from './ui/componentes/modal.js';

import * as onboarding from './ui/vistas/onboarding.js';
import * as evaluacion from './ui/vistas/evaluacion.js';
import * as resultado from './ui/vistas/resultado.js';
import * as hoy from './ui/vistas/hoy.js';
import * as sesion from './ui/vistas/sesion.js';
import * as biblioteca from './ui/vistas/biblioteca.js';
import * as progreso from './ui/vistas/progreso.js';
import * as vesical from './ui/vistas/vesical.js';
import * as equipo from './ui/vistas/equipo.js';
import * as aprende from './ui/vistas/aprende.js';
import * as ajustesVista from './ui/vistas/ajustes.js';
import * as acerca from './ui/vistas/acerca.js';
import * as informe from './ui/vistas/informe.js';

const VISTAS = {
  onboarding, evaluacion, resultado, hoy, sesion, biblioteca, progreso, vesical, equipo, aprende,
  ajustes: ajustesVista, acerca, informe,
};
/** Rutas a pantalla completa, sin barra de navegación. */
const SIN_NAV = new Set(['sesion', 'informe', 'onboarding']);

/** Estado compartido con las vistas. */
const app = {
  cat: null,
  /** Avisos que "Hoy" muestra en un modal al abrirse (cambio de nivel, fin de programa…). */
  avisosPendientes: [],
  refrescarCabecera,
  restablecerTodo,
};

let limpiarVista = null;

function main() {
  return document.getElementById('vista');
}

function refrescarCabecera() {
  const demo = esDemo();
  $('#banda-demo').hidden = !demo;
  document.body.classList.toggle('modo-demo', demo);
}

async function restablecerTodo({ preguntar = true } = {}) {
  if (preguntar) {
    const ok = await confirmar('Restablecer', 'Se borrarán todos los datos guardados en este celular (evaluaciones, plan, sesiones). No se puede deshacer.', { si: 'Sí, borrar todo', peligro: true });
    if (!ok) return false;
  }
  restablecer();
  migrar();
  app.avisosPendientes = [];
  refrescarCabecera();
  navegar('#/onboarding', { reemplazar: true });
  return true;
}

function pantallaError(titulo, detalle, conReintento = true) {
  document.querySelector('.nav-inferior').hidden = true;
  montar(main(), html`<section class="pantalla-error" role="alert">
    <h1>${titulo}</h1><p>${detalle}</p>
    ${conReintento ? html`<button type="button" class="btn btn-primario btn-grande" id="reintentar">Reintentar</button>` : ''}
  </section>`);
  $('#reintentar')?.addEventListener('click', () => location.reload());
}

// --- Cierre automático de semanas (RF-11, RF-14) -----------------------------------------------
function ultimoValor(evaluaciones, parte) {
  const l = evaluaciones.filter((e) => e[parte] != null);
  if (!l.length) return null;
  const v = l[l.length - 1][parte];
  return typeof v === 'number' ? v : v.total ?? null;
}

export function cerrarSemanasPendientes(cat, hoyIso = hoyISO()) {
  let plan = leer('plan');
  if (!plan || plan.estado === 'finalizado') return;
  const semHoy = semanaDelPlan(plan.fechaInicio, hoyIso);
  const aj = ajustes();
  const ultima = aj.ultimaSemanaCerrada ?? 0;
  const sesiones = leer('sesiones', []);
  const evaluaciones = leer('evaluaciones', []);
  const cambiosNivel = leer('cambiosNivel', []);
  const hasta = Math.min(semHoy - 1, plan.duracionSemanas);
  const desde = Math.max(ultima + 1, hasta - 11); // máximo 12 semanas por apertura
  let cerradas = 0;
  let ultimoCierre = null;
  const cambios = [];
  for (let w = desde; w <= hasta; w++) {
    plan.semanaActual = w + 1;
    const c = cerrarSemana({ plan, sesiones, evaluaciones, cambiosNivel, semana: w }, cat);
    if (c.accion !== 'mantener') {
      const cambio = { fecha: fechaDePlan(plan.fechaInicio, w, 'D'), semana: w, nivelDesde: c.nivelDesde, nivelHasta: c.nivelHasta, motivo: c.motivo };
      cambiosNivel.push(cambio);
      cambios.push(cambio);
      if (w + 1 <= plan.duracionSemanas) plan = regenerarSemanaActual(plan, c.nivelHasta, cat);
      else plan.nivelActual = c.nivelHasta;
    }
    ultimoCierre = c;
    cerradas++;
  }
  if (cerradas) {
    plan.semanaActual = Math.max(1, Math.min(semHoy, plan.duracionSemanas));
    guardar('cambiosNivel', cambiosNivel);
    guardarAjustes({ ultimaSemanaCerrada: hasta });
    const lineas = cambios.length ? cambios.map((c) => `Semana ${c.semana}: ${c.motivo}`) : [ultimoCierre.motivo];
    if (ultimoCierre.mejoraInsuficiente) lineas.push('Mejora insuficiente: te recomendamos valoración por un profesional de suelo pélvico.');
    else if (ultimoCierre.sugerirProfesional) lineas.push('Si el dolor continúa, consulta con tu profesional.');
    app.avisosPendientes.push({ titulo: cambios.length ? 'Cambio de nivel' : 'Resumen de tu semana', lineas });
  } else if (plan.semanaActual !== Math.max(1, Math.min(semHoy, plan.duracionSemanas))) {
    plan.semanaActual = Math.max(1, Math.min(semHoy, plan.duracionSemanas));
  }

  // Fin del programa principal (semana 13+): mantenimiento o derivación.
  if (plan.fase === 'principal' && semHoy > plan.duracionSemanas && (ajustes().ultimaSemanaCerrada ?? 0) >= plan.duracionSemanas) {
    const r = planMantenimiento(plan, { iciqFinal: ultimoValor(evaluaciones, 'iciq'), evaFinal: ultimoValor(evaluaciones, 'eva') }, cat);
    if (r.decision === 'mantenimiento') {
      plan = r.plan;
      plan.semanaActual = Math.max(13, Math.min(semHoy, plan.duracionSemanas));
    } else {
      plan = { ...plan, estado: 'finalizado', decisionFinal: r.decision, mensajeFinal: r.motivo };
    }
    app.avisosPendientes.push({ titulo: 'Terminaste las 12 semanas', lineas: [r.motivo] });
  }
  guardar('plan', plan);
}

// --- Service worker -----------------------------------------------------------------------------
function registrarSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const barra = $('#barra-actualizacion');
  let esperando = null;
  const mostrar = (w) => {
    esperando = w;
    barra.hidden = false;
  };
  $('#btn-actualizar').addEventListener('click', () => {
    if (esperando) esperando.postMessage({ tipo: 'SKIP_WAITING' });
  });
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return;
    recargando = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) mostrar(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      if (!nuevo) return;
      nuevo.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) mostrar(reg.waiting ?? nuevo);
      });
    });
  }).catch(() => { /* sin SW: la app funciona igual en línea */ });
}

// --- Router -------------------------------------------------------------------------------------
async function renderRuta(dest) {
  if (limpiarVista) {
    try { limpiarVista(); } catch { /* nada */ }
    limpiarVista = null;
  }
  const perfil = leer('perfil');
  let nombre = dest.ruta;
  if (!nombre) {
    navegar(tieneConsentimiento(perfil) ? '#/hoy' : '#/onboarding', { reemplazar: true });
    return;
  }
  if (!accesoPermitido(perfil, nombre)) {
    navegar('#/onboarding', { reemplazar: true });
    return;
  }
  const vista = VISTAS[nombre];
  refrescarCabecera();
  const sinNav = !vista || SIN_NAV.has(nombre) || !tieneConsentimiento(perfil);
  document.body.classList.toggle('sin-nav', sinNav);
  document.body.classList.toggle('pantalla-completa', nombre === 'sesion');
  document.body.dataset.ruta = nombre;
  const nav = document.querySelector('.nav-inferior');
  nav.hidden = sinNav;
  $$('a', nav).forEach((a) => {
    const activa = a.dataset.ruta === nombre || (nombre === 'equipo' && a.dataset.ruta === 'ajustes')
      || (nombre === 'vesical' && a.dataset.ruta === 'hoy') || (nombre === 'acerca' && a.dataset.ruta === 'ajustes');
    if (activa) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const m = main();
  if (!vista) {
    montar(m, html`<section class="pantalla-error"><h1>Página no encontrada</h1><a class="btn btn-primario" href="#/hoy">Ir a Hoy</a></section>`);
    return;
  }
  m.replaceChildren();
  window.scrollTo(0, 0);
  try {
    const r = await vista.render({ cat: app.cat, main: m, params: dest.params, query: dest.query, ruta: nombre, app });
    if (typeof r === 'function') limpiarVista = r;
    const titulo = m.querySelector('h1');
    document.title = titulo ? `${titulo.textContent.trim()} · PELVIA` : 'PELVIA';
    m.focus({ preventScroll: true });
  } catch (e) {
    console.warn('Error al mostrar la pantalla', e);
    montar(m, html`<section class="pantalla-error" role="alert"><h1>Algo salió mal</h1><p>${e?.message ?? 'Error inesperado.'}</p><a class="btn btn-primario" href="#/hoy">Ir a Hoy</a></section>`);
  }
}

function pedirPin() {
  return new Promise((resolver) => {
    document.body.classList.add('sin-nav');
    document.querySelector('.nav-inferior').hidden = true;
    montarPin(main(), {
      modo: 'verificar',
      alExito: () => resolver(),
      alRestablecer: async () => {
        const ok = await confirmar('Restablecer datos', 'Se borrarán todos tus datos de este celular, incluido el PIN. No se puede deshacer.', { si: 'Sí, borrar todo', peligro: true });
        if (ok) {
          restablecer();
          migrar();
          resolver();
        }
      },
    });
  });
}

async function arrancar() {
  registrarSW();
  document.addEventListener('pointerdown', prepararAudio, { once: true });
  $('#salir-demo').addEventListener('click', () => restablecerTodo());
  try {
    app.cat = await cargarCatalogo('content/protocolos.json');
  } catch (e) {
    pantallaError('No se pudo abrir PELVIA', 'No pudimos cargar el contenido de la app. Revisa tu conexión la primera vez que la abres e inténtalo otra vez.');
    console.warn(e);
    return;
  }
  try {
    migrar();
  } catch (e) {
    pantallaError('Datos de una versión más nueva', e.message, false);
    return;
  }
  refrescarCabecera();
  if (ajustes().pinHash) await pedirPin();
  try {
    cerrarSemanasPendientes(app.cat);
  } catch (e) {
    console.warn('No se pudo cerrar la semana', e);
  }
  iniciarRouter(renderRuta);
}

arrancar();
