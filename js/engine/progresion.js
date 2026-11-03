// Progresión / regresión de nivel al cerrar cada semana (RF-11) y re-evaluaciones (RF-14). docs/diseno.md §6.5.

import { REEVAL } from './planificador.js';

const NO_SESION = new Set(Object.values(REEVAL));

function ordenarPorFecha(lista) {
  return [...lista].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

/** Entradas planificadas de una semana que cuentan para la adherencia (sin re-evaluaciones). */
export function entradasPlanificadas(plan, semana) {
  const s = plan?.semanas?.find((x) => x.numero === semana);
  if (!s) return [];
  return Object.entries(s.dias).flatMap(([dia, l]) => l.filter((e) => !NO_SESION.has(e.tipo)).map((e) => ({ ...e, dia })));
}

/**
 * Fracción hechas / planificadas de una semana. Una sesión cuenta si está completada, es de esa semana
 * y su tipo figura en el plan de esa semana (cada sesión cubre una sola entrada).
 * @returns {number} 0..1 (0 si no hay nada planificado)
 */
export function adherencia(plan, sesiones, semana) {
  const { hechas, planificadas } = conteoSemana(plan, sesiones, semana);
  return planificadas === 0 ? 0 : hechas / planificadas;
}

export function conteoSemana(plan, sesiones, semana) {
  const plan_ = entradasPlanificadas(plan, semana);
  const disponibles = new Map();
  for (const s of sesiones ?? []) {
    if (s.completada && s.semana === semana) disponibles.set(s.tipoSesionId, (disponibles.get(s.tipoSesionId) ?? 0) + 1);
  }
  let hechas = 0;
  for (const e of plan_) {
    const n = disponibles.get(e.tipo) ?? 0;
    if (n > 0) {
      hechas++;
      disponibles.set(e.tipo, n - 1);
    }
  }
  return { hechas, planificadas: plan_.length };
}

/** Totales del ICIQ: acepta número u objeto {total}. */
function totalIciq(x) {
  if (x == null) return null;
  return typeof x === 'number' ? x : x.total ?? null;
}

/**
 * Comparación del ICIQ (RF-14): mejora suficiente si baja ≥ mejoraMinimaPuntos (2).
 * @returns {{delta:number, mejoraSuficiente:boolean, mensaje:string}}  delta = actual − inicial (negativo = mejora)
 */
export function compararIciq(inicial, actual, catalogo) {
  const a = totalIciq(inicial);
  const b = totalIciq(actual);
  if (a == null || b == null) throw new RangeError('compararIciq necesita dos puntajes ICIQ.');
  const min = catalogo.iciq.mejoraMinimaPuntos;
  const delta = b - a;
  const mejoraSuficiente = a - b >= min || (a === 0 && b === 0);
  return {
    delta,
    mejoraSuficiente,
    mensaje: mejoraSuficiente
      ? `Tu ICIQ bajó ${a - b} puntos (de ${a} a ${b}).`
      : 'Mejora insuficiente: te recomendamos valoración por un profesional de suelo pélvico.',
  };
}

/** Semanas consecutivas (terminando en `hasta`) en las que el plan estuvo en `nivel`. */
export function semanasEnNivel(plan, nivel, hasta, cambiosNivel = []) {
  let n = 0;
  for (let w = hasta; w >= 1; w--) {
    const s = plan.semanas.find((x) => x.numero === w);
    if (!s || s.nivel !== nivel) break;
    n++;
  }
  // Si hubo un cambio de nivel registrado dentro de ese tramo, solo cuenta desde el cambio.
  const ultimo = [...cambiosNivel].reverse().find((c) => c.semana != null && c.semana <= hasta);
  if (ultimo && ultimo.nivelHasta === nivel) n = Math.min(n, hasta - ultimo.semana);
  return n;
}

/** Evaluaciones ordenadas que incluyen la parte pedida ('fuerza' | 'iciq' | 'eva' | 'diario'). */
export function evaluacionesCon(evaluaciones, parte) {
  return ordenarPorFecha((evaluaciones ?? []).filter((e) => e[parte] != null));
}

/** Re-evaluaciones que tocan hasta la semana `hastaSemana` y todavía no se hicieron. */
export function reevaluacionesPendientes(plan, evaluaciones, hastaSemana) {
  const pendientes = [];
  const mapa = { fuerza: 'fuerza', iciq: 'iciq', dolorEVA: 'eva', diario: 'diario' };
  for (const [clave, parte] of Object.entries(mapa)) {
    for (const w of plan.reevaluaciones?.[clave] ?? []) {
      if (w < 1 || w > hastaSemana) continue;
      const hecha = (evaluaciones ?? []).some((e) => e[parte] != null && e.semana === w);
      if (!hecha) pendientes.push({ tipo: parte, semana: w });
    }
  }
  return pendientes.sort((a, b) => a.semana - b.semana);
}

function plantilla(txt, datos) {
  return txt.replace(/\{(\w+)\}/g, (_, k) => datos[k] ?? '');
}

/**
 * Cierre de la semana `semana` (por defecto la anterior a la actual del plan).
 * @param {{plan:object, sesiones:object[], evaluaciones:object[], cambiosNivel?:object[], semana?:number}} estado
 * @returns {{accion:'subir'|'bajar'|'mantener', nivelDesde:number, nivelHasta:number, motivo:string,
 *            reglasAplicadas:string[], reevaluacionPendiente:object[], mejoraInsuficiente:boolean, semana:number,
 *            sugerirProfesional:boolean}}
 */
export function cerrarSemana({ plan, sesiones = [], evaluaciones = [], cambiosNivel = [], semana, hoy } = {}, catalogo) {
  if (!plan) throw new Error('cerrarSemana necesita un plan.');
  const rp = catalogo.reglasProgresion;
  const w = semana ?? Math.max(1, (plan.semanaActual ?? 1) - 1);
  const nivel = plan.semanas.find((s) => s.numero === w)?.nivel ?? plan.nivelActual;
  const nivelMeta = catalogo.nivel(nivel);
  const reglas = [];
  const motivosMantener = [];

  const completadas = ordenarPorFecha(sesiones.filter((s) => s.completada));
  const deLaSemana = completadas.filter((s) => s.semana === w);

  // --- BAJAR -------------------------------------------------------------
  let dolorConsecutivo = false;
  let racha = 0;
  for (const s of deLaSemana) {
    racha = s.dolor === true ? racha + 1 : 0;
    if (racha >= rp.bajar.dolorConsecutivo) dolorConsecutivo = true;
  }
  const repsBajas = deLaSemana.filter((s) => typeof s.repsLogradas === 'number' && s.repsPlanificadas > 0
    && s.repsLogradas / s.repsPlanificadas < rp.bajar.fraccionRepsMinima).length;
  const bajarPorReps = repsBajas >= rp.bajar.sesionesConRepsBajas;
  const esMantenimiento = nivel === catalogo.reglasPlanificador.mantenimientoNivel;

  let accion = 'mantener';
  let nivelHasta = nivel;
  let sugerirProfesional = false;

  if (!esMantenimiento && (dolorConsecutivo || bajarPorReps)) {
    sugerirProfesional = dolorConsecutivo;
    if (dolorConsecutivo) reglas.push(`bajar.dolorConsecutivo: dolor en ${rp.bajar.dolorConsecutivo} sesiones seguidas`);
    if (bajarPorReps) reglas.push(`bajar.reps: ${repsBajas} sesiones con < ${rp.bajar.fraccionRepsMinima * 100} % de repeticiones`);
    if (nivel > 0) {
      accion = 'bajar';
      nivelHasta = nivel - 1;
    } else {
      motivosMantener.push('ya estás en el nivel más bajo; si hay dolor, consulta con tu profesional');
    }
  } else if (!esMantenimiento) {
    // --- SUBIR: todas las condiciones -------------------------------------
    const enNivel = semanasEnNivel(plan, nivel, w, cambiosNivel);
    const minSem = Math.max(rp.minSemanasNivel, nivelMeta?.minSemanas ?? 0);
    const okSemanas = enNivel >= minSem;
    if (!okSemanas) motivosMantener.push(`llevas ${enNivel} semana(s) en este nivel (mínimo ${minSem})`);

    let hechas = 0;
    let planificadas = 0;
    for (let k = w - rp.semanasAdherencia + 1; k <= w; k++) {
      const c = conteoSemana(plan, sesiones, k);
      hechas += c.hechas;
      planificadas += c.planificadas;
    }
    const adh = planificadas ? hechas / planificadas : 0;
    const okAdh = adh >= rp.adherenciaMin;
    if (!okAdh) motivosMantener.push(`adherencia ${Math.round(adh * 100)} % (necesitas ${rp.adherenciaMin * 100} %)`);

    const metas = nivelMeta?.metas ?? {};
    const autoevs = evaluacionesCon(evaluaciones, 'fuerza').slice(-rp.autoevaluacionesConsecutivas);
    const okMetas = autoevs.length >= rp.autoevaluacionesConsecutivas
      && autoevs.every((e) => (metas.E == null || e.fuerza.E >= metas.E) && (metas.F == null || e.fuerza.F >= metas.F));
    if (!okMetas) {
      motivosMantener.push(`aún no alcanzas E ≥ ${metas.E ?? '—'} s y F ≥ ${metas.F ?? '—'} en tus últimas ${rp.autoevaluacionesConsecutivas} autoevaluaciones`);
    }

    const ultimas = completadas.slice(-rp.sesionesSinDolor);
    const okDolor = ultimas.length >= rp.sesionesSinDolor && ultimas.every((s) => s.dolor !== true);
    if (!okDolor) motivosMantener.push(`necesitas ${rp.sesionesSinDolor} sesiones seguidas sin dolor`);

    const okTope = nivel < rp.nivelMaximo;
    if (!okTope) motivosMantener.push('ya estás en el nivel más alto del programa');

    if (okSemanas && okAdh && okMetas && okDolor && okTope) {
      accion = 'subir';
      nivelHasta = nivel + 1;
      reglas.push(`subir: ${enNivel} semanas en nivel, adherencia ${Math.round(adh * 100)} %, metas E/F alcanzadas, sin dolor`);
    }
  } else {
    motivosMantener.push('programa de mantenimiento');
  }

  if (accion === 'mantener') reglas.push(`mantener: ${motivosMantener.join('; ') || 'sin cambios'}`);
  const motivo = accion === 'mantener'
    ? plantilla(rp.mensajes.mantener, { nivel, motivo: motivosMantener.join('; ') || 'sin cambios' })
    : plantilla(rp.mensajes[accion], { nivel: nivelHasta });

  // --- Re-evaluaciones y mejora a las 12 semanas (RF-14) ------------------
  const reevaluacionPendiente = reevaluacionesPendientes(plan, evaluaciones, w + 1);
  let mejoraInsuficiente = false;
  if (w >= 12 && plan.fase !== 'mantenimiento') {
    const iciqs = evaluacionesCon(evaluaciones, 'iciq');
    if (iciqs.length >= 2) {
      mejoraInsuficiente = !compararIciq(iciqs[0].iciq, iciqs[iciqs.length - 1].iciq, catalogo).mejoraSuficiente;
      if (mejoraInsuficiente) {
        reglas.push('RF-14: ICIQ sin bajar ≥ 2 puntos a las 12 semanas');
        sugerirProfesional = true;
      }
    }
  }

  return {
    semana: w,
    accion,
    nivelDesde: nivel,
    nivelHasta,
    motivo,
    reglasAplicadas: reglas,
    reevaluacionPendiente,
    mejoraInsuficiente,
    sugerirProfesional,
  };
}
