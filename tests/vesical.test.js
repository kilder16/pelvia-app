import { test } from 'node:test';
import assert from 'node:assert/strict';
import { intervaloMedio, intervaloObjetivo, intervalosDelDia, resumenDia } from '../js/engine/vesical.js';
import { catalogo } from './ayuda.js';

test('rf15_intervaloObjetivo_90a105', () => {
  assert.equal(intervaloObjetivo(90, 0, catalogo), 90);
  assert.equal(intervaloObjetivo(90, 1, catalogo), 105);
  assert.equal(intervaloObjetivo(90, 6, catalogo), 180);
  // Diario de 3 días con horas (datos ficticios): intervalos de 90 min.
  const dia = (f) => ({ fecha: f, micciones: ['07:00', '08:30', '10:00', '11:30'] });
  const medio = intervaloMedio([dia('2026-11-01'), dia('2026-11-02'), dia('2026-11-03')]);
  assert.equal(medio, 90);
  assert.equal(intervaloObjetivo(medio, 1, catalogo), 105);
});

test('rf15_tope240', () => {
  assert.equal(intervaloObjetivo(90, 10, catalogo), 240);
  assert.equal(intervaloObjetivo(90, 12, catalogo), 240);
  assert.equal(intervaloObjetivo(230, 1), 240, 'sin catálogo usa los valores por defecto');
  assert.equal(intervaloObjetivo(null, 1, catalogo), null);
  assert.equal(intervaloObjetivo(0, 1, catalogo), null);
});

test('rf15_diario_bordes', () => {
  assert.equal(intervaloMedio([]), null);
  assert.equal(intervaloMedio(null), null);
  assert.equal(intervaloMedio([{ intervaloMedioMin: 80 }, { intervaloMedioMin: 100 }]), 90);
  assert.deepEqual(intervalosDelDia(['10:00', '07:00', '07:05', '08:00']), [55, 120], 'ordena y descarta < 10 min');
  assert.deepEqual(intervalosDelDia(['2026-11-03T07:00:00', '2026-11-03T09:00:00']), [120]);
  assert.throws(() => intervalosDelDia(['mañana']), RangeError);
  const r = resumenDia('2026-11-03', [
    { tipo: 'miccion', hora: '07:00' }, { tipo: 'miccion', hora: '09:00' }, { tipo: 'urgencia', hora: '08:30' }, { tipo: 'escape', hora: '08:40' },
  ]);
  assert.deepEqual(r, { fecha: '2026-11-03', micciones: 2, urgencias: 1, escapes: 1, intervaloMedioMin: 120 });
  assert.equal(resumenDia('2026-11-03', []).intervaloMedioMin, null);
});
