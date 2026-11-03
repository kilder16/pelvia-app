// Nivel inicial a partir del esquema PERFECT simplificado (RF-05). Tabla en autoevaluacionFuerza.reglasNivel.

import { cumpleTodas, textoCondicion } from './reglas.js';

const RANGOS = { P: [0, 5], E: [0, 10], R: [0, 10], F: [0, 10] };

/** Lanza RangeError si falta un valor o está fuera de rango. */
export function validarFuerza(fuerza) {
  for (const [k, [min, max]] of Object.entries(RANGOS)) {
    const v = fuerza?.[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
      throw new RangeError(`Autoevaluación: ${k} debe estar entre ${min} y ${max}.`);
    }
  }
}

/**
 * Primera regla (en el orden del catálogo) que se cumple → nivel; tope nivelMaximoInicial.
 * @returns {{nivel:number, motivo:string, reglasAplicadas:string[]}}
 */
export function nivelInicial(fuerza, catalogo) {
  validarFuerza(fuerza);
  const reglas = catalogo.autoevaluacionFuerza.reglasNivel;
  const datos = { P: fuerza.P, E: fuerza.E, R: fuerza.R, F: fuerza.F };
  for (let i = 0; i < reglas.orden.length; i++) {
    const r = reglas.orden[i];
    if (cumpleTodas(r.si, datos)) {
      const nivel = Math.min(r.nivel, reglas.nivelMaximoInicial);
      const reglasAplicadas = [`reglasNivel.orden[${i}] nivel ${r.nivel}: ${textoCondicion(r.si)}`];
      if (nivel !== r.nivel) reglasAplicadas.push(`tope nivelMaximoInicial = ${reglas.nivelMaximoInicial}`);
      return { nivel, motivo: r.motivo, reglasAplicadas };
    }
  }
  // El catálogo siempre termina con una regla por defecto; esto es solo defensa.
  return { nivel: 0, motivo: 'Sin regla aplicable: se asigna el nivel más bajo.', reglasAplicadas: ['defensa: nivel 0'] };
}
