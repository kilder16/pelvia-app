// Utilidades compartidas por los tests (no es un archivo de test). Solo datos ficticios.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { crearCatalogo } from '../js/engine/catalogo.js';
import { evaluarSeguridad } from '../js/engine/seguridad.js';

export const RUTA_CATALOGO = fileURLToPath(new URL('../content/protocolos.json', import.meta.url));
export const jsonCatalogo = () => JSON.parse(readFileSync(RUTA_CATALOGO, 'utf8'));
export const catalogo = crearCatalogo(jsonCatalogo());

/** Respuestas de seguridad todas en "no", con las indicadas en "sí". */
export function respuestasSeguridad(si = []) {
  const s = catalogo.seguridad;
  const r = {};
  for (const p of [...s.contraindicacionesAbsolutas, ...s.precauciones, ...s.banderasRojas]) r[p.id] = si.includes(p.id);
  return r;
}

export const seguridadLimpia = (fecha = '2026-11-02') => evaluarSeguridad(respuestasSeguridad(), catalogo, fecha);

export const sintomas0 = () => ({ esf: 0, urg: 0, frec: 0, fec: 0, prol: 0, dol: 0, vac: 0 });

export const equipoVaginalEMG = () => ({
  marca: 'Prueba', modelo: 'X', tipoSonda: 'vaginal', sondas: ['vaginal'], tieneEMG: true, mAMax: 100, programas: {},
});

export const todasLasEntradas = (plan) => plan.semanas.flatMap((s) => Object.values(s.dias).flat());
