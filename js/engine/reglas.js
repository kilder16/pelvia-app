// Evaluador genérico de condiciones declarativas del catálogo: [campo, operador, valor]. ADR-0004.

const OPERADORES = {
  '>=': (a, b) => a >= b,
  '>': (a, b) => a > b,
  '<=': (a, b) => a <= b,
  '<': (a, b) => a < b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
};

/** Evalúa una condición contra un objeto de datos planos. */
export function cumpleCondicion([campo, op, valor], datos) {
  const f = OPERADORES[op];
  if (!f) throw new Error(`Operador no soportado en el catálogo: ${op}`);
  return f(datos[campo], valor);
}

/** Todas las condiciones (AND). Lista vacía = regla por defecto (siempre se cumple). */
export function cumpleTodas(condiciones, datos) {
  return (condiciones ?? []).every((c) => cumpleCondicion(c, datos));
}

/** Texto legible de una condición: "esf >= 2". */
export function textoCondicion(condiciones) {
  if (!condiciones || condiciones.length === 0) return 'por defecto';
  return condiciones.map(([c, o, v]) => `${c} ${o} ${v}`).join(' y ');
}
