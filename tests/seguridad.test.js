import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarSeguridad, seguridadVigente, puedeIniciarEST, banderaRojaActiva } from '../js/engine/seguridad.js';
import { generarPlan } from '../js/engine/planificador.js';
import { catalogo, respuestasSeguridad, equipoVaginalEMG, todasLasEntradas } from './ayuda.js';

test('rf02a_embarazoBloqueaEST', () => {
  const ev = evaluarSeguridad(respuestasSeguridad(['CI-EMBARAZO']), catalogo, '2026-11-03');
  assert.equal(ev.contraindicacionEST, true);
  assert.equal(ev.contraindicaciones[0].id, 'CI-EMBARAZO');
  assert.match(ev.mensajes[0], /Consulta con tu profesional antes de usar el equipo/);
  const plan = generarPlan({ perfil: 'IUE', nivel: 2, seguridad: ev, equipo: equipoVaginalEMG(), fechaInicio: '2026-11-02' }, catalogo);
  const conCorriente = todasLasEntradas(plan).filter((e) => /^(EST|TENS)-/.test(e.tipo));
  assert.equal(conCorriente.length, 0, 'ninguna sesión EST-*/TENS-* en el plan');
  assert.equal(puedeIniciarEST({ evaluacion: ev, hoy: '2026-11-03', catalogo }).ok, false);
});

test('rf02b_hematuriaBanderaRoja', () => {
  const ev = evaluarSeguridad(respuestasSeguridad(['BR-HEMATURIA']), catalogo, '2026-11-03');
  assert.equal(ev.contraindicacionEST, false);
  assert.equal(ev.banderasRojas.length, 1);
  assert.equal(banderaRojaActiva(ev), true);
  assert.match(ev.mensajes.join(' '), /evaluación médica antes de continuar/);
  const plan = generarPlan({ perfil: 'IUE', nivel: 2, seguridad: ev, equipo: equipoVaginalEMG(), fechaInicio: '2026-11-02' }, catalogo);
  const tipos = new Set(todasLasEntradas(plan).map((e) => e.tipo).filter((t) => !t.startsWith('REEVAL-')));
  for (const t of tipos) assert.ok(['PFMT-CONCIENCIA', 'RELAJ-RESP', 'HAB-SEMANAL'].includes(t), `tipo no permitido con bandera roja: ${t}`);
  assert.ok(tipos.size > 0, 'el plan se genera igualmente');
  for (const s of plan.semanas) for (const l of Object.values(s.dias)) assert.ok(l.length > 0, 'ningún día vacío');
  assert.equal(puedeIniciarEST({ evaluacion: ev, hoy: '2026-11-03' }).codigo, 'bandera-roja');
  // Tras marcar "ya consulté" deja de bloquear.
  assert.equal(puedeIniciarEST({ evaluacion: { ...ev, consultada: true }, hoy: '2026-11-03' }).ok, true);
});

test('rf02c_vigencia90dias', () => {
  const ev = evaluarSeguridad(respuestasSeguridad(), catalogo, '2026-08-05');
  assert.equal(seguridadVigente(ev, '2026-11-03'), true); // 90 días exactos: vigente
  assert.equal(seguridadVigente(ev, '2026-11-04'), false); // 91 días: vencida
  assert.equal(seguridadVigente(ev, '2026-11-04', catalogo.seguridad.vigenciaDias), false);
  assert.equal(seguridadVigente(null, '2026-11-04'), false);
  assert.equal(seguridadVigente(ev, '2026-08-04'), false, 'fecha futura no cuenta como vigente');
  const r = puedeIniciarEST({ evaluacion: ev, hoy: '2026-11-04', catalogo });
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'vencida');
  assert.match(r.motivo, /más de 90 días/);
});

test('rnf08_noIniciaESTconContraindicacion', () => {
  for (const ci of catalogo.seguridad.contraindicacionesAbsolutas) {
    const ev = evaluarSeguridad(respuestasSeguridad([ci.id]), catalogo, '2026-11-03');
    const r = puedeIniciarEST({ evaluacion: ev, hoy: '2026-11-03', checklistConfirmado: true, catalogo });
    assert.equal(r.ok, false, ci.id);
    assert.equal(r.codigo, 'contraindicacion');
  }
  const limpia = evaluarSeguridad(respuestasSeguridad(), catalogo, '2026-11-03');
  assert.equal(puedeIniciarEST({ evaluacion: limpia, hoy: '2026-11-03', checklistConfirmado: true }).ok, true);
  assert.equal(puedeIniciarEST({ evaluacion: limpia, hoy: '2026-11-03', checklistConfirmado: false }).codigo, 'checklist');
});

test('rnf08_negativo_respuestasVaciasOIncompletas', () => {
  const vacia = evaluarSeguridad({}, catalogo, '2026-11-03');
  assert.equal(vacia.completa, false);
  assert.equal(vacia.contraindicacionEST, true, 'sin responder = no descartado (conservador)');
  assert.equal(puedeIniciarEST({ evaluacion: vacia, hoy: '2026-11-03' }).codigo, 'incompleta');
  const parcial = respuestasSeguridad();
  delete parcial['PR-DIU'];
  const ev = evaluarSeguridad(parcial, catalogo, '2026-11-03');
  assert.deepEqual(ev.faltantes, ['PR-DIU']);
  assert.equal(ev.contraindicacionEST, false);
  assert.equal(puedeIniciarEST({ evaluacion: ev, hoy: '2026-11-03' }).ok, false);
  assert.equal(puedeIniciarEST({}).codigo, 'sin-evaluacion');
  assert.equal(puedeIniciarEST(undefined).ok, false);
  assert.equal(evaluarSeguridad(null, catalogo, '2026-11-03').completa, false);
});

test('rf02_precaucionesConMensaje', () => {
  const ev = evaluarSeguridad(respuestasSeguridad(['PR-EPILEPSIA', 'PR-DIU']), catalogo, '2026-11-03');
  assert.equal(ev.contraindicacionEST, false);
  assert.deepEqual(ev.precauciones.map((p) => p.id), ['PR-EPILEPSIA', 'PR-DIU']);
  assert.ok(ev.precauciones.every((p) => p.mensaje.length > 10));
  assert.equal(puedeIniciarEST({ evaluacion: ev, hoy: '2026-11-03' }).ok, true);
});
