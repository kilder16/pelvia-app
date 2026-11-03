import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puntajeIciq, clasificar, severidadDeTotal } from '../js/engine/clasificador.js';
import { catalogo, sintomas0 } from './ayuda.js';

const iciq11 = { q1: 3, q2: 2, q3: 6 };
const sinCtx = { ctxPostparto: false, ctxMenopausia: false };

test('rf03_iciq_3_2_6_da11_moderada', () => {
  const r = puntajeIciq({ q1: 3, q2: 2, q3: 6 }, catalogo);
  assert.equal(r.total, 11);
  assert.equal(r.severidad, 'moderada');
  assert.equal(puntajeIciq({ q1: 0, q2: 0, q3: 0 }, catalogo).severidad, 'sin');
  assert.equal(puntajeIciq({ q1: 5, q2: 6, q3: 10 }, catalogo).total, 21);
  assert.equal(severidadDeTotal(13, catalogo), 'severa');
  assert.equal(severidadDeTotal(19, catalogo), 'muy_severa');
  assert.equal(severidadDeTotal(5, catalogo), 'leve');
});

test('rf03_negativo_iciqFueraDeRango', () => {
  assert.throws(() => puntajeIciq({ q1: 6, q2: 2, q3: 6 }, catalogo), RangeError);
  assert.throws(() => puntajeIciq({ q1: 3, q2: 3, q3: 6 }, catalogo), /fuera de las opciones/);
  assert.throws(() => puntajeIciq({ q1: 3, q2: 2, q3: 11 }, catalogo), /fuera de rango/);
  assert.throws(() => puntajeIciq({ q1: 3, q2: 2 }, catalogo), /falta/);
  assert.throws(() => puntajeIciq({ q1: 1.5, q2: 2, q3: 1 }, catalogo), RangeError);
  assert.throws(() => puntajeIciq(null, catalogo), RangeError);
});

test('rf04_iue', () => {
  const r = clasificar({ ...sintomas0(), esf: 3 }, sinCtx, iciq11, catalogo);
  assert.equal(r.perfil, 'IUE');
  assert.equal(r.severidad, 'moderada');
  assert.equal(r.derivar, false);
  assert.ok(r.motivo.length > 0);
  assert.match(r.reglasAplicadas[0], /IUE: esf >= 2/);
});

test('rf04_mixtaPredominioUrgencia', () => {
  const r = clasificar({ ...sintomas0(), esf: 2, urg: 3 }, sinCtx, iciq11, catalogo);
  assert.equal(r.perfil, 'MIXTA');
  assert.equal(r.predominio, 'URGENCIA');
  const empate = clasificar({ ...sintomas0(), esf: 2, urg: 2 }, sinCtx, iciq11, catalogo);
  assert.equal(empate.predominio, 'ESFUERZO', 'empate → ESFUERZO');
});

test('rf04_dolorDomina', () => {
  const r = clasificar({ esf: 3, urg: 3, frec: 3, fec: 3, prol: 3, dol: 2, vac: 0 }, sinCtx, iciq11, catalogo);
  assert.equal(r.perfil, 'DOLOR_HIPERTONIA');
  assert.equal(r.derivar, true);
  assert.ok(r.mensajesDerivacion.some((m) => /valoración/.test(m)));
});

test('rf04_prolapsoDeriva', () => {
  const r = clasificar({ ...sintomas0(), prol: 3, esf: 2 }, sinCtx, { q1: 1, q2: 2, q3: 1 }, catalogo);
  assert.equal(r.perfil, 'PROLAPSO');
  assert.equal(r.derivar, true);
  const p2 = clasificar({ ...sintomas0(), prol: 2 }, sinCtx, { q1: 0, q2: 0, q3: 0 }, catalogo);
  assert.equal(p2.perfil, 'PREVENCION', 'prol = 2 no alcanza el umbral del catálogo (≥ 3)');
});

test('rf04_prevencion', () => {
  const r = clasificar(sintomas0(), sinCtx, { q1: 0, q2: 0, q3: 0 }, catalogo);
  assert.equal(r.perfil, 'PREVENCION');
  assert.equal(r.derivar, false);
  assert.equal(clasificar(sintomas0(), { ctxPostparto: true }, { q1: 0, q2: 0, q3: 0 }, catalogo).perfil, 'POSTPARTO');
});

test('rf04_otrasReglas_urgenciaFecalDerivarSeveridad', () => {
  assert.equal(clasificar({ ...sintomas0(), urg: 2 }, sinCtx, iciq11, catalogo).perfil, 'URGENCIA');
  assert.equal(clasificar({ ...sintomas0(), frec: 2 }, sinCtx, iciq11, catalogo).perfil, 'URGENCIA');
  const fec = clasificar({ ...sintomas0(), fec: 2, esf: 3 }, sinCtx, iciq11, catalogo);
  assert.equal(fec.perfil, 'FECAL');
  assert.equal(fec.derivar, true);
  const severa = clasificar({ ...sintomas0(), esf: 3 }, sinCtx, { q1: 4, q2: 4, q3: 8 }, catalogo);
  assert.equal(severa.severidad, 'severa');
  assert.equal(severa.derivar, true);
  const vac = clasificar({ ...sintomas0(), esf: 3, vac: 2 }, sinCtx, iciq11, catalogo);
  assert.equal(vac.derivar, true);
  assert.ok(vac.reglasAplicadas.some((x) => /vac >= 2/.test(x)));
  // Acepta el resultado ya calculado de puntajeIciq.
  const pre = puntajeIciq(iciq11, catalogo);
  assert.equal(clasificar({ ...sintomas0(), esf: 3 }, null, pre, catalogo).iciqTotal, 11);
});

test('rf04_negativo_respuestasIncompletas', () => {
  assert.throws(() => clasificar({}, sinCtx, iciq11, catalogo), /Faltan respuestas/);
  assert.throws(() => clasificar({ ...sintomas0(), esf: 4 }, sinCtx, iciq11, catalogo), /esf/);
  assert.throws(() => clasificar(null, sinCtx, iciq11, catalogo), RangeError);
  assert.throws(() => clasificar(sintomas0(), sinCtx, { q1: 9 }, catalogo), RangeError);
});
