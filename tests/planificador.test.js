import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generarPlan, regenerarSemanaActual, regenerarConEquipo, regenerarConSeguridad, planMantenimiento,
  mejoraParaMantenimiento, capacidadesEquipo, entradasDelDia, fechaEntrada,
} from '../js/engine/planificador.js';
import { evaluarSeguridad } from '../js/engine/seguridad.js';
import { catalogo, seguridadLimpia, equipoVaginalEMG, respuestasSeguridad, todasLasEntradas } from './ayuda.js';

const base = (extra = {}) => ({
  perfil: 'IUE', nivel: 2, seguridad: seguridadLimpia(), equipo: equipoVaginalEMG(), fechaInicio: '2026-11-02', iciqInicial: 11, ...extra,
});
const tiposDia = (plan, w, d) => plan.semanas[w - 1].dias[d].map((e) => e.tipo);

test('rf06_iueNivel2_semanaTipo', () => {
  const plan = generarPlan(base(), catalogo);
  assert.equal(plan.semanas.length, 12);
  assert.equal(plan.programaId, 'PROG-IUE');
  const s = plan.semanas[0];
  const est = Object.entries(s.dias).filter(([, l]) => l.some((e) => e.tipo === 'EST-IUE')).map(([d]) => d);
  assert.deepEqual(est, ['L', 'X', 'V'], 'EST-IUE 3 veces L-X-V');
  for (const d of ['L', 'M', 'X', 'J', 'V', 'S', 'D']) assert.ok(tiposDia(plan, 1, d).includes('PFMT-SERIE'), `PFMT diario (${d})`);
  assert.equal(s.dias.M.find((e) => e.tipo === 'PFMT-SERIE').series, 3);
  const bio = Object.entries(s.dias).filter(([, l]) => l.some((e) => e.tipo.startsWith('BIO-'))).map(([d]) => d);
  assert.deepEqual(bio, ['M', 'J'], 'BIO 2 veces M-J');
  assert.ok(!tiposDia(plan, 1, 'S').includes('PFMT-KNACK'), 'Knack solo desde nivel 4');
  assert.ok(s.dias.L.every((e) => e.estado === 'pendiente'));
});

test('rf06_reevaluacionesInsertadas', () => {
  const plan = generarPlan(base(), catalogo);
  const fuerza = plan.semanas.filter((s) => s.reevaluaciones.some((r) => r.tipo === 'fuerza')).map((s) => s.numero);
  const iciq = plan.semanas.filter((s) => s.reevaluaciones.some((r) => r.tipo === 'iciq')).map((s) => s.numero);
  assert.deepEqual(fuerza, [2, 4, 6, 8, 10, 12]);
  assert.deepEqual(iciq, [4, 8, 12]);
  assert.ok(tiposDia(plan, 2, 'L').includes('REEVAL-FUERZA'), 'fuerza el lunes');
  assert.ok(tiposDia(plan, 4, 'D').includes('REEVAL-ICIQ'), 'ICIQ el domingo');
  // URGENCIA: diario semanas 0, 4, 8 en los 3 primeros días.
  const urg = generarPlan(base({ perfil: 'URGENCIA' }), catalogo);
  assert.deepEqual(urg.semana0, { reevaluaciones: [{ tipo: 'diario', dias: 3 }] });
  for (const d of ['L', 'M', 'X']) assert.ok(tiposDia(urg, 4, d).includes('VES-DIARIO'));
  assert.ok(!tiposDia(urg, 4, 'J').includes('VES-DIARIO'));
  assert.ok(!tiposDia(urg, 3, 'L').includes('VES-DIARIO'));
  // DOLOR: EVA en 2, 4, ..., 12; sin re-evaluación de fuerza.
  const dol = generarPlan(base({ perfil: 'DOLOR_HIPERTONIA', nivel: 0, evaInicial: 7 }), catalogo);
  assert.ok(tiposDia(dol, 2, 'D').includes('REEVAL-EVA'));
  assert.ok(!todasLasEntradas(dol).some((e) => e.tipo === 'REEVAL-FUERZA'));
  // Sin duplicados en un mismo día.
  for (const p of [plan, urg, dol]) {
    for (const s of p.semanas) for (const l of Object.values(s.dias)) {
      assert.equal(new Set(l.map((e) => e.tipo)).size, l.length, `duplicado en semana ${s.numero}`);
    }
  }
});

