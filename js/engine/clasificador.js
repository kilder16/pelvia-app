// Clasificación del perfil a partir de síntomas + ICIQ-UI SF (RF-03, RF-04). Tablas en reglasClasificacion.

import { cumpleTodas, cumpleCondicion, textoCondicion } from './reglas.js';

/**
 * Puntaje del ICIQ-UI SF adaptado: q1 (0–5) + q2 (0, 2, 4, 6) + q3 (0–10) = 0–21.
 * @returns {{total:number, severidad:string, nombreSeveridad:string}}
 */
export function puntajeIciq(respuestas, catalogo) {
  const iciq = catalogo.iciq;
  const r = respuestas ?? {};
  for (const item of iciq.items) {
    const v = r[item.id];
    if (typeof v !== 'number' || !Number.isInteger(v)) {
      throw new RangeError(`ICIQ: falta la respuesta ${item.id} o no es un número entero.`);
    }
    if (item.opciones) {
      if (!item.opciones.some((o) => o.valor === v)) {
        throw new RangeError(`ICIQ: valor ${v} fuera de las opciones de ${item.id}.`);
      }
    } else if (v < item.min || v > item.max) {
      throw new RangeError(`ICIQ: ${item.id} = ${v} fuera de rango ${item.min}–${item.max}.`);
    }
  }
  const total = iciq.items.reduce((s, it) => s + r[it.id], 0);
  const sev = iciq.severidad.find((x) => total >= x.min && total <= x.max);
  return { total, severidad: sev.id, nombreSeveridad: sev.nombre };
}

/** Severidad (id) para un total ya calculado. */
export function severidadDeTotal(total, catalogo) {
  return catalogo.iciq.severidad.find((x) => total >= x.min && total <= x.max)?.id ?? null;
}

/**
 * @param {Record<string, number>} sintomas  esf, urg, frec, fec, prol, dol, vac (0–3)
 * @param {Record<string, any>} contexto   ctxPostparto, ctxMenopausia (boolean), ctxDiagnostico (texto)
 * @param {{total:number, severidad?:string}|Record<string,number>} iciq  resultado de puntajeIciq o respuestas q1..q3
 */
export function clasificar(sintomas, contexto, iciq, catalogo) {
  const cs = catalogo.cuestionarioSintomas;
  const s = sintomas ?? {};
  const faltan = cs.preguntas.filter((p) => !Number.isInteger(s[p.id]) || s[p.id] < 0 || s[p.id] > 3).map((p) => p.id);
  if (faltan.length) throw new RangeError(`Faltan respuestas de síntomas o están fuera de 0–3: ${faltan.join(', ')}.`);

  const ctx = {
    ctxPostparto: contexto?.ctxPostparto === true,
    ctxMenopausia: contexto?.ctxMenopausia === true,
  };
  const datos = { ...s, ...ctx };

  const puntaje = iciq && typeof iciq.total === 'number' && iciq.severidad
    ? iciq
    : puntajeIciq(iciq, catalogo);

  const reglasAplicadas = [];
  const orden = catalogo.reglasClasificacion.orden;
  let elegida = null;
  for (let i = 0; i < orden.length; i++) {
    if (cumpleTodas(orden[i].si, datos)) {
      elegida = orden[i];
      reglasAplicadas.push(`reglasClasificacion.orden[${i}] ${orden[i].perfil}: ${textoCondicion(orden[i].si)}`);
      break;
    }
  }
  const perfil = elegida.perfil;

  let predominio = null;
  if (perfil === 'MIXTA') {
    // Mayor puntaje; empate → ESFUERZO (reglasClasificacion.predominioMixta).
    predominio = s.urg > s.esf ? 'URGENCIA' : 'ESFUERZO';
    reglasAplicadas.push(`predominioMixta: esf=${s.esf}, urg=${s.urg} → ${predominio}`);
  }

  const d = catalogo.reglasClasificacion.derivar;
  const motivosDerivar = [];
  const perfilCat = catalogo.perfil(perfil);
  if (d.perfiles.includes(perfil) || perfilCat?.derivarSiempre) motivosDerivar.push(`perfil ${perfil}`);
  if (d.severidades.includes(puntaje.severidad)) motivosDerivar.push(`severidad ICIQ ${puntaje.severidad}`);
  for (const c of d.condicionesExtra ?? []) {
    if (cumpleCondicion(c, datos)) motivosDerivar.push(textoCondicion([c]));
  }
  const derivar = motivosDerivar.length > 0;
  if (derivar) reglasAplicadas.push(`derivar: ${motivosDerivar.join(', ')}`);

  const mensajesDerivacion = [];
  if (derivar) {
    mensajesDerivacion.push(d.mensaje);
    if (perfilCat?.mensajeDerivacion) mensajesDerivacion.push(perfilCat.mensajeDerivacion);
  }

  const resultado = {
    perfil,
    severidad: puntaje.severidad,
    iciqTotal: puntaje.total,
    derivar,
    motivo: elegida.motivo + (predominio ? ` Predominio: ${predominio === 'URGENCIA' ? 'urgencia' : 'esfuerzo'}.` : ''),
    reglasAplicadas,
    mensajesDerivacion,
  };
  if (predominio) resultado.predominio = predominio;
  return resultado;
}
