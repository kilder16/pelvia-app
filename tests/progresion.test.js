import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cerrarSemana, adherencia, compararIciq, reevaluacionesPendientes, semanasEnNivel, entradasPlanificadas, conteoSemana,
} from '../js/engine/progresion.js';
import { generarPlan, regenerarSemanaActual } from '../js/engine/planificador.js';
import { fechaDePlan } from '../js/util/fechas.js';
import { catalogo, seguridadLimpia, equipoVaginalEMG } from './ayuda.js';

const INICIO = '2026-09-07';
const nuevoPlan = (nivel = 2, perfil = 'IUE') => generarPlan({
  perfil, nivel, seguridad: seguridadLimpia(INICIO), equipo: equipoVaginalEMG(), fechaInicio: INICIO, iciqInicial: 11,
}, catalogo);

/** Sesiones completadas para una fracción de las entradas de la semana (datos ficticios). */
function sesionesSemana(plan, w, { fraccion = 1, dolor = () => false, reps = null } = {}) {
  const ents = entradasPlanificadas(plan, w);
  const n = Math.round(ents.length * fraccion);
  return ents.slice(0, n).map((e, i) => ({
    id: `s${w}-${i}`,
    fecha: `${fechaDePlan(INICIO, w, e.dia)}T${String(7 + i).padStart(2, '0')}:00:00`,
    semana: w,
    dia: e.dia,
    tipoSesionId: e.tipo,
    completada: true,
    dolor: dolor(i),
    repsPlanificadas: 10,
    repsLogradas: reps ?? 10,
  }));
}
const autoev = (w, E, F) => ({ id: `a${w}`, fecha: fechaDePlan(INICIO, w, 'L'), semana: w, fuerza: { P: 3, E, R: 8, F } });

test('rf11_subeNivel', () => {
  const plan = nuevoPlan(2);
  const sesiones = [...sesionesSemana(plan, 1, { fraccion: 0.8 }), ...sesionesSemana(plan, 2, { fraccion: 0.8 })];
  const evaluaciones = [autoev(0, 6, 5), autoev(2, 7, 6)];
  const r = cerrarSemana({ plan, sesiones, evaluaciones, semana: 2 }, catalogo);
  assert.equal(r.accion, 'subir');
  assert.equal(r.nivelDesde, 2);
  assert.equal(r.nivelHasta, 3);
  assert.match(r.motivo, /Subes al nivel 3/);
  assert.ok(r.reglasAplicadas[0].startsWith('subir'));
  assert.ok(adherencia(plan, sesiones, 2) >= 0.7);
});

test('rf11_bajaPorDolor2', () => {
  const plan = nuevoPlan(2);
  const sesiones = sesionesSemana(plan, 3, { dolor: (i) => i === 4 || i === 5 });
  const r = cerrarSemana({ plan, sesiones, evaluaciones: [], semana: 3 }, catalogo);
  assert.equal(r.accion, 'bajar');
  assert.equal(r.nivelHasta, 1);
  assert.equal(r.sugerirProfesional, true);
  assert.match(r.motivo, /consulta con tu profesional/);
  // Dolor en sesiones NO consecutivas: no baja.
  const alterno = sesionesSemana(plan, 3, { dolor: (i) => i === 1 || i === 5 });
  assert.equal(cerrarSemana({ plan, sesiones: alterno, semana: 3 }, catalogo).accion, 'mantener');
  // Mínimo 0.
  const p0 = nuevoPlan(0);
  const r0 = cerrarSemana({ plan: p0, sesiones: sesionesSemana(p0, 3, { dolor: () => true }), semana: 3 }, catalogo);
  assert.equal(r0.accion, 'mantener');
  assert.equal(r0.nivelHasta, 0);
  assert.match(r0.motivo, /nivel más bajo/);
});

test('rf11_bajaPorReps50', () => {
  const plan = nuevoPlan(3);
  const r = cerrarSemana({ plan, sesiones: sesionesSemana(plan, 4, { reps: 4 }), semana: 4 }, catalogo);
  assert.equal(r.accion, 'bajar');
  assert.equal(r.nivelHasta, 2);
  assert.ok(r.reglasAplicadas.some((x) => /reps/.test(x)));
  // Justo el 50 % no baja.
  assert.equal(cerrarSemana({ plan, sesiones: sesionesSemana(plan, 4, { reps: 5 }), semana: 4 }, catalogo).accion, 'mantener');
});

test('rf11_mantieneMenos2Semanas', () => {
  const plan = nuevoPlan(2);
  const r = cerrarSemana({ plan, sesiones: sesionesSemana(plan, 1), evaluaciones: [autoev(0, 8, 8), autoev(1, 8, 8)], semana: 1 }, catalogo);
  assert.equal(r.accion, 'mantener');
  assert.match(r.motivo, /1 semana\(s\) en este nivel/);
  // Tras un cambio de nivel en la semana 3, la semana 4 cuenta solo 1 semana en el nivel nuevo.
  const p = regenerarSemanaActual({ ...plan, semanaActual: 4 }, 3, catalogo);
  assert.equal(semanasEnNivel(p, 3, 4, [{ semana: 3, nivelHasta: 3 }]), 1);
  // Adherencia baja, metas no alcanzadas o pocas sesiones: mantiene con motivo.
  const ses = [...sesionesSemana(plan, 1, { fraccion: 0.5 }), ...sesionesSemana(plan, 2, { fraccion: 0.5 })];
  const r2 = cerrarSemana({ plan, sesiones: ses, evaluaciones: [autoev(0, 5, 5), autoev(2, 7, 6)], semana: 2 }, catalogo);
  assert.equal(r2.accion, 'mantener');
  assert.match(r2.motivo, /adherencia 50 %/);
  assert.match(r2.motivo, /E ≥ 6 s y F ≥ 5/);
  const r3 = cerrarSemana({ plan, sesiones: [], evaluaciones: [], semana: 2 }, catalogo);
  assert.match(r3.motivo, /sin dolor/);
  // Por defecto cierra la semana anterior a la actual.
  assert.equal(cerrarSemana({ plan: { ...plan, semanaActual: 3 } }, catalogo).semana, 2);
  assert.throws(() => cerrarSemana({}, catalogo), /necesita un plan/);
});

