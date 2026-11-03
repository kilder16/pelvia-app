// Generación del plan de 12 semanas (RF-06). Tablas: programas[].semanaTipo + reglasPlanificador. ADR-0004, ADR-0007.
// Orden de aplicación por entrada (docs/diseno.md §6.4 + PROMPT §2.5):
//  1. filtros nivelMin / nivelMax / semanasMax de la entrada
//  2. compatibilidad de nivel del tipo de sesión (ADR-0007)
//  3. reemplazoSinEST (contraindicación o sin equipo)
//  4. reemplazoSinEMG
//  5. reemplazoSinSondaAnal
//  6. reemplazoSinElectrodos
//  7. bandera roja activa (solo PFMT-CONCIENCIA, RELAJ-RESP, HAB-SEMANAL)
//  8. desdeSemana5 (PROG-DOLOR), inserción de VES-DIARIO y re-evaluaciones; sin duplicados por día.

import { DIAS, fechaDePlan } from '../util/fechas.js';

export const REEVAL = {
  fuerza: 'REEVAL-FUERZA',
  iciq: 'REEVAL-ICIQ',
  eva: 'REEVAL-EVA',
};
const PERMITIDOS_BANDERA_ROJA = ['PFMT-CONCIENCIA', 'RELAJ-RESP', 'HAB-SEMANAL'];

/**
 * Capacidades del equipo normalizadas. Sin equipo registrado = sin corriente y sin EMG (criterio conservador).
 * Las sondas se reconocen por prefijo: "anal (opcional)" cuenta como sonda anal disponible solo si la usuaria
 * la marcó en tipoSonda/sondas de "Mi equipo".
 */
export function capacidadesEquipo(equipo, catalogo) {
  const eq = catalogo?.resolverEquipo ? catalogo.resolverEquipo(equipo) : equipo;
  if (!eq || eq.sinEquipo) {
    return { hayEquipo: false, tieneEstimulacion: false, tieneEMG: false, vaginal: false, anal: false, electrodos: false };
  }
  const sondas = [eq.tipoSonda, ...(eq.sondas ?? [])].filter((x) => typeof x === 'string').map((x) => x.toLowerCase());
  const tiene = (pref) => sondas.some((x) => x.startsWith(pref) && !x.includes('opcional'));
  return {
    hayEquipo: true,
    tieneEstimulacion: eq.tieneEstimulacion !== false,
    tieneEMG: eq.tieneEMG === true,
    vaginal: tiene('vaginal'),
    anal: tiene('anal'),
    electrodos: tiene('electrodos'),
  };
}

