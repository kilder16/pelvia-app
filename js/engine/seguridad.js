// Evaluación de seguridad clínica (RF-02, RF-21, RNF-08). Fuente: POGP 2021 + manuales de fabricantes.
// Puro: recibe respuestas planas { 'CI-EMBARAZO': true, 'PR-DIU': false, 'BR-HEMATURIA': false, ... }.

import { aISO, diasEntre } from '../util/fechas.js';

export const VIGENCIA_DIAS_POR_DEFECTO = 90;

/**
 * @param {Record<string, boolean>} respuestas
 * @param {object} catalogo  resultado de crearCatalogo
 * @param {string|Date} [fecha]
 */
export function evaluarSeguridad(respuestas, catalogo, fecha = new Date()) {
  const r = respuestas ?? {};
  const s = catalogo.seguridad;
  const todas = [...s.contraindicacionesAbsolutas, ...s.precauciones, ...s.banderasRojas];
  const faltantes = todas.filter((p) => typeof r[p.id] !== 'boolean').map((p) => p.id);

  const contraindicaciones = s.contraindicacionesAbsolutas
    .filter((c) => r[c.id] === true)
    .map((c) => ({ id: c.id, pregunta: c.pregunta, motivo: c.motivo }));
  const precauciones = s.precauciones
    .filter((p) => r[p.id] === true)
    .map((p) => ({ id: p.id, pregunta: p.pregunta, mensaje: p.mensaje }));
  const banderasRojas = s.banderasRojas
    .filter((b) => r[b.id] === true)
    .map((b) => ({ id: b.id, pregunta: b.pregunta, mensaje: b.mensaje }));

  // Criterio conservador: una contraindicación sin responder cuenta como "no descartada".
  const ciSinResponder = s.contraindicacionesAbsolutas.some((c) => typeof r[c.id] !== 'boolean');
  const contraindicacionEST = contraindicaciones.length > 0 || ciSinResponder;

  const mensajes = [];
  if (contraindicacionEST) mensajes.push(s.mensajes.contraindicacion);
  if (banderasRojas.length) mensajes.push(s.mensajes.banderaRoja);

  return {
    fecha: aISO(fecha),
    completa: faltantes.length === 0,
    faltantes,
    contraindicacionEST,
    contraindicaciones,
    precauciones,
    banderasRojas,
    consultada: false,
    mensajes,
    respuestas: { ...r },
  };
}

/** La evaluación tiene ≤ `dias` de antigüedad respecto de `hoy`. */
export function seguridadVigente(evaluacion, hoy = new Date(), dias = VIGENCIA_DIAS_POR_DEFECTO) {
  if (!evaluacion || !evaluacion.fecha) return false;
  const edad = diasEntre(evaluacion.fecha, hoy);
  return edad >= 0 && edad <= dias;
}

/** Hay bandera roja que todavía no se marcó como "ya consulté". */
export function banderaRojaActiva(evaluacion) {
  return !!evaluacion && (evaluacion.banderasRojas?.length ?? 0) > 0 && evaluacion.consultada !== true;
}

/**
 * Puerta de entrada de cualquier sesión EST-* o TENS-* (RNF-08).
 * @param {{evaluacion: object, hoy?: string|Date, dias?: number, checklistConfirmado?: boolean, catalogo?: object}} estado
 * @returns {{ok: boolean, motivo: string, codigo: string}}
 */
export function puedeIniciarEST(estado) {
  const { evaluacion, hoy = new Date(), checklistConfirmado } = estado ?? {};
  const dias = estado?.dias ?? estado?.catalogo?.seguridad?.vigenciaDias ?? VIGENCIA_DIAS_POR_DEFECTO;
  const msj = estado?.catalogo?.seguridad?.mensajes ?? {};
  if (!evaluacion) {
    return { ok: false, codigo: 'sin-evaluacion', motivo: 'Primero responde el cuestionario de seguridad.' };
  }
  if (evaluacion.completa === false) {
    return { ok: false, codigo: 'incompleta', motivo: 'El cuestionario de seguridad está incompleto. Respóndelo completo antes de usar el equipo.' };
  }
  if (evaluacion.contraindicacionEST) {
    return {
      ok: false,
      codigo: 'contraindicacion',
      motivo: msj.contraindicacion ?? 'Hay una contraindicación para la electroestimulación. Consulta con tu profesional.',
    };
  }
  if (!seguridadVigente(evaluacion, hoy, dias)) {
    return {
      ok: false,
      codigo: 'vencida',
      motivo: msj.vencida ?? `Tu cuestionario de seguridad tiene más de ${dias} días. Respóndelo de nuevo.`,
    };
  }
  if (banderaRojaActiva(evaluacion)) {
    return {
      ok: false,
      codigo: 'bandera-roja',
      motivo: msj.banderaRoja ?? 'Bandera roja: consulta médica antes de continuar.',
    };
  }
  if (checklistConfirmado === false) {
    return { ok: false, codigo: 'checklist', motivo: 'Confirma la lista de verificación antes de empezar.' };
  }
  return { ok: true, codigo: 'ok', motivo: 'Puedes iniciar la sesión con el equipo.' };
}
