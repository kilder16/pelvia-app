import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equipoDesdeConocido, sondasBase } from '../js/ui/vistas/equipo.js';
import { generarPlan } from '../js/engine/planificador.js';
import { catalogo, seguridadLimpia, todasLasEntradas } from './ayuda.js';

test('rf17_tenscareElise_mapeo', () => {
  const eq = equipoDesdeConocido(catalogo, 'TensCare', 'Elise');
  assert.equal(eq.marca, 'TensCare');
  assert.equal(eq.modelo, 'Elise');
  assert.equal(eq.tipoSonda, 'vaginal');
  assert.equal(eq.tieneEstimulacion, true);
  const nombre = (tipo) => catalogo.equivalenciaEquipo(tipo, eq);
  assert.match(nombre('EST-IUE'), /STRESS/);
  assert.equal(nombre('EST-URG'), 'URGE');
  assert.equal(nombre('EST-MIX'), 'MIXED');
  assert.equal(nombre('EST-TONO'), 'TONE');
  assert.deepEqual(sondasBase(catalogo.equipoConocido('TensCare')), ['vaginal']);
  assert.throws(() => equipoDesdeConocido(catalogo, 'Nadie', 'X'), /no encontrado/);
});

test('rf17_tiposDeEquipo_recalculanPlan', () => {
  // Globus: los mapeos a texto libre ("ajuste manual según ficha") no se guardan como programa.
  const g = equipoDesdeConocido(catalogo, 'Globus', 'Genesy S2');
  assert.ok(Object.values(g.programas).every((t) => catalogo.tipoSesion(t)));
  // Innovo: fija parámetros, sin ficha.
  const inn = equipoDesdeConocido(catalogo, 'Innovo (Atlantic Therapeutics)', 'Innovo shorts');
  assert.equal(inn.aplicaFicha, false);
  assert.equal(inn.parametrosFijos.anchoPulsoUs, 620);
  // Sensor sin estimulación: el plan no lleva EST-*.
  const elvie = equipoDesdeConocido(catalogo, 'Biofeedback Bluetooth sin estimulación', 'Elvie Trainer');
  assert.equal(elvie.tieneEstimulacion, false);
  const plan = generarPlan({ perfil: 'IUE', nivel: 2, seguridad: seguridadLimpia(), equipo: elvie, fechaInicio: '2026-11-02' }, catalogo);
  assert.ok(!todasLasEntradas(plan).some((e) => /^(EST|TENS)-/.test(e.tipo)));
  // Elecciones de la usuaria prevalecen.
  const nt = equipoDesdeConocido(catalogo, 'NeuroTrac (Verity Medical)', 'Simplex', { tieneEMG: false, sondas: ['vaginal', 'anal'] });
  assert.equal(nt.tieneEMG, false);
  assert.deepEqual(nt.sondas, ['vaginal', 'anal']);
});

test('rf17_v2_diezFamiliasYEquipoNoIdentificado', () => {
  assert.equal(catalogo.equiposConocidos.length, 10);
  assert.match(catalogo.equipoNoIdentificado, /Genérico EMS\/TENS digital con sonda/);
  const tiposValidos = new Set(catalogo.tiposEquipo().map((t) => t.id));
  for (const c of catalogo.equiposConocidos) {
    assert.ok(tiposValidos.has(c.tipo), `${c.marca}: tipo ${c.tipo} existe en tiposEquipo`);
    const eq = equipoDesdeConocido(catalogo, c.marca, c.modelos[0]);
    assert.equal(typeof eq.tieneEstimulacion, 'boolean', c.marca);
    assert.equal(typeof eq.aplicaFicha, 'boolean', c.marca);
    assert.ok(Object.values(eq.programas).every((t) => catalogo.tipoSesion(t)), `${c.marca}: solo mapeos a tipos válidos`);
    if (c.parametrosFijos) assert.equal(eq.aplicaFicha, false, `${c.marca}: con parámetros fijos no aplica ficha`);
  }
});

test('rf17_v2_tipoFijaValoresPorDefecto_usuariaCorrige', () => {
  // Valores por defecto desde tiposEquipo.
  const sensor = catalogo.resolverEquipo({ tipo: 'biofeedback-presion' });
  assert.deepEqual([sensor.tieneEstimulacion, sensor.tieneEMG, sensor.aplicaFicha], [false, false, false]);
  const externo = catalogo.resolverEquipo({ tipo: 'estimulacion-externa' });
  assert.deepEqual([externo.tieneEstimulacion, externo.aplicaFicha], [true, false]);
  // La usuaria corrige en "Mi equipo": lo explícito prevalece.
  const corregido = catalogo.resolverEquipo({ tipo: 'estimulador-sonda', tieneEstimulacion: false });
  assert.equal(corregido.tieneEstimulacion, false);
  const plan = generarPlan({ perfil: 'IUE', nivel: 2, seguridad: seguridadLimpia(), equipo: { ...corregido, tipoSonda: 'vaginal' }, fechaInicio: '2026-11-02' }, catalogo);
  assert.ok(!todasLasEntradas(plan).some((e) => /^(EST|TENS)-/.test(e.tipo)), 'tieneEstimulacion = false → reemplazoSinEST');
  assert.ok(plan.reglasAplicadas.some((r) => r.startsWith('reemplazoSinEST (equipo sin estimulación): EST-IUE')));
  assert.match(plan.motivo, /no electroestimula/);
});