test('rf06_sinEST_reemplazos', () => {
  const ci = evaluarSeguridad(respuestasSeguridad(['CI-MARCAPASOS']), catalogo, '2026-11-02');
  const plan = generarPlan(base({ seguridad: ci }), catalogo);
  const l = plan.semanas[0].dias.L;
  const reemp = l.find((e) => e.reemplazaA === 'EST-IUE');
  assert.equal(reemp.tipo, 'BIO-LENTAS', 'EST-IUE → BIO-LENTAS (reemplazoSinEST)');
  assert.equal(reemp.motivoReemplazo, 'reemplazoSinEST');
  // Sin EMG: BIO-LENTAS → PFMT-SERIE, que se fusiona sumando una serie (sin duplicar).
  const sinEmg = generarPlan(base({ seguridad: ci, equipo: { ...equipoVaginalEMG(), tieneEMG: false } }), catalogo);
  const pf = sinEmg.semanas[0].dias.L.filter((e) => e.tipo === 'PFMT-SERIE');
  assert.equal(pf.length, 1);
  assert.equal(pf[0].series, 3);
  assert.ok(!todasLasEntradas(sinEmg).some((e) => e.tipo.startsWith('BIO-')));
  // DOLOR con contraindicación: TENS → relajación.
  const dol = generarPlan(base({ perfil: 'DOLOR_HIPERTONIA', nivel: 0, seguridad: ci }), catalogo);
  assert.ok(!todasLasEntradas(dol).some((e) => /^(EST|TENS)-/.test(e.tipo)));
  assert.ok(tiposDia(dol, 1, 'L').includes('RELAJ-RESP'));
  // FECAL sin sonda anal → BIO-LENTAS.
  const fec = generarPlan(base({ perfil: 'FECAL' }), catalogo);
  assert.ok(!todasLasEntradas(fec).some((e) => e.tipo === 'EST-FEC'));
  assert.equal(fec.semanas[0].dias.L.find((e) => e.reemplazaA === 'EST-FEC').motivoReemplazo, 'reemplazoSinSondaAnal');
  const fecAnal = generarPlan(base({ perfil: 'FECAL', equipo: { ...equipoVaginalEMG(), sondas: ['vaginal', 'anal'] } }), catalogo);
  assert.ok(tiposDia(fecAnal, 1, 'L').includes('EST-FEC'));
  // DOLOR sin electrodos: TENS → relajación; con electrodos se mantiene TENS.
  const dolSin = generarPlan(base({ perfil: 'DOLOR_HIPERTONIA', nivel: 0 }), catalogo);
  assert.ok(!todasLasEntradas(dolSin).some((e) => e.tipo.startsWith('TENS-')));
  const dolCon = generarPlan(base({ perfil: 'DOLOR_HIPERTONIA', nivel: 0, equipo: { ...equipoVaginalEMG(), sondas: ['vaginal', 'electrodos'] } }), catalogo);
  assert.ok(tiposDia(dolCon, 1, 'L').includes('TENS-ALTA'));
});

