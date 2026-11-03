// Línea de tiempo precalculada de una sesión guiada (RF-08, RF-09; docs/diseno.md §10).
// Fases: CONTRAE | RELAJA | DESCANSO | RAPIDA | SUELTA | INHALA | EXHALA | POSTURA | CAMBIO_PROGRAMA.
// El temporizador de la UI solo recorre esta lista con performance.now(); aquí no hay relojes.

export const DESCANSO_ENTRE_SERIES_S = 60;
export const CAMBIO_PROGRAMA_S = 30;
export const AVISO_TENS_CADA_S = 300;

const CAMPOS_REGISTRO = ['intensidadMA', 'esfuerzo', 'dolor', 'repsLogradas', 'emgPicoUV', 'emgReposoUV', 'nota'];

function fase(nombre, seg, instruccion, extra = {}) {
  return { nombre, seg, instruccion, ...extra };
}

/** Ciclos ON/OFF que cubren la duración (5/10 × 20 min = 80). */
export function ciclosEST(p) {
  const ciclo = (p.onS ?? 0) + (p.offS ?? 0);
  if (ciclo <= 0) return 0;
  return Math.round((p.duracionMin * 60) / ciclo);
}

function fasesEST(p, base = {}) {
  const n = ciclosEST(p);
  const activa = p.participacionActiva !== false;
  const rampa = p.rampaS ? ` (sube en ${String(p.rampaS).replace('.', ',')} s)` : '';
  const out = [];
  for (let c = 1; c <= n; c++) {
    out.push(fase('CONTRAE', p.onS,
      activa ? `Contrae con el equipo: aprieta y eleva${rampa}.` : `El equipo trabaja${rampa}: relájate y respira.`,
      { ciclo: c, ciclos: n, rampaS: p.rampaS ?? 0, pasiva: !activa, ...base }));
    out.push(fase('RELAJA', p.offS, 'Suelta del todo y respira.', { ciclo: c, ciclos: n, ...base }));
  }
  return out;
}

function nivelPfmt(catalogo, nivel) {
  const n = catalogo.nivel(nivel);
  if (!n) throw new RangeError(`Nivel inválido: ${nivel}`);
  return n;
}

/** Series de lentas + rápidas con descanso de 60 s entre series. */
function fasesSerie({ sostenS, descansoS, reps, rapidas = 0, rapidasOnS = 1, rapidasOffS = 1, series = 1,
  descansoEntreSeriesS = DESCANSO_ENTRE_SERIES_S }) {
  const out = [];
  for (let s = 1; s <= series; s++) {
    for (let r = 1; r <= reps; r++) {
      out.push(fase('CONTRAE', sostenS, 'Aprieta y eleva, sin glúteos ni abdomen. Sigue respirando.', { serie: s, series, rep: r, reps }));
      out.push(fase('RELAJA', descansoS, 'Suelta del todo.', { serie: s, series, rep: r, reps }));
    }
    for (let r = 1; r <= rapidas; r++) {
      out.push(fase('RAPIDA', rapidasOnS, 'Rápida: aprieta fuerte.', { serie: s, series, rep: r, reps: rapidas }));
      out.push(fase('SUELTA', rapidasOffS, 'Suelta.', { serie: s, series, rep: r, reps: rapidas }));
    }
    if (s < series) out.push(fase('DESCANSO', descansoEntreSeriesS, 'Descansa entre series.', { serie: s, series }));
  }
  return out;
}

function fasesRapidas({ rapidas, rapidasOnS = 1, rapidasOffS = 1, series = 1, descansoEntreSeriesS = DESCANSO_ENTRE_SERIES_S }) {
  return fasesSerie({ sostenS: 0, descansoS: 0, reps: 0, rapidas, rapidasOnS, rapidasOffS, series, descansoEntreSeriesS });
}

function fasesRespiracion(seg, inhalarS, exhalarS, base = {}) {
  const out = [];
  const pares = Math.floor(seg / (inhalarS + exhalarS));
  for (let i = 1; i <= pares; i++) {
    out.push(fase('INHALA', inhalarS, 'Inhala por la nariz: el abdomen se expande y el suelo pélvico se suelta.', { rep: i, reps: pares, ...base }));
    out.push(fase('EXHALA', exhalarS, 'Exhala lento por la boca.', { rep: i, reps: pares, ...base }));
  }
  return out;
}

