import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  configurarAlmacen, almacenMemoria, leer, guardar, migrar, restablecer, cargarDemo, esDemo, clavesPresentes,
  guardarSesion, marcarEntrada, ajustes, guardarAjustes, ESQUEMA, APP_VERSION, migrarEstado,
} from '../js/store/repo.js';
import { catalogo } from './ayuda.js';

let mem;
beforeEach(() => {
  mem = almacenMemoria();
  configurarAlmacen(mem);
});

test('rf16_cargaDemoConEtiqueta', () => {
  const e = cargarDemo(catalogo, '2026-11-03');
  assert.equal(e.perfil.demo, true);
  assert.equal(e.perfil.etiqueta, 'DEMO — datos ficticios');
  assert.equal(esDemo(), true);
  const esperado = catalogo.casoEjemplo.resultadoEsperado;
  const ev0 = e.evaluaciones[0];
  assert.equal(ev0.resultado.perfil, esperado.perfil);
  assert.equal(ev0.resultado.severidad, esperado.severidad);
  assert.equal(ev0.resultado.derivar, esperado.derivar);
  assert.equal(ev0.seguridad.contraindicacionEST, esperado.contraindicacionEST);
  assert.equal(ev0.resultado.nivel, esperado.nivelInicial);
  assert.equal(ev0.resultado.motivoNivel, esperado.motivoNivel);
  assert.equal(e.plan.programaId, esperado.programa);
  assert.equal(e.plan.semanaActual, 5, '4 semanas de datos → hoy es la semana 5');
  assert.equal(e.plan.fechaInicio, '2026-10-05');
  const semanas = new Set(e.sesiones.map((s) => s.semana));
  assert.deepEqual([...semanas].sort(), [1, 2, 3, 4]);
  assert.ok(e.sesiones.every((s) => s.demo === true));
  assert.equal(e.evaluaciones.length, 3, 'inicial + semanas 2 y 4');
  // Catálogo 1.0.1: E = 6 en las semanas 2 y 4 → el motor real sube a nivel 3 al cerrar la semana 4.
  assert.equal(e.plan.nivelActual, catalogo.casoEjemplo.semanasEjemplo[3].nivel);
  assert.equal(e.plan.nivelActual, 3);
  const cambio = e.cambiosNivel.find((c) => c.nivelDesde === 2 && c.nivelHasta === 3);
  assert.ok(cambio, 'cambio 2 → 3 registrado');
  assert.equal(cambio.semana, 4);
  assert.ok(e.plan.semanas[0].dias.L.some((x) => x.estado === 'hecha'));
  // Fechas desplazadas: otro "hoy" mantiene la semana 5.
  configurarAlmacen(almacenMemoria());
  assert.equal(cargarDemo(catalogo, '2027-03-10').plan.semanaActual, 5);
});

test('rf16_restablecerBorraTodo', () => {
  cargarDemo(catalogo, '2026-11-03');
  mem.setItem('otra-app', 'x');
  assert.ok(clavesPresentes().length >= 8);
  restablecer();
  assert.deepEqual(clavesPresentes(), []);
  assert.equal(leer('perfil'), null);
  assert.equal(esDemo(), false);
  assert.equal(mem.getItem('otra-app'), 'x', 'no toca claves ajenas');
});

test('rf16_store_leerGuardarMigrar', () => {
  assert.deepEqual(migrar(), { desde: null, hasta: ESQUEMA });
  assert.deepEqual(leer('meta'), { esquema: ESQUEMA, app: APP_VERSION });
  assert.equal(ajustes().vibracion, true);
  guardarAjustes({ sonido: false });
  assert.equal(ajustes().sonido, false);
  assert.deepEqual(migrar(), { desde: 1, hasta: 1 });
  guardar('perfil', { alias: 'x' });
  assert.deepEqual(leer('pelvia.perfil'), { alias: 'x' });
  guardar('perfil', null);
  assert.equal(leer('perfil'), null);
  assert.throws(() => guardar('desconocida', 1), /Clave desconocida/);
  mem.setItem('pelvia.plan', '{roto');
  assert.equal(leer('plan', 'def'), 'def', 'JSON dañado → valor por defecto');
  guardar('meta', { esquema: 99 });
  assert.throws(() => migrar(), /más nueva/);
  assert.deepEqual(migrarEstado({ a: 1 }, 0), { a: 1 });
});

test('rf12_guardarSesion_marcaHecha', () => {
  cargarDemo(catalogo, '2026-11-03');
  const plan = leer('plan');
  const ent = plan.semanas[4].dias.M[0];
  assert.equal(ent.estado, 'pendiente');
  const s = guardarSesion({ fecha: '2026-11-03T10:00:00', semana: 5, dia: 'M', tipoSesionId: ent.tipo, completada: true });
  assert.ok(s.id);
  const p2 = leer('plan');
  assert.equal(p2.semanas[4].dias.M[0].estado, 'hecha', 'al completar, el estado cambia a "hecha"');
  assert.equal(p2.semanas[4].dias.M[0].sesionId, s.id);
  guardarSesion({ semana: 5, dia: 'M', tipoSesionId: 'X', completada: false });
  assert.equal(leer('sesiones').at(-1).completada, false);
  assert.equal(marcarEntrada(5, 'D', 'HAB-SEMANAL'), true);
  assert.equal(marcarEntrada(5, 'D', 'NADA'), false);
});