test('rf06_negativo_equipoSinEMG_sinEquipo_sinEstimulacion', () => {
  const sinEmg = generarPlan(base({ equipo: { ...equipoVaginalEMG(), tieneEMG: false } }), catalogo);
  assert.ok(!todasLasEntradas(sinEmg).some((e) => e.tipo.startsWith('BIO-')), 'sin EMG no hay BIO-*');
  assert.ok(tiposDia(sinEmg, 1, 'L').includes('EST-IUE'), 'la estimulación se mantiene');
  assert.match(sinEmg.motivo, /EMG/);
  const sinEquipo = generarPlan(base({ equipo: null }), catalogo);
  assert.ok(!todasLasEntradas(sinEquipo).some((e) => /^(EST|TENS)-/.test(e.tipo)), 'sin equipo no hay corriente');
  assert.match(sinEquipo.motivo, /Sin equipo registrado/);
  const sensor = generarPlan(base({ equipo: { marca: 'Sensor', tipo: 'biofeedback-presion', tipoSonda: 'vaginal', programas: {} } }), catalogo);
  assert.ok(!todasLasEntradas(sensor).some((e) => /^(EST|TENS)-/.test(e.tipo)), 'tieneEstimulacion = false → sin EST');
  assert.match(sensor.motivo, /no electroestimula/);
  assert.deepEqual(capacidadesEquipo(null, catalogo).hayEquipo, false);
  assert.equal(capacidadesEquipo({ tipoSonda: 'vaginal', sondas: ['anal (opcional)'] }, catalogo).anal, false);
  assert.throws(() => generarPlan(base({ perfil: 'INEXISTENTE' }), catalogo), /No hay programa/);
  assert.throws(() => generarPlan(base({ nivel: 7 }), catalogo), RangeError);
  assert.throws(() => generarPlan(base({ fechaInicio: '' }), catalogo), /fechaInicio/);
  // Sin evaluación de seguridad: criterio conservador, sin corriente.
  const sinSeg = generarPlan(base({ seguridad: null }), catalogo);
  assert.ok(!todasLasEntradas(sinSeg).some((e) => /^(EST|TENS)-/.test(e.tipo)));
});

test('rf06_filtroNivelMin', () => {
  const n4 = generarPlan(base({ nivel: 4 }), catalogo);
  assert.ok(tiposDia(n4, 1, 'S').includes('PFMT-KNACK'), 'nivelMin 4 se incluye en nivel 4');
  assert.ok(!tiposDia(n4, 1, 'S').includes('PFMT-FUNCIONAL'), 'nivelMin 5 no en nivel 4');
  const n1 = generarPlan(base({ nivel: 1 }), catalogo);
  assert.ok(!tiposDia(n1, 1, 'J').includes('BIO-RAPIDAS'), 'BIO-RAPIDAS nivelMin 2');
  // Prolapso: EST-SENS (nivelMax 0) solo en nivel 0.
  const p0 = generarPlan(base({ perfil: 'PROLAPSO', nivel: 0 }), catalogo);
  const p2 = generarPlan(base({ perfil: 'PROLAPSO', nivel: 2 }), catalogo);
  assert.ok(tiposDia(p0, 1, 'L').includes('EST-SENS'));
  assert.ok(!tiposDia(p2, 1, 'L').includes('EST-SENS'));
  // Nivel 0 en IUE: EST-IUE (nivelMin 1) → EST-SENS sugerida; PFMT-SERIE → PFMT-CONCIENCIA.
  const i0 = generarPlan(base({ nivel: 0 }), catalogo);
  assert.deepEqual(tiposDia(i0, 1, 'L'), ['EST-SENS', 'PFMT-CONCIENCIA']);
  // Mantenimiento: EST-TONO solo las 4 primeras semanas (semanasMax).
  const m = planMantenimiento(generarPlan(base(), catalogo), { iciqFinal: 8 }, catalogo).plan;
  assert.ok(m.semanas.find((s) => s.numero === 13).dias.L.some((e) => e.tipo === 'EST-TONO'));
  assert.ok(!m.semanas.find((s) => s.numero === 17).dias.L.some((e) => e.tipo === 'EST-TONO'));
});

test('rf06_dolorDesdeSemana5_condicional', () => {
  const dol = generarPlan(base({ perfil: 'DOLOR_HIPERTONIA', nivel: 0, evaInicial: 7 }), catalogo);
  assert.ok(!tiposDia(dol, 4, 'L').includes('PFMT-CONCIENCIA'));
  const e = dol.semanas[4].dias.L.find((x) => x.tipo === 'PFMT-CONCIENCIA');
  assert.equal(e.condicion, 'dolorSemanalMenor');
  // DOLOR: nunca fortalecimiento con electroestimulación (RF-04).
  assert.ok(!todasLasEntradas(dol).some((x) => ['EST-IUE', 'EST-MIX', 'EST-FEC', 'EST-TONO', 'EST-SENS'].includes(x.tipo)));
});

