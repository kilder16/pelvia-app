// Repositorio sobre localStorage con esquema versionado (ADR-0003; docs/diseno.md §5).
// El almacén es inyectable para poder probarlo con node --test sin navegador.

import { evaluarSeguridad } from '../engine/seguridad.js';
import { clasificar, puntajeIciq } from '../engine/clasificador.js';
import { nivelInicial } from '../engine/nivel.js';
import { generarPlan, regenerarSemanaActual } from '../engine/planificador.js';
import { construirLineaTiempo } from '../engine/sesion.js';
import { cerrarSemana } from '../engine/progresion.js';
import { DIAS, lunesDe, sumarDias, fechaDePlan, hoyISO, semanaDelPlan } from '../util/fechas.js';

export const APP_VERSION = '0.1.1';
export const ESQUEMA = 1;
export const PREFIJO = 'pelvia.';
export const CLAVES = ['meta', 'perfil', 'equipo', 'evaluaciones', 'plan', 'sesiones', 'cambiosNivel', 'diario', 'ajustes'];

export const AJUSTES_POR_DEFECTO = Object.freeze({
  vibracion: true,
  sonido: true,
  pinHash: null,
  ultimoRespaldo: null,
  ultimaSemanaCerrada: null,
});

/** Almacén en memoria con la interfaz mínima de localStorage. */
export function almacenMemoria() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    clear: () => m.clear(),
  };
}

function almacenPorDefecto() {
  try {
    if (globalThis.localStorage) return globalThis.localStorage;
  } catch { /* modo privado o bloqueado */ }
  return almacenMemoria();
}

let almacen = null;
const almacenActual = () => (almacen ??= almacenPorDefecto());

/** Permite inyectar el almacén (tests) o volver al localStorage (null). */
export function configurarAlmacen(a) {
  almacen = a;
}

const clave = (k) => (k.startsWith(PREFIJO) ? k : PREFIJO + k);

export function leer(k, porDefecto = null) {
  const raw = almacenActual().getItem(clave(k));
  if (raw == null) return porDefecto;
  try {
    return JSON.parse(raw);
  } catch {
    return porDefecto;
  }
}

/** Escritura atómica por clave (JSON completo). */
export function guardar(k, valor) {
  const c = clave(k);
  if (!CLAVES.includes(c.slice(PREFIJO.length))) throw new Error(`Clave desconocida: ${k}`);
  if (valor === undefined || valor === null) almacenActual().removeItem(c);
  else almacenActual().setItem(c, JSON.stringify(valor));
  return valor;
}

/** Todas las claves pelvia.* presentes. */
export function clavesPresentes() {
  const a = almacenActual();
  const out = [];
  for (let i = 0; i < a.length; i++) {
    const k = a.key(i);
    if (k && k.startsWith(PREFIJO)) out.push(k);
  }
  return out;
}

/** Estado completo como objeto plano { perfil, equipo, ... }. */
export function estadoCompleto() {
  return Object.fromEntries(CLAVES.map((k) => [k, leer(k)]));
}

/**
 * Migraciones por versión de esquema. Hoy solo existe el esquema 1: se crea meta si falta.
 * @returns {{desde:number|null, hasta:number}}
 */
export const MIGRACIONES = {
  // 1: (estado) => estado  ← plantilla para la siguiente versión: 2: (e) => ({ ...e, nuevoCampo: ... })
};

export function migrarEstado(estado, desde) {
  let e = { ...estado };
  for (let v = (desde ?? 0) + 1; v <= ESQUEMA; v++) {
    if (MIGRACIONES[v]) e = MIGRACIONES[v](e);
  }
  return e;
}

export function migrar() {
  const meta = leer('meta');
  const desde = meta?.esquema ?? null;
  if (desde != null && desde > ESQUEMA) {
    throw new Error(`Los datos son de una versión más nueva de PELVIA (esquema ${desde}). Actualiza la app.`);
  }
  if (desde !== ESQUEMA) {
    const migrado = migrarEstado(estadoCompleto(), desde ?? 0);
    for (const k of CLAVES) if (k !== 'meta' && migrado[k] != null) guardar(k, migrado[k]);
  }
  guardar('meta', { ...(meta ?? {}), esquema: ESQUEMA, app: APP_VERSION });
  if (!leer('ajustes')) guardar('ajustes', { ...AJUSTES_POR_DEFECTO });
  return { desde, hasta: ESQUEMA };
}

