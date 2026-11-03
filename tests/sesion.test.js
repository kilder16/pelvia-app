import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirLineaTiempo, registroDeSesion, ciclosEST } from '../js/engine/sesion.js';
import { catalogo } from './ayuda.js';

const cuenta = (lt, nombre) => lt.fases.filter((f) => f.nombre === nombre).length;

test('rf08_lineaTiempo_5_10_20min_80ciclos', () => {
  const lt = construirLineaTiempo('EST-IUE', { nivel: 2, semana: 3 }, catalogo);
  assert.equal(lt.modo, 'equipo');
  assert.equal(cuenta(lt, 'CONTRAE'), 80);
  assert.equal(cuenta(lt, 'RELAJA'), 80);
  assert.equal(lt.totalSeg, 20 * 60);
  assert.equal(lt.fases[0].nombre, 'CONTRAE');
  assert.equal(lt.fases[0].seg, 5);
  assert.equal(lt.fases[1].nombre, 'RELAJA');
  assert.equal(lt.fases[1].seg, 10);
  assert.match(lt.fases[0].instruccion, /sube/, 'la rampa va dentro del ON');
  assert.equal(lt.fases[0].rampaS, 1);
  assert.equal(lt.fases[159].ciclo, 80);
  assert.equal(lt.parametros.frecuenciaHz, 35);
  // Semana 1: 15 min → 60 ciclos (caso ejemplo).
  assert.equal(cuenta(construirLineaTiempo('EST-IUE', { nivel: 2, semana: 1 }, catalogo), 'CONTRAE'), 60);
  // EST-URG pasiva: la instrucción no pide contraer.
  const urg = construirLineaTiempo('EST-URG', { nivel: 2, semana: 1 }, catalogo);
  assert.equal(urg.fases[0].pasiva, true);
  assert.match(urg.fases[0].instruccion, /relájate/);
  assert.equal(ciclosEST({ onS: 0, offS: 0, duracionMin: 10 }), 0);
});

test('rf08_bloquesMix_10y10', () => {
  const lt = construirLineaTiempo('EST-MIX', { nivel: 2, semana: 1 }, catalogo);
  assert.equal(lt.bloques.length, 2);
  const cambio = lt.fases.findIndex((f) => f.nombre === 'CAMBIO_PROGRAMA');
  assert.equal(cambio, 80, '40 ciclos del bloque 1 antes del cambio');
  assert.equal(lt.fases[cambio].seg, 30);
  assert.equal(lt.fases[cambio].pausaAuto, true);
  assert.match(lt.fases[cambio].instruccion, /35 Hz/);
  assert.equal(lt.fases.filter((f) => f.bloque === 1 && f.nombre === 'CONTRAE').length, 40);
  assert.equal(lt.fases.filter((f) => f.bloque === 2 && f.nombre === 'CONTRAE').length, 40);
  assert.equal(lt.fases.find((f) => f.bloque === 1).pasiva, true);
  assert.equal(lt.fases.find((f) => f.bloque === 2 && f.nombre === 'CONTRAE').pasiva, false);
  assert.equal(lt.totalSeg, 20 * 60 + 30);
});

test('rf08_tensContinuo_y_parametrosFijos', () => {
  const t = construirLineaTiempo('TENS-ALTA', { nivel: 0, semana: 1 }, catalogo);
  assert.equal(t.modo, 'continuo');
  assert.equal(t.fases.length, 1);
  assert.equal(t.totalSeg, 25 * 60);
  assert.deepEqual(t.avisosSeg, [300, 600, 900, 1200]);
  // Equipo que fija sus parámetros (shorts externos): 5/5 × 30 min = 180 ciclos.
  const innovo = { tipo: 'estimulacion-externa', parametrosFijos: { frecuenciaHz: 50, anchoPulsoUs: 620, onS: 5, offS: 5, rampaS: 0.5, duracionMin: 30 } };
  const f = construirLineaTiempo('EST-IUE', { nivel: 2, semana: 1, equipo: innovo }, catalogo);
  assert.equal(f.parametros.fijadosPorEquipo, true);
  assert.equal(cuenta(f, 'CONTRAE'), 180);
  assert.equal(f.totalSeg, 30 * 60);
  assert.match(f.fases[0].instruccion, /0,5 s/);
  const mixFijo = construirLineaTiempo('EST-MIX', { nivel: 2, semana: 1, equipo: innovo }, catalogo);
  assert.equal(cuenta(mixFijo, 'CAMBIO_PROGRAMA'), 0, 'el equipo gestiona su programa mixto');
  // Equipo con ficha aplicable: catálogo.
  assert.equal(construirLineaTiempo('EST-IUE', { nivel: 2, semana: 1, equipo: { tipo: 'clinico' } }, catalogo).parametros.fijadosPorEquipo, undefined);
});