test('rf06_regenerar_nivel_equipo_seguridad', () => {
  let plan = generarPlan(base(), catalogo);
  plan.semanas[2].dias.L[0].estado = 'hecha';
  plan.semanaActual = 3;
  const nuevo = regenerarSemanaActual(plan, 4, catalogo);
  assert.equal(nuevo.nivelActual, 4);
  assert.equal(nuevo.semanas[1].nivel, 2, 'semanas pasadas intactas');
  assert.equal(nuevo.semanas[2].nivel, 4);
  assert.equal(nuevo.semanas[2].dias.L[0].estado, 'hecha', 'se conserva lo ya hecho');
  assert.ok(nuevo.semanas[2].dias.S.some((e) => e.tipo === 'PFMT-KNACK'));
  assert.throws(() => regenerarSemanaActual(plan, 8, catalogo), RangeError);
  // Cambio de equipo: sin EMG desde la semana actual.
  const sinEmg = regenerarConEquipo(plan, { ...equipoVaginalEMG(), tieneEMG: false }, catalogo);
  assert.ok(sinEmg.semanas[1].dias.M.some((e) => e.tipo === 'BIO-LENTAS'), 'semana pasada intacta');
  assert.ok(!sinEmg.semanas[2].dias.M.some((e) => e.tipo === 'BIO-LENTAS'));
  // Bandera roja consultada: se recupera el plan completo.
  const br = evaluarSeguridad(respuestasSeguridad(['BR-PESO']), catalogo, '2026-11-02');
  plan = generarPlan(base({ seguridad: br }), catalogo);
  assert.ok(!tiposDia(plan, 1, 'L').includes('EST-IUE'));
  const ok = regenerarConSeguridad(plan, { ...br, consultada: true }, catalogo);
  assert.ok(tiposDia(ok, 1, 'L').includes('EST-IUE'));
  assert.deepEqual(entradasDelDia(ok, 1, 'L').map((e) => e.tipo), tiposDia(ok, 1, 'L'));
  assert.deepEqual(entradasDelDia(null, 1, 'L'), []);
  assert.equal(fechaEntrada(ok, 2, 'D'), '2026-11-15');
});

test('rf06_negativo_semana13_mantenimientoODerivar', () => {
  const plan = generarPlan(base(), catalogo);
  assert.equal(mejoraParaMantenimiento(plan, { iciqFinal: 9 }, catalogo), true);
  assert.equal(mejoraParaMantenimiento(plan, { iciqFinal: 10 }, catalogo), false);
  assert.equal(mejoraParaMantenimiento(plan, { iciqFinal: 0 }, catalogo), true, 'sin escapes');
  assert.equal(mejoraParaMantenimiento(plan, {}, catalogo), false);
  const m = planMantenimiento(plan, { iciqFinal: 9 }, catalogo);
  assert.equal(m.decision, 'mantenimiento');
  assert.equal(m.plan.semanaActual, 13);
  assert.equal(m.plan.nivelActual, 9);
  const s13 = m.plan.semanas.find((s) => s.numero === 13);
  assert.ok(s13, 'existe la semana 13');
  assert.equal(s13.dias.L.find((e) => e.tipo === 'PFMT-SERIE').series, 1);
  assert.ok(m.plan.semanas.find((s) => s.numero === 24).reevaluaciones.some((r) => r.tipo === 'fuerza'));
  const d = planMantenimiento(plan, { iciqFinal: 11 }, catalogo);
  assert.equal(d.decision, 'derivar');
  assert.equal(d.plan, null);
  assert.match(d.motivo, /Mejora insuficiente/);
  const dol = generarPlan(base({ perfil: 'DOLOR_HIPERTONIA', nivel: 0, evaInicial: 7 }), catalogo);
  assert.equal(planMantenimiento(dol, { evaFinal: 4 }, catalogo).decision, 'derivar-para-progresar');
  assert.equal(planMantenimiento(dol, { evaFinal: 6 }, catalogo).decision, 'derivar');
  assert.equal(mejoraParaMantenimiento(dol, {}, catalogo), false);
  const prev = generarPlan(base({ perfil: 'PREVENCION', iciqInicial: 0 }), catalogo);
  assert.equal(planMantenimiento(prev, { iciqFinal: 0 }, catalogo).decision, 'mantenimiento');
});