/** Borra todas las claves pelvia.* (RF-16 "Restablecer", RF-19 recuperación). */
export function restablecer() {
  for (const k of clavesPresentes()) almacenActual().removeItem(k);
}

// ---------------------------------------------------------------------------------------------
// Operaciones de dominio frecuentes (la UI las usa; siguen siendo datos planos).

export function ajustes() {
  return { ...AJUSTES_POR_DEFECTO, ...(leer('ajustes') ?? {}) };
}

export function guardarAjustes(parcial) {
  return guardar('ajustes', { ...ajustes(), ...parcial });
}

export function agregarA(k, item) {
  const lista = leer(k, []);
  lista.push(item);
  guardar(k, lista);
  return item;
}

export function nuevoId(prefijo) {
  return `${prefijo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Guarda una sesión y marca la entrada del plan como hecha si corresponde. */
export function guardarSesion(sesion) {
  const s = { id: sesion.id ?? nuevoId('ses'), ...sesion };
  agregarA('sesiones', s);
  const plan = leer('plan');
  if (plan && s.completada && s.semana && s.dia) {
    const sem = plan.semanas.find((x) => x.numero === s.semana);
    const ent = sem?.dias?.[s.dia]?.find((e) => e.tipo === s.tipoSesionId && e.estado !== 'hecha');
    if (ent) {
      ent.estado = 'hecha';
      ent.sesionId = s.id;
      guardar('plan', plan);
    }
  }
  return s;
}

/** Marca una entrada no temporizada del plan (re-evaluación, diario, hábitos) como hecha. */
export function marcarEntrada(semana, dia, tipo, estado = 'hecha') {
  const plan = leer('plan');
  const ent = plan?.semanas?.find((x) => x.numero === semana)?.dias?.[dia]?.find((e) => e.tipo === tipo);
  if (!ent) return false;
  ent.estado = estado;
  guardar('plan', plan);
  return true;
}

// ---------------------------------------------------------------------------------------------
// Caso ejemplo (RF-16): se construye ejecutando el motor real con los datos de entrada de casoEjemplo.

/**
 * Carga el perfil DEMO. Las fechas se desplazan para que las 4 semanas de datos terminen la semana
 * anterior a `hoy` (así "Hoy" muestra la semana 5 del plan). Devuelve el estado cargado.
 */
export function cargarDemo(catalogo, hoy = hoyISO()) {
  const ce = catalogo.casoEjemplo;
  const nSem = ce.semanasEjemplo.length;
  const fechaInicio = sumarDias(lunesDe(hoy), -7 * nSem);
  const ei = ce.evaluacionInicial;

  restablecer();
  migrar();

  // 1. Seguridad: todas las preguntas respondidas "no" salvo las marcadas en el caso.
  const marcadas = new Set([...ei.seguridad.contraindicaciones, ...ei.seguridad.precauciones, ...ei.seguridad.banderasRojas]);
  const respuestas = {};
  const s = catalogo.seguridad;
  for (const p of [...s.contraindicacionesAbsolutas, ...s.precauciones, ...s.banderasRojas]) respuestas[p.id] = marcadas.has(p.id);
  const fechaEval = sumarDias(fechaInicio, -1);
  const seguridad = evaluarSeguridad(respuestas, catalogo, fechaEval);

  // 2. Clasificación y nivel con el motor.
  const iciq = puntajeIciq(ei.iciq, catalogo);
  const resultado = clasificar(ei.sintomas, ei.contexto, iciq, catalogo);
  const niv = nivelInicial(ei.fuerza, catalogo);
  const equipo = { ...ce.equipo };

  let plan = generarPlan({
    perfil: resultado.perfil, nivel: niv.nivel, seguridad, equipo, fechaInicio, iciqInicial: iciq.total,
  }, catalogo);

  const perfil = {
    id: 'demo',
    alias: ce.perfil.alias,
    edad: ce.perfil.edad,
    demo: true,
    etiqueta: ce.etiqueta,
    consentimiento: true,
    fechaConsentimiento: fechaEval,
    creado: fechaEval,
  };
  const evaluaciones = [{
    id: 'eval-demo-0',
    fecha: fechaEval,
    semana: 0,
    tipo: 'inicial',
    seguridad,
    sintomas: { ...ei.sintomas },
    contexto: { ...ei.contexto },
    iciq: { ...ei.iciq, total: iciq.total, severidad: iciq.severidad },
    fuerza: { ...ei.fuerza },
    resultado: { ...resultado, nivel: niv.nivel, motivoNivel: niv.motivo },
  }];

  // 3. Sesiones de las semanas de ejemplo: se completan `hechas` de las entradas planificadas.
  const sesiones = [];
  const cambiosNivel = [];
  for (const se of ce.semanasEjemplo) {
    const w = se.semana;
    const semPlan = plan.semanas.find((x) => x.numero === w);
    const entradas = DIAS.flatMap((d) => semPlan.dias[d]
      .filter((e) => !e.tipo.startsWith('REEVAL-') && e.tipo !== 'VES-DIARIO')
      .map((e) => ({ d, e })));
    const aOmitir = new Set();
    // Se omiten las últimas (planificadas − hechas) entradas de la semana (las del fin de semana).
    for (let i = entradas.length - 1; i >= 0 && aOmitir.size < Math.max(0, entradas.length - se.hechas); i--) aOmitir.add(i);
    entradas.forEach(({ d, e }, i) => {
      if (aOmitir.has(i)) return;
      const fecha = fechaDePlan(fechaInicio, w, d);
      const lt = construirLineaTiempo(e.tipo, { nivel: semPlan.nivel, semana: w, series: e.series, equipo }, catalogo);
      const ses = {
        id: `ses-demo-${w}-${d}-${e.tipo}`,
        fecha: `${fecha}T${String(8 + sesiones.length % 10).padStart(2, '0')}:00:00`,
        dia: d,
        semana: w,
        tipoSesionId: e.tipo,
        nivel: semPlan.nivel,
        duracionRealSeg: lt.totalSeg,
        completada: true,
        dolor: se.dolor > 0,
        repsPlanificadas: lt.repsPlanificadas,
        repsLogradas: lt.repsPlanificadas || null,
        demo: true,
      };
      if (catalogo.usaCorriente(e.tipo)) {
        ses.intensidadMA = se.mAPromedio;
        ses.esfuerzo = 6;
      }
      sesiones.push(ses);
      e.estado = 'hecha';
      e.sesionId = ses.id;
    });
    // Re-evaluaciones de la semana de ejemplo.
    if (se.autoevaluacion || se.iciq) {
      const ev = { id: `eval-demo-${w}`, fecha: fechaDePlan(fechaInicio, w, se.iciq ? 'D' : 'L'), semana: w, tipo: 'reevaluacion' };
      if (se.autoevaluacion) ev.fuerza = { ...se.autoevaluacion };
      if (se.iciq) {
        const p = puntajeIciq(se.iciq, catalogo);
        ev.iciq = { ...se.iciq, total: p.total, severidad: p.severidad };
      }
      evaluaciones.push(ev);
      for (const d of DIAS) {
        for (const e of semPlan.dias[d]) {
          if ((e.tipo === 'REEVAL-FUERZA' && ev.fuerza) || (e.tipo === 'REEVAL-ICIQ' && ev.iciq)) e.estado = 'hecha';
        }
      }
    }
    // Cierre de semana con el motor real (no se copia el cambio de nivel del catálogo).
    plan.semanaActual = w + 1;
    const cierre = cerrarSemana({ plan, sesiones, evaluaciones, cambiosNivel, semana: w }, catalogo);
    if (cierre.accion !== 'mantener') {
      cambiosNivel.push({ fecha: fechaDePlan(fechaInicio, w, 'D'), semana: w, nivelDesde: cierre.nivelDesde, nivelHasta: cierre.nivelHasta, motivo: cierre.motivo, demo: true });
      plan = regenerarSemanaActual(plan, cierre.nivelHasta, catalogo);
    }
  }
  plan.semanaActual = Math.max(1, Math.min(semanaDelPlan(fechaInicio, hoy), plan.duracionSemanas));

  guardar('perfil', perfil);
  guardar('equipo', equipo);
  guardar('evaluaciones', evaluaciones);
  guardar('plan', plan);
  guardar('sesiones', sesiones);
  guardar('cambiosNivel', cambiosNivel);
  guardar('diario', []);
  guardarAjustes({ ultimaSemanaCerrada: nSem });
  return estadoCompleto();
}

export function esDemo() {
  return leer('perfil')?.demo === true;
}