function fasesBloques(bloques) {
  const out = [];
  bloques.forEach((b, i) => {
    const base = { bloque: i + 1, bloques: bloques.length, nombreBloque: b.nombre };
    if (b.inhalarS && b.exhalarS) out.push(...fasesRespiracion(b.seg, b.inhalarS, b.exhalarS, base));
    else if (/reposo/i.test(b.nombre)) out.push(fase('DESCANSO', b.seg, `${b.nombre}: deja la pelvis suelta.`, base));
    else out.push(fase('POSTURA', b.seg, b.nombre, base));
  });
  return out;
}

/**
 * @param {string} tipoSesionId
 * @param {{nivel:number, semana:number, series?:number, equipo?:object}} opciones
 *   Si el equipo fija sus parámetros (aplicaFicha = false con parametrosFijos, p. ej. shorts externos),
 *   la línea de tiempo de las sesiones EST-* usa esos valores en lugar de los del catálogo.
 * @returns {{tipoSesionId:string, fases:object[], totalSeg:number, parametros:object|null, bloques?:object[],
 *           repsPlanificadas:number, avisosSeg?:number[], modo:string}}
 */
export function construirLineaTiempo(tipoSesionId, { nivel = 0, semana = 1, series, equipo = null } = {}, catalogo) {
  const t = catalogo.tipoSesion(tipoSesionId);
  if (!t) throw new Error(`Tipo de sesión desconocido: ${tipoSesionId}`);
  const est = t.estructura ?? {};
  let fases = [];
  let parametros = null;
  let bloques;
  let avisosSeg;
  let modo = 'ejercicio';

  if (t.categoria === 'electroestimulacion' || t.categoria === 'tens') {
    modo = 'equipo';
    parametros = catalogo.parametrosParaSemana(tipoSesionId, semana);
    const eq = equipo && catalogo.resolverEquipo ? catalogo.resolverEquipo(equipo) : equipo;
    const fijos = t.categoria === 'electroestimulacion' && eq?.aplicaFicha === false && eq?.parametrosFijos
      ? eq.parametrosFijos : null;
    if (fijos) {
      parametros = { ...parametros, ...fijos, fijadosPorEquipo: true };
      fases.push(...fasesEST(parametros));
    } else if (Array.isArray(t.bloques)) {
      // EST-MIX: bloque 1 → pausa automática para cambiar de programa → bloque 2.
      bloques = t.bloques.map((b) => ({ nombre: b.nombre, parametros: { ...b.parametros } }));
      bloques.forEach((b, i) => {
        if (i > 0) {
          fases.push(fase('CAMBIO_PROGRAMA', CAMBIO_PROGRAMA_S,
            `Pausa: cambia el equipo a ${b.parametros.frecuenciaHz} Hz · ${b.parametros.anchoPulsoUs} µs (${b.nombre}).`,
            { pausaAuto: true, bloque: i + 1, bloques: bloques.length }));
        }
        fases.push(...fasesEST(b.parametros, { bloque: i + 1, bloques: bloques.length, nombreBloque: b.nombre }));
      });
    } else if (parametros.continuo) {
      modo = 'continuo';
      const seg = parametros.duracionMin * 60;
      fases.push(fase('RELAJA', seg, parametros.instruccionActiva ?? 'Respira lento y deja la pelvis suelta.', { continuo: true }));
      avisosSeg = [];
      for (let a = AVISO_TENS_CADA_S; a < seg; a += AVISO_TENS_CADA_S) avisosSeg.push(a);
    } else {
      fases.push(...fasesEST(parametros));
    }
  } else if (tipoSesionId === 'PFMT-SERIE' || tipoSesionId === 'BIO-LENTAS') {
    const p = nivelPfmt(catalogo, nivel).pfmt;
    const nSeries = series ?? est.series ?? p.series;
    fases = fasesSerie({ ...p, series: nSeries });
    parametros = { ...p, series: nSeries };
  } else if (tipoSesionId === 'BIO-RAPIDAS') {
    const p = nivelPfmt(catalogo, nivel).pfmt;
    const cfg = { rapidas: p.rapidas, rapidasOnS: p.rapidasOnS, rapidasOffS: p.rapidasOffS,
      series: est.series ?? 1, descansoEntreSeriesS: est.descansoEntreSeriesS ?? DESCANSO_ENTRE_SERIES_S };
    fases = fasesRapidas(cfg);
    parametros = cfg;
  } else if (tipoSesionId === 'BIO-RESIST') {
    // Sostén = meta E del nivel + 2 s; descanso igual al sostén (estructura del catálogo).
    const n = nivelPfmt(catalogo, nivel);
    const sostenS = (n.metas?.E ?? n.pfmt.sostenS) + 2;
    const cfg = { sostenS, descansoS: sostenS, reps: est.reps ?? 5, series: est.series ?? 1, rapidas: 0 };
    fases = fasesSerie(cfg);
    parametros = cfg;
  } else if (Array.isArray(est.bloques)) {
    bloques = est.bloques;
    fases = fasesBloques(est.bloques);
  } else if (tipoSesionId === 'VES-SUPRESION') {
    const pr = est.practica;
    for (let r = 1; r <= pr.reps; r++) {
      for (let i = 1; i <= pr.rapidas; i++) {
        fases.push(fase('RAPIDA', 1, 'Quieta: rápida.', { rep: r, reps: pr.reps }));
        fases.push(fase('SUELTA', 1, 'Suelta.', { rep: r, reps: pr.reps }));
      }
      fases.push(fase('CONTRAE', pr.sostenS, 'Sostén 10 s, respira lento y piensa en otra cosa.', { rep: r, reps: pr.reps }));
      fases.push(fase('RELAJA', pr.sostenS, 'Suelta. La urgencia baja como una ola.', { rep: r, reps: pr.reps }));
    }
    parametros = { ...pr };
  } else if (tipoSesionId === 'PFMT-KNACK') {
    const reps = est.reps ?? 5;
    for (let r = 1; r <= reps; r++) {
      fases.push(fase('CONTRAE', 3, 'Contrae primero… y ahora tose suave (o levanta algo liviano) sin soltar.', { rep: r, reps }));
      fases.push(fase('RELAJA', 5, 'Suelta y respira.', { rep: r, reps }));
    }
    parametros = { reps, series: est.series ?? 1 };
  } else if (tipoSesionId === 'PFMT-FUNCIONAL') {
    est.ejercicios.forEach((ej, i) => {
      for (let s = 1; s <= ej.series; s++) {
        const seg = ej.reps === 1 ? 120 : ej.reps * 5;
        fases.push(fase('POSTURA', seg, ej.nombre, { bloque: i + 1, bloques: est.ejercicios.length, serie: s, series: ej.series, reps: ej.reps }));
        fases.push(fase('DESCANSO', 30, 'Descansa.', { bloque: i + 1, serie: s }));
      }
    });
    if (fases.length && fases[fases.length - 1].nombre === 'DESCANSO') fases.pop();
  } else if (est.sostenS && est.reps) {
    // PFMT-CONCIENCIA y similares con estructura simple.
    const cfg = { sostenS: est.sostenS, descansoS: est.descansoS, reps: est.reps, series: est.series ?? 1,
      rapidas: 0, descansoEntreSeriesS: est.descansoEntreSeriesS ?? DESCANSO_ENTRE_SERIES_S };
    fases = fasesSerie(cfg);
    parametros = cfg;
  } else {
    modo = 'registro'; // VES-DIARIO, HAB-SEMANAL: no tienen temporizador.
  }

  const totalSeg = fases.reduce((s, f) => s + f.seg, 0);
  const repsPlanificadas = fases.filter((f) => (f.nombre === 'CONTRAE' || f.nombre === 'RAPIDA') && !f.ciclos).length;
  const r = { tipoSesionId, modo, fases, totalSeg, parametros, repsPlanificadas };
  if (bloques) r.bloques = bloques;
  if (avisosSeg) r.avisosSeg = avisosSeg;
  return r;
}

/**
 * Campos a pedir al cerrar la sesión (RF-08/RF-09), según categoría y estructura.registra.
 * @returns {string[]}
 */
export function registroDeSesion(tipoSesionId, catalogo) {
  const t = catalogo.tipoSesion(tipoSesionId);
  if (!t) return ['nota'];
  if (t.categoria === 'vesical' || t.categoria === 'habitos') {
    return t.id === 'VES-SUPRESION' ? ['repsLogradas', 'dolor', 'nota'] : ['nota'];
  }
  const campos = new Set();
  if (t.categoria === 'electroestimulacion' || t.categoria === 'tens') {
    campos.add('intensidadMA');
    campos.add('esfuerzo');
  }
  for (const c of t.estructura?.registra ?? []) if (CAMPOS_REGISTRO.includes(c)) campos.add(c);
  campos.add('dolor'); // la progresión necesita saber si hubo dolor (RF-11).
  campos.add('nota');
  return CAMPOS_REGISTRO.filter((c) => campos.has(c));
}
