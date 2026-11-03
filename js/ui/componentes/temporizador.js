// Temporizador de la sesión guiada (RF-08, RF-09; RNF-06; docs/diseno.md §10).
// La fase actual se DERIVA siempre de t = ahora − inicio − pausasAcumuladas buscando en los cortes acumulados
// de la línea de tiempo; nunca se usan contadores incrementales, así que no hay desfase acumulado.
// No toca `document`/`window` al importarse; el reloj es inyectable para probarlo en Node.

import { vibrar } from '../../util/vibrar.js';
import { beep } from '../../util/audio.js';
import { reintentarWakeLock } from '../../util/wakelock.js';
import { ajustes } from '../../store/repo.js';

export const FRECUENCIA_BEEP = {
  CONTRAE: 880, RAPIDA: 880, INHALA: 880,
  RELAJA: 440, SUELTA: 440, EXHALA: 440, DESCANSO: 440,
};

/** Segundos acumulados al final de cada fase: [5, 15, 20, 30, ...]. */
export function cortesAcumulados(fases) {
  let acc = 0;
  return fases.map((f) => (acc += f.seg));
}

/** Índice de la fase que contiene el segundo `t` (búsqueda binaria). Devuelve fases.length si terminó. */
export function indiceEn(cortes, t) {
  let lo = 0;
  let hi = cortes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cortes[mid] > t) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** Estado puro de la línea de tiempo en el segundo `t`. */
export function estadoEn(fases, cortes, t) {
  const total = cortes.length ? cortes[cortes.length - 1] : 0;
  const tt = Math.max(0, Math.min(t, total));
  const indice = indiceEn(cortes, tt);
  const terminado = indice >= fases.length;
  const inicioFase = indice > 0 ? cortes[indice - 1] : 0;
  const fase = terminado ? null : fases[indice];
  return {
    t: tt,
    indice,
    fase,
    terminado,
    transcurridoFase: terminado ? 0 : tt - inicioFase,
    restanteFase: terminado ? 0 : cortes[indice] - tt,
    restanteTotal: total - tt,
    totalSeg: total,
  };
}

function avisarPorDefecto(fase) {
  if (!fase) return;
  let a = { vibracion: true, sonido: true };
  try { a = ajustes(); } catch { /* sin almacenamiento */ }
  if (a.vibracion) vibrar([200]);
  if (a.sonido) {
    const f = FRECUENCIA_BEEP[fase.nombre];
    if (f) beep(f);
  }
}

/**
 * @param {{fases:object[], alCambiarFase?:Function, alTick?:Function, alTerminar?:Function, alAviso?:Function,
 *          avisosSeg?:number[], ahora?:() => number, programar?:Function, cancelar?:Function,
 *          avisar?:(fase:object)=>void, escucharVisibilidad?:boolean}} opciones
 *   `ahora` devuelve milisegundos (por defecto performance.now()).
 */
