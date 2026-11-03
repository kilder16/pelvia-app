// Utilidades de fechas puras (sin DOM). Se usan desde el motor y desde la UI.
// Convención: las fechas "de calendario" se manejan como texto ISO 'AAAA-MM-DD' en hora local.

export const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const NOMBRES_DIA = {
  L: 'Lunes', M: 'Martes', X: 'Miércoles', J: 'Jueves', V: 'Viernes', S: 'Sábado', D: 'Domingo',
};
const MS_DIA = 86400000;

/** Convierte 'AAAA-MM-DD' o Date a Date local a medianoche. */
export function aFecha(valor) {
  if (valor instanceof Date) return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  if (typeof valor === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
    if (!m) throw new Error(`Fecha inválida: ${valor}`);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  throw new Error(`Fecha inválida: ${valor}`);
}

/** Date o texto → 'AAAA-MM-DD' (hora local). */
export function aISO(valor) {
  const d = aFecha(valor);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function hoyISO() {
  return aISO(new Date());
}

export function sumarDias(fecha, dias) {
  const d = aFecha(fecha);
  d.setDate(d.getDate() + dias);
  return aISO(d);
}

/** Días enteros entre dos fechas (b − a). Robusto a cambios de horario. */
export function diasEntre(a, b) {
  const da = aFecha(a);
  const db = aFecha(b);
  return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate())
    - Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / MS_DIA);
}

/** Letra del día de la semana ('L'..'D'), lunes primero. */
export function diaSemana(fecha) {
  const js = aFecha(fecha).getDay(); // 0 = domingo
  return DIAS[(js + 6) % 7];
}

/** Lunes de la semana (ISO) que contiene la fecha. */
export function lunesDe(fecha) {
  const idx = DIAS.indexOf(diaSemana(fecha));
  return sumarDias(fecha, -idx);
}

/** Semana ISO 8601: { anio, semana }. */
export function semanaIso(fecha) {
  const d = aFecha(fecha);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const diaNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - diaNum);
  const inicioAnio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((t - inicioAnio) / MS_DIA + 1) / 7);
  return { anio: t.getUTCFullYear(), semana };
}

/** Clave estable de semana ISO, p. ej. '2026-W45'. */
export function claveSemanaIso(fecha) {
  const { anio, semana } = semanaIso(fecha);
  return `${anio}-W${String(semana).padStart(2, '0')}`;
}

/**
 * Número de semana del plan (1 = la semana ISO que contiene fechaInicio).
 * Devuelve 0 o negativo si la fecha es anterior al inicio.
 */
export function semanaDelPlan(fechaInicio, fecha) {
  const dias = diasEntre(lunesDe(fechaInicio), lunesDe(fecha));
  return Math.floor(dias / 7) + 1;
}

/** Fecha concreta de un día del plan: semana n (1..), día 'L'..'D'. */
export function fechaDePlan(fechaInicio, semana, dia) {
  return sumarDias(lunesDe(fechaInicio), (semana - 1) * 7 + DIAS.indexOf(dia));
}

/** Formato legible en español: 'lun 3 nov 2026'. */
export function formatoCorto(fecha) {
  const d = aFecha(fecha);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

/** mm:ss a partir de segundos. */
export function mmss(segundos) {
  const s = Math.max(0, Math.round(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
