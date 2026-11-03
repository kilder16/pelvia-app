// Exportar / importar respaldo JSON (RF-18). Formato:
// { "formato": "pelvia-respaldo", "meta": { "esquema": 1, "app": "0.1.0", "exportado": "..." }, "datos": { perfil, plan, ... } }

import { CLAVES, ESQUEMA, APP_VERSION, leer, guardar, restablecer, migrarEstado, guardarAjustes } from './repo.js';
import { aISO } from '../util/fechas.js';

/** Nombre del archivo: pelvia-respaldo-AAAA-MM-DD.json */
export function nombreRespaldo(fecha = new Date()) {
  return `pelvia-respaldo-${aISO(fecha)}.json`;
}

/** Objeto de respaldo con todas las claves pelvia.* (sin meta duplicada dentro de datos). */
export function datosRespaldo(fecha = new Date()) {
  const datos = {};
  for (const k of CLAVES) {
    if (k === 'meta') continue;
    const v = leer(k);
    if (v != null) datos[k] = v;
  }
  return {
    formato: 'pelvia-respaldo',
    meta: { ...(leer('meta') ?? {}), esquema: ESQUEMA, app: APP_VERSION, exportado: new Date(fecha).toISOString() },
    datos,
  };
}

/** @returns {{nombre:string, blob:Blob, json:string, datos:object}} */
export function exportar(fecha = new Date()) {
  // Se registra la fecha antes de serializar para que el respaldo refleje el estado exacto tras exportar.
  guardarAjustes({ ultimoRespaldo: aISO(fecha) });
  const datos = datosRespaldo(fecha);
  const json = JSON.stringify(datos, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  return { nombre: nombreRespaldo(fecha), blob, json, datos };
}

/** Valida sin escribir. Lanza Error con un motivo legible. */
export function validarRespaldo(entrada) {
  let obj = entrada;
  if (typeof entrada === 'string') {
    try {
      obj = JSON.parse(entrada);
    } catch {
      throw new Error('El archivo no es un respaldo válido (JSON dañado).');
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('El archivo no es un respaldo de PELVIA.');
  const esquema = obj.meta?.esquema;
  if (typeof esquema !== 'number') throw new Error('El respaldo no tiene meta.esquema: no se puede importar.');
  if (esquema > ESQUEMA) throw new Error(`El respaldo es de una versión más nueva (esquema ${esquema}). Actualiza la app.`);
  if (!obj.datos || typeof obj.datos !== 'object') throw new Error('El respaldo no contiene datos.');
  const desconocidas = Object.keys(obj.datos).filter((k) => !CLAVES.includes(k));
  if (desconocidas.length) throw new Error(`El respaldo trae claves desconocidas: ${desconocidas.join(', ')}.`);
  if (obj.datos.sesiones != null && !Array.isArray(obj.datos.sesiones)) throw new Error('El respaldo tiene sesiones con formato inválido.');
  if (obj.datos.evaluaciones != null && !Array.isArray(obj.datos.evaluaciones)) throw new Error('El respaldo tiene evaluaciones con formato inválido.');
  return obj;
}

/**
 * Valida, migra y reemplaza TODO el estado. Si falla, el estado anterior queda intacto.
 * @param {string|object} entrada
 */
export function importar(entrada) {
  const obj = validarRespaldo(entrada);
  const migrado = migrarEstado(obj.datos, obj.meta.esquema);
  restablecer();
  for (const k of CLAVES) {
    if (k === 'meta') continue;
    if (migrado[k] != null) guardar(k, migrado[k]);
  }
  guardar('meta', { esquema: ESQUEMA, app: APP_VERSION, importado: new Date().toISOString() });
  return { ok: true, esquemaOrigen: obj.meta.esquema };
}