function idPlan(fechaInicio) {
  return `plan-${fechaInicio}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normaliza una entrada de semanaTipo para un nivel/semana y contexto dado.
 * Devuelve la entrada final (posiblemente reemplazada) o null si se omite.
 */
export function normalizarEntrada(entrada, ctx, catalogo, traza) {
  const { nivel, semana, perfil, contraindicacionEST, banderaRoja, cap } = ctx;
  const rp = catalogo.reglasPlanificador;
  // 1. Filtros de la entrada.
  if (entrada.nivelMin != null && nivel < entrada.nivelMin) return null;
  if (entrada.nivelMax != null && nivel > entrada.nivelMax) return null;
  if (entrada.semanasMax != null && semana > entrada.semanasMax) return null;

  let e = { tipo: entrada.tipo };
  if (entrada.series != null) e.series = entrada.series;
  if (entrada.condicion) e.condicion = entrada.condicion;
  const origen = entrada.origen ?? null;

  const reemplazar = (nuevoTipo, regla) => {
    traza.push(`${regla}: ${e.tipo} → ${nuevoTipo}`);
    e = { tipo: nuevoTipo, reemplazaA: e.reemplazaA ?? entrada.tipo, motivoReemplazo: regla };
  };

  const compatNivel = () => {
    if (origen === 'desdeSemana5') return true;
    const t = catalogo.tipoSesion(e.tipo);
    if (!t) return false;
    if (nivel < t.nivelMin) {
      let alt = null;
      if (t.categoria === 'electroestimulacion') {
        const sug = catalogo.nivel(nivel)?.estSugerida;
        const ts = sug ? catalogo.tipoSesion(sug) : null;
        const noRec = ts?.perfilesNoRecomendados?.some((x) => x.perfil === perfil);
        if (ts && nivel >= ts.nivelMin && nivel <= ts.nivelMax && !noRec) alt = sug;
      } else {
        const pc = catalogo.tipoSesion('PFMT-CONCIENCIA');
        if (pc && nivel <= pc.nivelMax) alt = 'PFMT-CONCIENCIA';
      }
      if (!alt) {
        traza.push(`nivel ${nivel} < nivelMin de ${e.tipo}: se omite`);
        return false;
      }
      reemplazar(alt, `nivel ${nivel} < nivelMin ${t.nivelMin}`);
      return true;
    }
    if (nivel > t.nivelMax) {
      traza.push(`nivel ${nivel} > nivelMax de ${e.tipo}: se omite`);
      return false;
    }
    return true;
  };

  // 2. Compatibilidad de nivel.
  if (!compatNivel()) return null;
  // 3. Sin electroestimulación.
  if ((contraindicacionEST || !cap.hayEquipo || !cap.tieneEstimulacion) && catalogo.usaCorriente(e.tipo)) {
    const alt = rp.reemplazoSinEST[e.tipo];
    if (!alt) return null;
    reemplazar(alt, contraindicacionEST ? 'reemplazoSinEST'
      : !cap.hayEquipo ? 'reemplazoSinEST (sin equipo registrado)' : 'reemplazoSinEST (equipo sin estimulación)');
  }
  // 4. Sin EMG.
  if (!cap.tieneEMG && rp.reemplazoSinEMG[e.tipo]) reemplazar(rp.reemplazoSinEMG[e.tipo], 'reemplazoSinEMG');
  // 5. Sin sonda anal.
  if (!cap.anal && rp.reemplazoSinSondaAnal[e.tipo]) {
    reemplazar(rp.reemplazoSinSondaAnal[e.tipo], 'reemplazoSinSondaAnal');
    if (!cap.tieneEMG && rp.reemplazoSinEMG[e.tipo]) reemplazar(rp.reemplazoSinEMG[e.tipo], 'reemplazoSinEMG');
  }
  // 6. Sin electrodos.
  if (!cap.electrodos && rp.reemplazoSinElectrodos[e.tipo]) {
    reemplazar(rp.reemplazoSinElectrodos[e.tipo], 'reemplazoSinElectrodos');
  }
  // Tras los reemplazos el tipo puede haber quedado fuera de su rango de nivel.
  if (e.reemplazaA && !compatNivel()) return null;
  // 7. Bandera roja activa.
  if (banderaRoja && !PERMITIDOS_BANDERA_ROJA.includes(e.tipo)) {
    reemplazar('PFMT-CONCIENCIA', 'banderaRojaActiva');
  }
  // Las series solo tienen sentido para PFMT-SERIE.
  if (e.tipo === 'PFMT-SERIE') {
    if (e.series == null) {
      // Entrada original sin series → las del nivel; reemplazo de otra sesión → 1 serie (volumen equivalente).
      e.series = e.reemplazaA ? 1 : (catalogo.nivel(nivel)?.pfmt?.series ?? 1);
    }
  } else {
    delete e.series;
  }
  e.estado = 'pendiente';
  return e;
}

export const MAX_SERIES_DIA = 3; // NICE NG123: 3 veces al día.

function agregarSinDuplicar(lista, entrada) {
  if (!entrada) return;
  const previa = lista.find((x) => x.tipo === entrada.tipo);
  if (!previa) {
    lista.push(entrada);
    return;
  }
  // Un reemplazo que cae en PFMT-SERIE ya presente suma una serie (tope 3/día) en vez de duplicar la sesión.
  if (entrada.tipo === 'PFMT-SERIE' && (entrada.reemplazaA || previa.reemplazaA) && previa.series != null) {
    previa.series = Math.min(MAX_SERIES_DIA, previa.series + (entrada.series ?? 1));
    if (!entrada.reemplazaA) {
      // La entrada original del programa prevalece como identidad de la sesión.
      delete previa.reemplazaA;
      delete previa.motivoReemplazo;
    }
  }
}

/** Construye una semana del plan. */
export function construirSemana(numero, ctx, programa, catalogo) {
  const traza = [];
  const c = { ...ctx, semana: numero };
  const dias = {};
  for (const d of DIAS) {
    dias[d] = [];
    for (const ent of programa.semanaTipo[d] ?? []) {
      agregarSinDuplicar(dias[d], normalizarEntrada(ent, c, catalogo, traza));
    }
  }
  // desdeSemana5 (PROG-DOLOR): ejercicio de conciencia condicionado a que el dolor haya bajado.
  if (numero >= 5 && Array.isArray(programa.desdeSemana5)) {
    for (const ent of programa.desdeSemana5) {
      for (const d of ent.dias) {
        const e = normalizarEntrada({ ...ent, origen: 'desdeSemana5' }, c, catalogo, traza);
        if (e) {
          e.condicion = ent.condicion;
          agregarSinDuplicar(dias[d], e);
        }
      }
    }
  }
  // Re-evaluaciones y diario miccional (reglasPlanificador.insercion*).
  const reev = programa.reevaluaciones ?? {};
  const reevaluaciones = [];
  const rel = ctx.semanaRelativa ? numero - ctx.semanaRelativa : numero;
  if ((reev.diario ?? []).includes(rel)) {
    for (const d of ['L', 'M', 'X']) agregarSinDuplicar(dias[d], { tipo: 'VES-DIARIO', estado: 'pendiente' });
    reevaluaciones.push({ tipo: 'diario', dias: ['L', 'M', 'X'] });
  }
  if ((reev.fuerza ?? []).includes(rel)) {
    agregarSinDuplicar(dias.L, { tipo: REEVAL.fuerza, estado: 'pendiente' });
    reevaluaciones.push({ tipo: 'fuerza', dia: 'L' });
  }
  if ((reev.iciq ?? []).includes(rel)) {
    agregarSinDuplicar(dias.D, { tipo: REEVAL.iciq, estado: 'pendiente' });
    reevaluaciones.push({ tipo: 'iciq', dia: 'D' });
  }
  if ((reev.dolorEVA ?? []).includes(rel)) {
    agregarSinDuplicar(dias.D, { tipo: REEVAL.eva, estado: 'pendiente' });
    reevaluaciones.push({ tipo: 'eva', dia: 'D' });
  }
  return { numero, nivel: ctx.nivel, dias, reevaluaciones, reglasAplicadas: [...new Set(traza)] };
}

/**
 * @param {{perfil:string, nivel:number, seguridad:object, equipo:object|null, fechaInicio:string,
 *          iciqInicial?:number, evaInicial?:number}} entrada
 */
export function generarPlan(entrada, catalogo) {
  const { perfil, nivel, seguridad, equipo, fechaInicio, iciqInicial = null, evaInicial = null } = entrada;
  const programa = catalogo.programaDePerfil(perfil);
  if (!programa) throw new Error(`No hay programa para el perfil ${perfil}.`);
  if (!Number.isInteger(nivel) || !catalogo.nivel(nivel)) throw new RangeError(`Nivel inválido: ${nivel}`);
  if (!fechaInicio) throw new Error('Falta fechaInicio.');

  const contraindicacionEST = seguridad?.contraindicacionEST === true || !seguridad;
  const banderaRoja = (seguridad?.banderasRojas?.length ?? 0) > 0 && seguridad?.consultada !== true;
  const cap = capacidadesEquipo(equipo, catalogo);
  const ctx = { nivel, perfil, contraindicacionEST, banderaRoja, cap };

  const semanas = [];
  for (let n = 1; n <= programa.duracionSemanas && n <= 12; n++) {
    semanas.push(construirSemana(n, ctx, programa, catalogo));
  }

  const motivos = [];
  if (contraindicacionEST) motivos.push('Sin electroestimulación por seguridad: se usan ejercicios equivalentes.');
  else if (!cap.hayEquipo) motivos.push('Sin equipo registrado: se usan ejercicios equivalentes hasta que configures "Mi equipo".');
  else if (!cap.tieneEstimulacion) motivos.push('Tu equipo no electroestimula: las sesiones con corriente se reemplazan por ejercicios y biofeedback.');
  if (banderaRoja) motivos.push('Bandera roja activa: solo ejercicios suaves sin equipo hasta que marques "ya consulté".');
  if (!cap.tieneEMG) motivos.push('Tu equipo no tiene biofeedback (EMG): el biofeedback se reemplaza por la serie de ejercicios.');

  const reglasAplicadas = [...new Set(semanas.flatMap((s) => s.reglasAplicadas))];
  return {
    id: idPlan(fechaInicio),
    fechaInicio,
    perfil,
    programaId: programa.id,
    fase: 'principal',
    nivelInicial: nivel,
    nivelActual: nivel,
    semanaActual: 1,
    duracionSemanas: semanas.length,
    iciqInicial,
    evaInicial,
    entrada: {
      perfil,
      contraindicacionEST,
      banderaRoja,
      equipo: { ...cap },
    },
    reevaluaciones: {
      fuerza: [...(programa.reevaluaciones?.fuerza ?? [])],
      iciq: [...(programa.reevaluaciones?.iciq ?? [])],
      diario: [...(programa.reevaluaciones?.diario ?? [])],
      dolorEVA: [...(programa.reevaluaciones?.dolorEVA ?? [])],
    },
    semana0: (programa.reevaluaciones?.diario ?? []).includes(0) ? { reevaluaciones: [{ tipo: 'diario', dias: 3 }] } : null,
    semanas,
    estado: 'activo',
    motivo: motivos.join(' ') || 'Plan completo según tu perfil, nivel y equipo.',
    reglasAplicadas,
  };
}

/** Contexto de generación reconstruido desde el plan guardado. */
function ctxDesdePlan(plan, nivel) {
  const eq = plan.entrada.equipo;
  return {
    nivel,
    perfil: plan.entrada.perfil,
    contraindicacionEST: plan.entrada.contraindicacionEST,
    banderaRoja: plan.entrada.banderaRoja,
    cap: { hayEquipo: eq.hayEquipo !== false, tieneEstimulacion: eq.tieneEstimulacion !== false, tieneEMG: eq.tieneEMG,
      vaginal: eq.vaginal, anal: eq.anal, electrodos: eq.electrodos },
    semanaRelativa: plan.fase === 'mantenimiento' ? 12 : 0,
  };
}

/**
 * Cambio de nivel: rehace la semana actual y las siguientes con el nivel nuevo.
 * En la semana actual se conservan como "hecha" las sesiones ya completadas del mismo tipo.
 */
export function regenerarSemanaActual(plan, nivelNuevo, catalogo) {
  if (!catalogo.nivel(nivelNuevo)) throw new RangeError(`Nivel inválido: ${nivelNuevo}`);
  const programa = catalogo.programa(plan.programaId);
  const ctx = ctxDesdePlan(plan, nivelNuevo);
  const actual = plan.semanaActual;
  const semanas = plan.semanas.map((s) => {
    if (s.numero < actual) return s;
    const nueva = construirSemana(s.numero, ctx, programa, catalogo);
    if (s.numero === actual) {
      for (const d of DIAS) {
        for (const e of nueva.dias[d]) {
          const previa = s.dias[d]?.find((x) => x.tipo === e.tipo && x.estado === 'hecha');
          if (previa) {
            e.estado = 'hecha';
            if (previa.sesionId) e.sesionId = previa.sesionId;
          }
        }
      }
    }
    return nueva;
  });
  return { ...plan, nivelActual: nivelNuevo, semanas };
}

/**
 * "Mi equipo" cambió: el plan se recalcula desde la semana actual con las capacidades nuevas (RF-17).
 */
export function regenerarConEquipo(plan, equipo, catalogo) {
  const cap = capacidadesEquipo(equipo, catalogo);
  const conEquipo = { ...plan, entrada: { ...plan.entrada, equipo: { ...cap } } };
  return regenerarSemanaActual(conEquipo, plan.nivelActual, catalogo);
}

/**
 * Bandera roja marcada como "ya consulté" (o seguridad re-evaluada): recalcula desde la semana actual.
 */
export function regenerarConSeguridad(plan, seguridad, catalogo) {
  const contraindicacionEST = seguridad?.contraindicacionEST === true || !seguridad;
  const banderaRoja = (seguridad?.banderasRojas?.length ?? 0) > 0 && seguridad?.consultada !== true;
  const nuevo = { ...plan, entrada: { ...plan.entrada, contraindicacionEST, banderaRoja } };
  return regenerarSemanaActual(nuevo, plan.nivelActual, catalogo);
}

/**
 * ¿Hubo mejora suficiente para pasar a mantenimiento? (reglasPlanificador.mejoraParaMantenimiento)
 * ICIQ final ≤ inicial − 2, o perfil sin escapes (ICIQ 0); en DOLOR, EVA final ≤ EVA inicial − 2.
 */
export function mejoraParaMantenimiento(plan, { iciqFinal = null, evaFinal = null }, catalogo) {
  const min = catalogo.iciq.mejoraMinimaPuntos;
  if (plan.perfil === 'DOLOR_HIPERTONIA') {
    if (plan.evaInicial == null || evaFinal == null) return false;
    return evaFinal <= plan.evaInicial - min;
  }
  if (iciqFinal === 0) return true;
  if (plan.iciqInicial == null || iciqFinal == null) return false;
  return iciqFinal <= plan.iciqInicial - min;
}

/**
 * Semana 13+: si hubo mejora → PROG-MANTENIMIENTO (nivel 9), si no → derivación.
 * @returns {{decision:string, motivo:string, plan:object|null}}
 */
export function planMantenimiento(plan, resultados, catalogo) {
  const prog = catalogo.programa(plan.programaId);
  const mejora = mejoraParaMantenimiento(plan, resultados ?? {}, catalogo);
  const destino = mejora ? prog.despues12.siMejora : prog.despues12.siNoMejora;
  if (destino !== 'PROG-MANTENIMIENTO') {
    return {
      decision: destino === 'DERIVAR_PARA_PROGRESAR' ? 'derivar-para-progresar' : 'derivar',
      mejora,
      motivo: mejora
        ? 'Mejoraste: para progresar más allá de la relajación conviene que un profesional te valore.'
        : 'Mejora insuficiente: te recomendamos valoración por un profesional de suelo pélvico.',
      plan: null,
    };
  }
  const mant = catalogo.programa('PROG-MANTENIMIENTO');
  const nivelM = catalogo.reglasPlanificador.mantenimientoNivel;
  const ctx = {
    ...ctxDesdePlan(plan, nivelM),
    semanaRelativa: 12,
  };
  const semanas = [];
  for (let n = 13; n <= 24; n++) {
    // semanasMax del programa de mantenimiento se cuenta desde su inicio (semana 13 = 1).
    const s = construirSemana(n, { ...ctx }, {
      ...mant,
      semanaTipo: Object.fromEntries(Object.entries(mant.semanaTipo).map(([d, l]) => [d,
        l.filter((e) => e.semanasMax == null || n - 12 <= e.semanasMax).map(({ semanasMax, ...r }) => r)])),
    }, catalogo);
    semanas.push(s);
  }
  return {
    decision: 'mantenimiento',
    mejora,
    motivo: mejora
      ? '¡Mejoraste! Pasas al programa de mantenimiento: una rutina corta para conservar lo ganado.'
      : 'Sigues con el programa de mantenimiento.',
    plan: {
      ...plan,
      id: `${plan.id}-mant`,
      programaId: mant.id,
      fase: 'mantenimiento',
      nivelActual: nivelM,
      semanaActual: 13,
      duracionSemanas: 24,
      semanas: [...plan.semanas, ...semanas],
      motivo: 'Programa de mantenimiento a partir de la semana 13.',
    },
  };
}

/** Entradas de un día concreto del plan (para "Hoy"). */
export function entradasDelDia(plan, semana, dia) {
  return plan?.semanas?.find((s) => s.numero === semana)?.dias?.[dia] ?? [];
}

/** Fecha real de una entrada del plan. */
export function fechaEntrada(plan, semana, dia) {
  return fechaDePlan(plan.fechaInicio, semana, dia);
}
