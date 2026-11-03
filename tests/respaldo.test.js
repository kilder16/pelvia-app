import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { configurarAlmacen, almacenMemoria, cargarDemo, estadoCompleto, leer } from '../js/store/repo.js';
import { exportar, importar, nombreRespaldo, validarRespaldo } from '../js/store/respaldo.js';
import { catalogo } from './ayuda.js';

beforeEach(() => configurarAlmacen(almacenMemoria()));

test('rf18_exportImportIdentico', async () => {
  cargarDemo(catalogo, '2026-11-03');
  const { nombre, blob, json } = exportar(new Date(2026, 10, 3));
  assert.equal(nombre, 'pelvia-respaldo-2026-11-03.json');
  assert.equal(nombreRespaldo('2026-01-09'), 'pelvia-respaldo-2026-01-09.json');
  assert.equal(blob.type, 'application/json');
  assert.equal(await blob.text(), json);
  const antes = estadoCompleto();
  // "Otra instalación": almacén vacío.
  configurarAlmacen(almacenMemoria());
  assert.equal(leer('perfil'), null);
  const r = importar(json);
  assert.equal(r.ok, true);
  const despues = estadoCompleto();
  for (const k of ['perfil', 'equipo', 'evaluaciones', 'plan', 'sesiones', 'cambiosNivel', 'diario', 'ajustes']) {
    assert.deepEqual(despues[k], antes[k], k);
  }
  assert.equal(despues.meta.esquema, 1);
  // También acepta el objeto ya parseado.
  assert.equal(importar(JSON.parse(json)).ok, true);
});

test('rf18_rechazaSinMeta', () => {
  cargarDemo(catalogo, '2026-11-03');
  const antes = estadoCompleto();
  assert.throws(() => importar(JSON.stringify({ datos: { perfil: {} } })), /meta\.esquema/);
  assert.throws(() => importar('{esto no es json'), /JSON dañado/);
  assert.throws(() => importar('[]'), /no es un respaldo/);
  assert.throws(() => importar('null'), /no es un respaldo/);
  assert.throws(() => importar({ meta: { esquema: 5 }, datos: {} }), /más nueva/);
  assert.throws(() => importar({ meta: { esquema: 1 } }), /no contiene datos/);
  assert.throws(() => importar({ meta: { esquema: 1 }, datos: { hackeo: 1 } }), /claves desconocidas/);
  assert.throws(() => importar({ meta: { esquema: 1 }, datos: { sesiones: 'x' } }), /sesiones/);
  assert.throws(() => validarRespaldo({ meta: { esquema: 1 }, datos: { evaluaciones: {} } }), /evaluaciones/);
  assert.deepEqual(estadoCompleto(), antes, 'un archivo corrupto no borra nada');
});