test('rf09_pfmtNivel2_8x5s10s_5rapidas', () => {
  const lt = construirLineaTiempo('PFMT-SERIE', { nivel: 2, semana: 1, series: 1 }, catalogo);
  const lentas = lt.fases.filter((f) => f.nombre === 'CONTRAE');
  assert.equal(lentas.length, 8);
  assert.ok(lentas.every((f) => f.seg === 5));
  assert.ok(lt.fases.filter((f) => f.nombre === 'RELAJA').every((f) => f.seg === 10));
  assert.equal(cuenta(lt, 'RAPIDA'), 5);
  assert.equal(cuenta(lt, 'DESCANSO'), 0, 'una sola serie');
  assert.equal(lt.repsPlanificadas, 13);
  assert.equal(lt.totalSeg, 8 * 15 + 5 * 2);
  assert.ok(registroDeSesion('PFMT-SERIE', catalogo).includes('repsLogradas'));
  // 3 series → 2 descansos de 60 s.
  const tres = construirLineaTiempo('PFMT-SERIE', { nivel: 2, semana: 1, series: 3 }, catalogo);
  assert.equal(tres.fases.filter((f) => f.nombre === 'DESCANSO').length, 2);
  assert.ok(tres.fases.filter((f) => f.nombre === 'DESCANSO').every((f) => f.seg === 60));
  // Por defecto, las series del nivel.
  assert.equal(construirLineaTiempo('PFMT-SERIE', { nivel: 2 }, catalogo).parametros.series, 3);
  // BIO-LENTAS: 1 serie; BIO-RESIST nivel 2: sostén metaE + 2 = 8 s.
  assert.equal(construirLineaTiempo('BIO-LENTAS', { nivel: 2 }, catalogo).parametros.series, 1);
  const res = construirLineaTiempo('BIO-RESIST', { nivel: 2 }, catalogo);
  assert.ok(res.fases.filter((f) => f.nombre === 'CONTRAE').every((f) => f.seg === 8));
  assert.equal(cuenta(res, 'CONTRAE'), 5);
  assert.equal(construirLineaTiempo('BIO-RESIST', { nivel: 9 }, catalogo).parametros.sostenS, 10, 'sin metas → sostén del nivel + 2');
  // BIO-RAPIDAS nivel 2: 2 series de 5 rápidas.
  const rap = construirLineaTiempo('BIO-RAPIDAS', { nivel: 2 }, catalogo);
  assert.equal(cuenta(rap, 'RAPIDA'), 10);
  assert.equal(cuenta(rap, 'DESCANSO'), 1);
  assert.throws(() => construirLineaTiempo('PFMT-SERIE', { nivel: 7 }, catalogo), RangeError);
  assert.throws(() => construirLineaTiempo('NO-EXISTE', {}, catalogo), /desconocido/);
});

test('rf09_bioRelaj_bloques', () => {
  const lt = construirLineaTiempo('BIO-RELAJ', { nivel: 0 }, catalogo);
  assert.equal(lt.bloques.length, 3);
  assert.equal(lt.fases[0].nombre, 'DESCANSO');
  assert.equal(lt.fases[0].seg, 60);
  assert.equal(cuenta(lt, 'INHALA'), 30);
  assert.equal(cuenta(lt, 'EXHALA'), 30);
  assert.equal(lt.totalSeg, 60 + 300 + 60);
  assert.deepEqual(registroDeSesion('BIO-RELAJ', catalogo), ['dolor', 'emgReposoUV', 'nota']);
  const post = construirLineaTiempo('RELAJ-POSTURAS', {}, catalogo);
  assert.equal(cuenta(post, 'POSTURA'), 3);
  assert.equal(post.totalSeg, 450);
  assert.equal(construirLineaTiempo('RELAJ-RESP', {}, catalogo).totalSeg, 360);
  const pc = construirLineaTiempo('PFMT-CONCIENCIA', { nivel: 0 }, catalogo);
  assert.equal(cuenta(pc, 'CONTRAE'), 10);
  assert.equal(cuenta(pc, 'DESCANSO'), 1);
});

test('rf09_otrasSesiones_y_registro', () => {
  const k = construirLineaTiempo('PFMT-KNACK', { nivel: 4 }, catalogo);
  assert.equal(cuenta(k, 'CONTRAE'), 5);
  const fun = construirLineaTiempo('PFMT-FUNCIONAL', { nivel: 5 }, catalogo);
  assert.equal(cuenta(fun, 'POSTURA'), 5);
  assert.notEqual(fun.fases.at(-1).nombre, 'DESCANSO');
  const sup = construirLineaTiempo('VES-SUPRESION', {}, catalogo);
  assert.equal(cuenta(sup, 'RAPIDA'), 15);
  assert.equal(cuenta(sup, 'CONTRAE'), 3);
  assert.equal(construirLineaTiempo('VES-DIARIO', {}, catalogo).modo, 'registro');
  assert.equal(construirLineaTiempo('HAB-SEMANAL', {}, catalogo).totalSeg, 0);
  assert.deepEqual(registroDeSesion('EST-IUE', catalogo), ['intensidadMA', 'esfuerzo', 'dolor', 'nota']);
  assert.deepEqual(registroDeSesion('BIO-LENTAS', catalogo), ['dolor', 'repsLogradas', 'emgPicoUV', 'emgReposoUV', 'nota']);
  assert.deepEqual(registroDeSesion('VES-DIARIO', catalogo), ['nota']);
  assert.deepEqual(registroDeSesion('VES-SUPRESION', catalogo), ['repsLogradas', 'dolor', 'nota']);
  assert.deepEqual(registroDeSesion('X', catalogo), ['nota']);
});
