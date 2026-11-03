import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  semanaIso, semanaDelPlan, diaSemana, lunesDe, fechaDePlan, diasEntre, claveSemanaIso, mmss, aISO, formatoCorto, sumarDias, hoyISO,
} from '../js/util/fechas.js';

test('rf12_semanaIso_diaPlan', () => {
  // 2026-11-03 es martes de la semana ISO 45.
  assert.deepEqual(semanaIso('2026-11-03'), { anio: 2026, semana: 45 });
  assert.equal(claveSemanaIso('2026-11-03'), '2026-W45');
  assert.equal(diaSemana('2026-11-03'), 'M');
  assert.equal(diaSemana('2026-11-08'), 'D');
  assert.equal(lunesDe('2026-11-08'), '2026-11-02');
  // Plan iniciado el miércoles 2026-10-07: semana 1 = la semana ISO de ese día.
  assert.equal(semanaDelPlan('2026-10-07', '2026-10-05'), 1);
  assert.equal(semanaDelPlan('2026-10-07', '2026-10-12'), 2);
  assert.equal(semanaDelPlan('2026-10-07', '2026-11-03'), 5);
  assert.equal(fechaDePlan('2026-10-07', 5, 'M'), '2026-11-03');
  // Bordes: cambio de año ISO.
  assert.deepEqual(semanaIso('2027-01-01'), { anio: 2026, semana: 53 });
  assert.deepEqual(semanaIso('2025-12-29'), { anio: 2026, semana: 1 });
});

test('rf12_utilidades_bordes', () => {
  assert.equal(diasEntre('2026-03-28', '2026-03-30'), 2);
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(aISO(new Date(2026, 0, 5)), '2026-01-05');
  assert.match(hoyISO(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(mmss(1025), '17:05');
  assert.equal(mmss(-3), '00:00');
  assert.equal(formatoCorto('2026-11-03'), 'mar 3 nov 2026');
  assert.throws(() => aISO('ayer'), /Fecha inválida/);
  assert.throws(() => aISO(42), /Fecha inválida/);
});