export function crearTemporizador({
  fases,
  alCambiarFase = () => {},
  alTick = () => {},
  alTerminar = () => {},
  alAviso = () => {},
  avisosSeg = [],
  ahora = () => performance.now(),
  programar = (cb) => (globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(cb) : setTimeout(cb, 16)),
  cancelar = (id) => (globalThis.cancelAnimationFrame ? globalThis.cancelAnimationFrame(id) : clearTimeout(id)),
  avisar = avisarPorDefecto,
  escucharVisibilidad = true,
} = {}) {
  const cortes = cortesAcumulados(fases);
  let inicio = null;
  let pausasMs = 0;
  let pausadoDesde = null;
  let pausaAuto = false;
  let terminado = false;
  let ultimoIndice = -1;
  let ultimoAviso = 0;
  let idFrame = null;
  const autoPausadas = new Set();

  const tSeg = () => {
    if (inicio == null) return 0;
    const ref = pausadoDesde ?? ahora();
    return (ref - inicio - pausasMs) / 1000;
  };

  function estado() {
    const e = estadoEn(fases, cortes, tSeg());
    return {
      ...e,
      iniciado: inicio != null,
      pausado: pausadoDesde != null,
      pausaAuto,
      terminado: terminado || e.terminado,
      transcurridoSeg: e.t,
    };
  }

  function detenerBucle() {
    if (idFrame != null) cancelar(idFrame);
    idFrame = null;
  }

  function bucle() {
    idFrame = null;
    actualizar();
    if (inicio != null && pausadoDesde == null && !terminado) idFrame = programar(bucle);
  }

  /** Recalcula a partir del reloj real. Se puede llamar en cualquier momento (p. ej. al volver de segundo plano). */
  function actualizar() {
    if (inicio == null || terminado) return estado();
    let e = estado();
    if (!e.terminado && e.indice !== ultimoIndice) {
      ultimoIndice = e.indice;
      if (e.fase.pausaAuto && !autoPausadas.has(e.indice)) {
        // Pausa automática exactamente al inicio de la fase (p. ej. cambiar de programa en EST-MIX).
        autoPausadas.add(e.indice);
        const inicioFaseMs = inicio + pausasMs + (e.indice > 0 ? cortes[e.indice - 1] : 0) * 1000;
        pausadoDesde = inicioFaseMs;
        pausaAuto = true;
        detenerBucle();
        e = estado();
      }
      try { avisar(e.fase); } catch { /* el aviso nunca rompe la sesión */ }
      alCambiarFase(e);
    }
    const n = avisosSeg.filter((a) => a <= e.t).length;
    if (n > ultimoAviso) {
      ultimoAviso = n;
      try { avisar({ nombre: 'AVISO' }); } catch { /* idem */ }
      alAviso(e);
    }
    alTick(e);
    if (e.terminado && !terminado) {
      terminado = true;
      detenerBucle();
      alTerminar(e);
    }
    return e;
  }

  const alVisibilidad = () => {
    if (globalThis.document?.visibilityState === 'visible') {
      actualizar();
      reintentarWakeLock();
    }
  };

  function iniciar() {
    if (inicio != null) return estado();
    inicio = ahora();
    if (escucharVisibilidad && globalThis.document) globalThis.document.addEventListener('visibilitychange', alVisibilidad);
    const e = actualizar();
    if (pausadoDesde == null && !terminado) idFrame = programar(bucle);
    return e;
  }

  function pausar() {
    if (inicio == null || pausadoDesde != null || terminado) return estado();
    actualizar();
    pausadoDesde = ahora();
    pausaAuto = false;
    detenerBucle();
    return estado();
  }

  function reanudar() {
    if (inicio == null || pausadoDesde == null || terminado) return estado();
    pausasMs += ahora() - pausadoDesde;
    pausadoDesde = null;
    pausaAuto = false;
    const e = actualizar();
    if (!terminado && pausadoDesde == null) idFrame = programar(bucle);
    return e;
  }

  /** Salta al final de la fase actual (p. ej. "Listo, continuar" tras cambiar de programa) y reanuda. */
  function saltarFase() {
    if (inicio == null || terminado) return estado();
    const e = estado();
    const destino = cortes[e.indice] ?? cortes[cortes.length - 1];
    const ref = pausadoDesde ?? ahora();
    pausasMs = ref - inicio - destino * 1000;
    if (pausadoDesde != null) return reanudar();
    return actualizar();
  }

  /** Termina por decisión de la usuaria. No llama a alTerminar (lo decide quien llama). */
  function terminar() {
    const e = estado();
    if (inicio != null && pausadoDesde == null) pausadoDesde = ahora();
    terminado = true;
    detenerBucle();
    if (globalThis.document) globalThis.document.removeEventListener('visibilitychange', alVisibilidad);
    return { ...e, terminado: true };
  }

  return { iniciar, pausar, reanudar, saltarFase, terminar, estado, actualizar, cortes };
}
