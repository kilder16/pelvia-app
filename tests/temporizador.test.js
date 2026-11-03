import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearTemporizador, cortesAcumulados, estadoEn } from '../js/ui/componentes/temporizador.js';
import { construirLineaTiempo } from '../js/engine/sesion.js';
import { catalogo } from './ayuda.js';

/** Reloj controlable en milisegundos. */
function reloj() {
  let ms = 1000;
  return { ahora: () => ms, avanzar: (s) => { ms += s * 1000; }, fijar: (s) => { ms = 1000 + s * 1000; } };
}
const sinBucle = { programar: () => 0, cancelar: () => {}, avisar: () => {}, escucharVisibilidad: false };
const lineaEST = () => construirLineaTiempo('EST-IUE', { nivel: 2, semana: 3 }, catalogo); // 5/10 × 20 min

test('rf08_temporizadorFaseEnT12_3', () => {
  const lt = lineaEST();
  assert.equal(lt.fases.length, 160);
  const r = reloj();
  const t = crearTemporizador({ fases: lt.fases, ahora: r.ahora, ...sinBucle });
  t.iniciar();
  r.avanzar(12.3);
  const e = t.actualizar();
  assert.equal(e.fase.nombre, 'RELAJA');
  assert.equal(e.fase.ciclo, 1);
  assert.ok(Math.abs(e.restanteFase - 2.7) < 1e-9);
});

test('rf08_temporizadorSinDesfase', () => {
  const lt = lineaEST();
  const cortes = cortesAcumulados(lt.fases);
  assert.equal(cortes[cortes.length - 1], 1200);
  // Tras 79 ciclos completos (1185 s) empieza exactamente el CONTRAE del ciclo 80.
  assert.equal(estadoEn(lt.fases, cortes, 1184.999).fase.nombre, 'RELAJA');
  assert.equal(estadoEn(lt.fases, cortes, 1185).fase.nombre, 'CONTRAE');
  assert.equal(estadoEn(lt.fases, cortes, 1185).fase.ciclo, 80);
  assert.equal(estadoEn(lt.fases, cortes, 1190).fase.nombre, 'RELAJA');
  assert.equal(estadoEn(lt.fases, cortes, 1200).terminado, true);

  // Ticks irregulares (8–40 ms, como rAF con tirones): cada cambio de fase se detecta < 100 ms tarde.
  const r = reloj();
  const cambios = [];
  let fin = null;
  const t = crearTemporizador({
    fases: lt.fases, ahora: r.ahora, ...sinBucle,
    alCambiarFase: (e) => cambios.push({ indice: e.indice, t: e.t }),
    alTerminar: (e) => { fin = e; },
  });
  t.iniciar();
  let semilla = 7;
  while (!fin) {
    semilla = (semilla * 1103515245 + 12345) % 2147483648;
    r.avanzar((8 + (semilla % 33)) / 1000);
    t.actualizar();
  }
  assert.equal(cambios.length, 160);
  for (const c of cambios) {
    const ideal = c.indice > 0 ? cortes[c.indice - 1] : 0;
    assert.ok(c.t - ideal < 0.1, `fase ${c.indice}: desfase ${(c.t - ideal).toFixed(3)} s`);
  }
});

test('rf08_temporizadorPausaNoPierdeTiempo', () => {
  const lt = lineaEST();
  const r = reloj();
  const t = crearTemporizador({ fases: lt.fases, ahora: r.ahora, ...sinBucle });
  t.iniciar();
  r.avanzar(3);
  t.pausar();
  r.avanzar(100); // pausa larga
  assert.ok(Math.abs(t.estado().t - 3) < 1e-9);
  t.reanudar();
  r.avanzar(9.3);
  const e = t.actualizar();
  assert.equal(e.fase.nombre, 'RELAJA');
  assert.equal(e.fase.ciclo, 1);
  // Vuelta de segundo plano: 10 min sin ticks → la fase se recalcula del reloj real.
  r.avanzar(600);
  const e2 = t.actualizar();
  assert.ok(Math.abs(e2.t - 612.3) < 1e-6);
  assert.equal(e2.fase.ciclo, Math.floor(612.3 / 15) + 1);
});

test('rf08_temporizadorPausaAutomaticaCambioPrograma', () => {
  const lt = construirLineaTiempo('EST-MIX', { nivel: 2, semana: 1 }, catalogo);
  const idx = lt.fases.findIndex((f) => f.nombre === 'CAMBIO_PROGRAMA');
  assert.ok(idx > 0);
  const inicioCambio = cortesAcumulados(lt.fases)[idx - 1];
  const r = reloj();
  const t = crearTemporizador({ fases: lt.fases, ahora: r.ahora, ...sinBucle });
  t.iniciar();
  r.fijar(inicioCambio + 4); // llega tarde al tick
  const e = t.actualizar();
  assert.equal(e.fase.nombre, 'CAMBIO_PROGRAMA');
  assert.equal(e.pausado, true);
  assert.equal(e.pausaAuto, true);
  r.avanzar(120);
  assert.ok(Math.abs(t.estado().t - inicioCambio) < 1e-9, 'congelado al inicio del cambio');
  t.saltarFase();
  const e2 = t.actualizar();
  assert.equal(e2.fase.nombre, 'CONTRAE');
  assert.equal(e2.fase.bloque, 2);
});

test('rf08_temporizadorAvisaCadaCambio', () => {
  const lt = construirLineaTiempo('PFMT-SERIE', { nivel: 2, semana: 1, series: 1 }, catalogo);
  const r = reloj();
  const avisos = [];
  const t = crearTemporizador({ fases: lt.fases, ahora: r.ahora, ...sinBucle, avisar: (f) => avisos.push(f.nombre) });
  t.iniciar();
  for (let s = 0; s < lt.totalSeg + 1; s += 0.05) { r.avanzar(0.05); t.actualizar(); }
  assert.equal(avisos.length, lt.fases.length);
  assert.equal(avisos[0], 'CONTRAE');
  assert.equal(avisos[1], 'RELAJA');
});