test('rf11_noPasaDe5', () => {
  const plan = nuevoPlan(4);
  const p5 = regenerarSemanaActual({ ...plan, semanaActual: 1 }, 5, catalogo);
  const sesiones = [...sesionesSemana(p5, 1), ...sesionesSemana(p5, 2)];
  const evs = [autoev(1, 10, 15), autoev(2, 10, 15)];
  const r = cerrarSemana({ plan: p5, sesiones, evaluaciones: evs, semana: 2 }, catalogo);
  assert.equal(r.accion, 'mantener');
  assert.equal(r.nivelHasta, 5);
  assert.match(r.motivo, /nivel más alto/);
  // Nivel 4 con todo cumplido sí llega a 5.
  const s4 = [...sesionesSemana(plan, 1), ...sesionesSemana(plan, 2)];
  assert.equal(cerrarSemana({ plan, sesiones: s4, evaluaciones: [autoev(1, 10, 10), autoev(2, 10, 10)], semana: 2 }, catalogo).nivelHasta, 5);
  // Mantenimiento (nivel 9): no progresa.
  const m = { ...plan, semanas: plan.semanas.map((s) => ({ ...s, nivel: 9 })), nivelActual: 9 };
  assert.equal(cerrarSemana({ plan: m, sesiones: s4, semana: 2 }, catalogo).accion, 'mantener');
});

test('rf14_pendienteSemana4', () => {
  const plan = nuevoPlan(2);
  const evaluaciones = [{ fecha: '2026-09-06', semana: 0, fuerza: { E: 4, F: 4 }, iciq: { total: 11 } }, autoev(2, 5, 5)];
  const r = cerrarSemana({ plan, sesiones: [], evaluaciones, semana: 3 }, catalogo);
  assert.deepEqual(r.reevaluacionPendiente, [{ tipo: 'fuerza', semana: 4 }, { tipo: 'iciq', semana: 4 }]);
  // Si no hizo la de la semana 2, también queda pendiente.
  const sin2 = reevaluacionesPendientes(plan, [evaluaciones[0]], 4);
  assert.deepEqual(sin2.map((x) => `${x.tipo}${x.semana}`), ['fuerza2', 'fuerza4', 'iciq4']);
  const urg = nuevoPlan(2, 'URGENCIA');
  assert.ok(reevaluacionesPendientes(urg, [], 4).some((x) => x.tipo === 'diario' && x.semana === 4));
});

test('rf14_mejoraInsuficiente_11a10', () => {
  const c = compararIciq(11, 10, catalogo);
  assert.equal(c.delta, -1);
  assert.equal(c.mejoraSuficiente, false);
  assert.equal(c.mensaje, 'Mejora insuficiente: te recomendamos valoración por un profesional de suelo pélvico.');
  assert.equal(compararIciq({ total: 11 }, { total: 9 }, catalogo).mejoraSuficiente, true);
  assert.equal(compararIciq(0, 0, catalogo).mejoraSuficiente, true);
  assert.throws(() => compararIciq(null, 3, catalogo), RangeError);
  // En el cierre de la semana 12.
  const plan = nuevoPlan(2);
  const evs = [{ fecha: '2026-09-06', semana: 0, iciq: { total: 11 } }, { fecha: '2026-11-29', semana: 12, iciq: { total: 10 } }];
  const r = cerrarSemana({ plan, sesiones: [], evaluaciones: evs, semana: 12 }, catalogo);
  assert.equal(r.mejoraInsuficiente, true);
  assert.equal(r.sugerirProfesional, true);
  const ok = cerrarSemana({ plan, sesiones: [], evaluaciones: [evs[0], { ...evs[1], iciq: { total: 7 } }], semana: 12 }, catalogo);
  assert.equal(ok.mejoraInsuficiente, false);
});

test('rf13_adherencia_bordes', () => {
  const plan = nuevoPlan(2);
  assert.equal(adherencia(plan, [], 1), 0);
  assert.equal(adherencia(plan, sesionesSemana(plan, 1), 1), 1);
  assert.equal(adherencia(plan, [], 99), 0, 'semana inexistente');
  // Sesiones no completadas o de otro tipo no cuentan; no se cuenta dos veces.
  const extra = [{ semana: 1, tipoSesionId: 'EST-IUE', completada: true }, { semana: 1, tipoSesionId: 'EST-IUE', completada: true },
    { semana: 1, tipoSesionId: 'EST-IUE', completada: true }, { semana: 1, tipoSesionId: 'EST-IUE', completada: true },
    { semana: 1, tipoSesionId: 'EST-TONO', completada: true }, { semana: 1, tipoSesionId: 'RELAJ-RESP', completada: false }];
  assert.equal(conteoSemana(plan, extra, 1).hechas, 3);
});
