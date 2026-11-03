import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumen } from '../js/engine/reporte.js';
import { cargarDemo, configurarAlmacen, almacenMemoria } from '../js/store/repo.js';
import { catalogo } from './ayuda.js';

function demo() {
  configurarAlmacen(almacenMemoria());
  return cargarDemo(catalogo, '2026-11-03');
}

test('rf13_adherenciaSemanal', () => {
  const e = demo();
  const r = resumen(e, catalogo);
  assert.equal(r.adherenciaPorSemana.length, 5, 'semanas 1..5 (actual)');
  const ej = catalogo.casoEjemplo.semanasEjemplo;
  for (const s of ej) {
    const a = r.adherenciaPorSemana[s.semana - 1];
    assert.equal(a.planificadas, s.planificadas, `planificadas semana ${s.semana}`);
    assert.equal(a.hechas, s.hechas, `hechas semana ${s.semana}`);
  }
  assert.equal(r.adherenciaGlobal, 50 / 56, 'solo semanas terminadas (1–4)');
  assert.match(r.texto, /50 de 56 sesiones planificadas en semanas terminadas/);
  assert.match(r.texto, /Adherencia global/);
  assert.match(r.texto, /Incontinencia urinaria de esfuerzo/);
});

test('rf13_seriesEF', () => {
  const r = resumen(demo(), catalogo);
  assert.deepEqual(r.series.E.map((x) => x.valor), [4, 5, 6]);
  assert.deepEqual(r.series.F.map((x) => x.valor), [4, 5, 7]);
  assert.deepEqual(r.series.ICIQ.map((x) => x.valor), [11, 8]);
  assert.ok(r.series.mA.length > 0);
  assert.ok(r.series.mA.every((x) => /^\d{4}-\d{2}-\d{2}/.test(x.fecha)));
  assert.deepEqual([...new Set(r.series.mA.map((x) => x.valor))], [28, 31, 33, 35]);
  for (const s of ['E', 'F', 'ICIQ', 'mA']) {
    const f = r.series[s].map((x) => x.fecha);
    assert.deepEqual(f, [...f].sort(), `${s} en orden de fecha`);
  }
  assert.match(r.texto, /ICIQ-UI SF: de 11/);
  assert.match(r.texto, /mA/);
});

test('rf13_resumenVacio_y_cambios', () => {
  const r = resumen({}, null);
  assert.deepEqual(r.adherenciaPorSemana, []);
  assert.equal(r.adherenciaGlobal, 0);
  assert.equal(r.nivelActual, null);
  const r2 = resumen({ evaluaciones: [{ fecha: '2026-01-01', iciq: { total: 5 }, eva: 3 }],
    cambiosNivel: [{ fecha: '2026-02-01', nivelDesde: 2, nivelHasta: 3, motivo: 'm' }] });
  assert.match(r2.texto, /ICIQ-UI SF inicial: 5/);
  assert.match(r2.texto, /Cambio de nivel 2 → 3/);
  assert.equal(r2.series.EVA[0].valor, 3);
});
