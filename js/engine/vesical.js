// Entrenamiento vesical (RF-15; docs/diseno.md §6.6). objetivo(semana) = min(media + 15·semana, 240).

const MIN_INTERVALO_VALIDO = 10; // dos micciones a menos de 10 min se consideran la misma.

function aMinutos(hora) {
  if (typeof hora === 'number') return hora;
  const m = /(\d{1,2}):(\d{2})/.exec(String(hora));
  if (!m) throw new RangeError(`Hora inválida en el diario: ${hora}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Intervalos (min) entre micciones de un mismo día, dadas sus horas 'HH:MM' o ISO. */
export function intervalosDelDia(horas) {
  const mins = (horas ?? []).map((h) => {
    if (typeof h === 'string' && h.includes('T')) {
      const d = new Date(h);
      return d.getHours() * 60 + d.getMinutes();
    }
    return aMinutos(h);
  }).sort((a, b) => a - b);
  const out = [];
  for (let i = 1; i < mins.length; i++) {
    const dif = mins[i] - mins[i - 1];
    if (dif >= MIN_INTERVALO_VALIDO) out.push(dif);
  }
  return out;
}

/**
 * Intervalo medio (min) del diario de 3 días. Cada día puede traer `intervaloMedioMin` ya calculado
 * o `micciones` como lista de horas. Devuelve null si no hay datos suficientes.
 */
export function intervaloMedio(diario3dias) {
  const todos = [];
  for (const dia of diario3dias ?? []) {
    if (Array.isArray(dia.micciones)) todos.push(...intervalosDelDia(dia.micciones));
    else if (typeof dia.intervaloMedioMin === 'number') todos.push(dia.intervaloMedioMin);
  }
  if (!todos.length) return null;
  return Math.round(todos.reduce((s, x) => s + x, 0) / todos.length);
}

/** Intervalo objetivo para la semana del plan (semana 0 = basal). */
export function intervaloObjetivo(medio, semana, catalogo) {
  if (typeof medio !== 'number' || medio <= 0) return null;
  const ev = catalogo?.entrenamientoVesical ?? { incrementoMinPorSemana: 15, objetivoMaxMin: 240 };
  return Math.min(medio + ev.incrementoMinPorSemana * Math.max(0, semana), ev.objetivoMaxMin);
}

/** Resumen de un día del diario a partir de sus eventos ({tipo:'miccion'|'urgencia'|'escape', hora}). */
export function resumenDia(fecha, eventos) {
  const de = (t) => (eventos ?? []).filter((e) => e.tipo === t);
  const micciones = de('miccion').map((e) => e.hora);
  const ints = intervalosDelDia(micciones);
  return {
    fecha,
    micciones: micciones.length,
    urgencias: de('urgencia').length,
    escapes: de('escape').length,
    intervaloMedioMin: ints.length ? Math.round(ints.reduce((s, x) => s + x, 0) / ints.length) : null,
  };
}
