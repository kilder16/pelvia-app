import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nivelInicial } from '../js/engine/nivel.js';
import { generarPlan } from '../js/engine/planificador.js';
import { catalogo, seguridadLimpia, equipoVaginalEMG } from './ayuda.js';

test('rf05_p2e4r6f4_nivel2', () => {
  const r = nivelInicial({ P: 2, E: 4, R: 6, F: 4 }, catalogo);
  assert.equal(r.nivel, 2);
  assert.equal(r.motivo, 'Sostén de 3 a 5 segundos.');
  assert.equal(r.motivo, catalogo.casoEjemplo.resultadoEsperado.motivoNivel);
});

test('rf05_p1_nivel0', () => {
  for (const P of [0, 1]) assert.equal(nivelInicial({ P, E: 10, R: 10, F: 10 }, catalogo).nivel, 0);
  const n = nivelInicial({ P: 1, E: 2, R: 2, F: 2 }, catalogo).nivel;
  const plan = generarPlan({ perfil: 'IUE', nivel: n, seguridad: seguridadLimpia(), equipo: equipoVaginalEMG(), fechaInicio: '2026-11-02' }, catalogo);
  const tipos = plan.semanas[0].dias.L.map((e) => e.tipo);
  assert.ok(tipos.includes('EST-SENS'), `sin contraindicación el plan incluye EST-SENS (L: ${tipos})`);
});

test('rf05_maximoInicial4', () => {
  const r = nivelInicial({ P: 5, E: 10, R: 10, F: 10 }, catalogo);
  assert.equal(r.nivel, 4);
  assert.ok(r.nivel <= catalogo.autoevaluacionFuerza.reglasNivel.nivelMaximoInicial);
  assert.equal(nivelInicial({ P: 3, E: 2, R: 5, F: 5 }, catalogo).nivel, 1);
  assert.equal(nivelInicial({ P: 4, E: 7, R: 8, F: 8 }, catalogo).nivel, 3);
  assert.equal(nivelInicial({ P: 3, E: 9, R: 9, F: 10 }, catalogo).nivel, 3, 'P < 4 → 3');
  assert.equal(nivelInicial({ P: 4, E: 9, R: 7, F: 10 }, catalogo).nivel, 3, 'R < 8 → 3');
  // Catálogo 1.0.1: P ≤ 2 (aprieta sin elevar) limita el nivel inicial a 2.
  assert.equal(nivelInicial({ P: 2, E: 7, R: 8, F: 6 }, catalogo).nivel, 2);
  const fuerte = nivelInicial({ P: 2, E: 10, R: 10, F: 10 }, catalogo);
  assert.equal(fuerte.nivel, 2);
  assert.match(fuerte.motivo, /aprieta sin elevar/);
});

test('rf05_negativo_valoresFueraDeRango', () => {
  assert.throws(() => nivelInicial({ P: 6, E: 4, R: 6, F: 4 }, catalogo), RangeError);
  assert.throws(() => nivelInicial({ P: 2, E: -1, R: 6, F: 4 }, catalogo), RangeError);
  assert.throws(() => nivelInicial({ P: 2, E: 4, R: 6 }, catalogo), /F/);
  assert.throws(() => nivelInicial({}, catalogo), RangeError);
  assert.throws(() => nivelInicial(null, catalogo), RangeError);
});
