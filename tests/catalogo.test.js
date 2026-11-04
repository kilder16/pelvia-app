import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearCatalogo, cargarCatalogo, validarCatalogo } from '../js/engine/catalogo.js';
import { catalogo, jsonCatalogo } from './ayuda.js';

test('rf07_estIue_sem1_35hz15min', () => {
  const p = catalogo.parametrosParaSemana('EST-IUE', 1);
  assert.equal(p.frecuenciaHz, 35);
  assert.equal(p.anchoPulsoUs, 250);
  assert.equal(p.onS, 5);
  assert.equal(p.offS, 10);
  assert.equal(p.rampaS, 1);
  assert.equal(p.duracionMin, 15, 'semanas 1–2: 15 min (progresionSemanal)');
  assert.match(p.intensidad.guia, /contracción clara/);
  assert.match(p.intensidad.nunca, /Nunca dolor/);
  assert.equal(catalogo.parametrosParaSemana('EST-IUE', 2).duracionMin, 15);
  for (const s of [3, 4]) {
    const q = catalogo.parametrosParaSemana('EST-IUE', s);
    assert.deepEqual([q.frecuenciaHz, q.anchoPulsoUs, q.onS, q.offS, q.rampaS, q.duracionMin], [35, 250, 5, 10, 1, 20], `semana ${s}`);
  }
  assert.equal(catalogo.parametrosParaSemana('EST-IUE', 1).semanas, undefined);
  assert.equal(catalogo.parametrosParaSemana('BIO-LENTAS', 1), null, 'sin parámetros eléctricos');
  assert.equal(catalogo.parametrosParaSemana('NO-EXISTE', 1), null);
  // El catálogo base no se modifica al pedir parámetros.
  assert.equal(catalogo.tipoSesion('EST-IUE').parametros.duracionMin, 20);
});

test('rf07_estIue_sem5_50hz', () => {
  const p = catalogo.parametrosParaSemana('EST-IUE', 5);
  assert.equal(p.frecuenciaHz, 50);
  assert.equal(p.duracionMin, 20);
  assert.match(p.nota, /50 Hz/);
  assert.equal(catalogo.parametrosParaSemana('EST-IUE', 12).frecuenciaHz, 50);
  assert.match(p.nota, /35 Hz/, 'nota: mantener 35 Hz si el equipo no permite cambiarla');
  assert.equal(catalogo.parametrosParaSemana('EST-IUE', 13).frecuenciaHz, 35, 'fuera de las filas → base');
});

test('rf07_equivalenciaProgramaEquipo', () => {
  assert.equal(catalogo.equipoConocido('TensCare').programas.STRESS, 'EST-IUE', 'catálogo 1.0.1: clave STRESS');
  const equipo = { programas: { STRESS: 'EST-IUE', URGE: 'EST-URG' } };
  assert.equal(catalogo.equivalenciaEquipo('EST-IUE', equipo), 'STRESS');
  assert.equal(catalogo.equivalenciaEquipo('EST-MIX', equipo), null);
  assert.equal(catalogo.equivalenciaEquipo('EST-IUE', null), null);
  assert.equal(catalogo.equivalenciaEquipo('EST-IUE', {}), null);
  assert.ok(catalogo.equipoConocido('TensCare', 'Elise'));
  assert.equal(catalogo.equipoConocido('TensCare', 'Inexistente'), null);
  assert.ok(catalogo.equipoConocido('TensCare'));
  assert.equal(catalogo.programaDePerfil('IUE').id, 'PROG-IUE');
  assert.equal(catalogo.programaDePerfil('MANTENIMIENTO').id, 'PROG-MANTENIMIENTO');
  assert.equal(catalogo.programaDePerfil('NADA'), null);
  assert.equal(catalogo.usaCorriente('TENS-ALTA'), true);
  assert.equal(catalogo.usaCorriente('PFMT-SERIE'), false);
  assert.equal(catalogo.usaCorriente('X'), false);
  // tiposEquipo: valores por defecto resueltos; lo explícito manda.
  assert.equal(catalogo.resolverEquipo({ tipo: 'biofeedback-presion' }).tieneEstimulacion, false);
  assert.equal(catalogo.resolverEquipo({ tipo: 'estimulador-sonda-emg' }).tieneEMG, true);
  assert.equal(catalogo.resolverEquipo({ tipo: 'estimulador-sonda-emg', tieneEMG: false }).tieneEMG, false);
  assert.equal(catalogo.resolverEquipo({}).aplicaFicha, true);
  assert.equal(catalogo.resolverEquipo(null), null);
  assert.ok(catalogo.tipoEquipo('clinico'));
  assert.equal(catalogo.tipoEquipo('x'), null);
});

test('rnf07_jsonValido_referenciasYRangos', () => {
  const j = jsonCatalogo();
  assert.equal(j.meta.esquema, 1);
  const tipos = new Set(j.tiposSesion.map((t) => t.id));
  const fuentes = new Set(j.fuentes.map((f) => f.id));
  const perfiles = new Set(j.perfiles.map((p) => p.id));
  const errores = [];
  // Tipos referenciados en programas, reemplazos, niveles y equipos existen.
  for (const p of j.programas) {
    for (const [d, l] of Object.entries(p.semanaTipo)) for (const e of l) if (!tipos.has(e.tipo)) errores.push(`${p.id}.${d}: ${e.tipo}`);
    for (const e of p.desdeSemana5 ?? []) if (!tipos.has(e.tipo)) errores.push(`${p.id}.desdeSemana5: ${e.tipo}`);
  }
  for (const k of ['reemplazoSinEST', 'reemplazoSinEMG', 'reemplazoSinSondaAnal', 'reemplazoSinElectrodos']) {
    for (const [a, b] of Object.entries(j.reglasPlanificador[k])) {
      if (!tipos.has(a)) errores.push(`${k}: ${a}`);
      if (!tipos.has(b)) errores.push(`${k}: ${a} → ${b}`);
    }
  }
  for (const n of j.niveles) {
    for (const t of n.sesionesExtra ?? []) if (!tipos.has(t)) errores.push(`nivel ${n.id}: ${t}`);
    if (n.estSugerida && !tipos.has(n.estSugerida)) errores.push(`nivel ${n.id}: ${n.estSugerida}`);
  }
  for (const p of j.perfiles) {
    if (!j.programas.some((pr) => pr.id === p.programaId)) errores.push(`perfil ${p.id}: ${p.programaId}`);
  }
  for (const r of j.reglasClasificacion.orden) if (!perfiles.has(r.perfil)) errores.push(`regla: ${r.perfil}`);
  // Fuentes referenciadas existen.
  const conFuentes = [...j.tiposSesion, ...j.perfiles, ...j.niveles, ...j.seguridad.contraindicacionesAbsolutas, ...j.seguridad.precauciones,
    j.cuestionarioSintomas.iciq, j.autoevaluacionFuerza, j.reglasProgresion, j.entrenamientoVesical, ...(j.equiposConocidos ?? [])];
  for (const x of conFuentes) for (const f of x.fuentes ?? []) if (!fuentes.has(f)) errores.push(`fuente inexistente ${f} en ${x.id ?? x.marca ?? '?'}`);
  for (const t of j.tiposSesion) if (!t.fuentes?.length) errores.push(`${t.id} sin fuentes`);
  // Rangos de seguridad eléctrica.
  for (const t of j.tiposSesion.filter((x) => x.parametros)) {
    const conjuntos = [t.parametros, ...(t.bloques ?? []).map((b) => b.parametros)];
    for (const p of conjuntos) {
      if (p.frecuenciaHz < 1 || p.frecuenciaHz > 120) errores.push(`${t.id}: Hz ${p.frecuenciaHz}`);
      if (p.anchoPulsoUs < 50 || p.anchoPulsoUs > 500) errores.push(`${t.id}: µs ${p.anchoPulsoUs}`);
      if (p.duracionMin > 30) errores.push(`${t.id}: ${p.duracionMin} min`);
      if (!p.continuo && p.onS > 0 && p.onS < 3) errores.push(`${t.id}: ON ${p.onS} s < 3`);
      const fortalece = t.categoria === 'electroestimulacion' && p.participacionActiva !== false && p.onS > 0;
      if (fortalece && p.onS / p.offS > 0.5) errores.push(`${t.id}: ON:OFF ${p.onS}:${p.offS} > 1:2`);
    }
    for (const f of t.progresionSemanal ?? []) {
      if (f.frecuenciaHz != null && (f.frecuenciaHz < 1 || f.frecuenciaHz > 120)) errores.push(`${t.id} progresión Hz`);
      if (f.duracionMin != null && f.duracionMin > 30) errores.push(`${t.id} progresión duración`);
    }
  }
  // rangosAceptables coherentes: [min, max] con min <= max y el valor base dentro del rango.
  for (const t of j.tiposSesion.filter((x) => x.rangosAceptables && x.parametros)) {
    for (const [k, r] of Object.entries(t.rangosAceptables)) {
      if (!Array.isArray(r)) continue;
      if (r.length !== 2 || r[0] > r[1]) errores.push(`${t.id}: rango ${k} inválido`);
      const v = t.parametros[k];
      if (typeof v === 'number' && !t.parametros.continuo && (v < r[0] || v > r[1])) errores.push(`${t.id}: ${k} ${v} fuera de ${r}`);
    }
  }
  // EST-SENS: máximo 4 semanas, en el tipo y en cada programa que la usa.
  const sens = j.tiposSesion.find((t) => t.id === 'EST-SENS');
  if (sens.semanasMax !== 4) errores.push('EST-SENS sin semanasMax 4');
  for (const p of j.programas) for (const [d, l] of Object.entries(p.semanaTipo)) for (const e of l) {
    if (e.tipo === 'EST-SENS' && e.semanasMax !== 4) errores.push(`${p.id}.${d}: EST-SENS sin semanasMax 4`);
  }
  // parametrosFijos de equipos: mismos rangos, salvo exentoValidacion = true.
  for (const c of j.equiposConocidos ?? []) {
    const p = c.parametrosFijos;
    if (!p || p.exentoValidacion === true) continue;
    if (p.frecuenciaHz < 1 || p.frecuenciaHz > 120) errores.push(`${c.marca}: Hz ${p.frecuenciaHz}`);
    if (p.anchoPulsoUs < 50 || p.anchoPulsoUs > 500) errores.push(`${c.marca}: µs ${p.anchoPulsoUs}`);
    if (p.onS / p.offS > 0.5) errores.push(`${c.marca}: ON:OFF ${p.onS}:${p.offS} > 1:2`);
    if (p.duracionMin > 30) errores.push(`${c.marca}: ${p.duracionMin} min`);
  }
  // Mapeos de programas de equipos: siempre a tipos de sesión existentes.
  for (const c of j.equiposConocidos ?? []) for (const [k, v] of Object.entries(c.programas ?? {})) {
    if (!tipos.has(v)) errores.push(`${c.marca}: programa ${k} → ${v}`);
  }
  // Ilustraciones referenciadas con nombre válido.
  for (const t of j.tiposSesion) for (const il of t.ilustraciones ?? []) if (!/^IL-\d{2}$/.test(il)) errores.push(`${t.id}: ${il}`);
  assert.deepEqual(errores, []);
});

test('rnf07_parametrosFijos_exentoValidacion', () => {
  const innovo = jsonCatalogo().equiposConocidos.find((c) => c.parametrosFijos);
  assert.equal(innovo.parametrosFijos.exentoValidacion, true);
  assert.ok(innovo.parametrosFijos.porQue);
  // Sin la marca de exención, 620 µs y ON:OFF 1:1 sí se detectarían.
  assert.ok(innovo.parametrosFijos.anchoPulsoUs > 500 && innovo.parametrosFijos.onS / innovo.parametrosFijos.offS > 0.5);
  // EST-URG 1.0.1: rangos acotados y modo continuo declarado aparte.
  const urg = catalogo.tipoSesion('EST-URG').rangosAceptables;
  assert.deepEqual([urg.onS, urg.offS, urg.continuoPermitido], [[5, 10], [5, 10], true]);
});

test('rnf07_compatibilidadEsquema_y_carga', async () => {
  assert.throws(() => crearCatalogo({ ...jsonCatalogo(), meta: { esquema: 2 } }), /Esquema de catálogo incompatible/);
  assert.throws(() => crearCatalogo(null), /no es un objeto/);
  const sinTipos = jsonCatalogo();
  delete sinTipos.tiposSesion;
  assert.match(validarCatalogo(sinTipos).join(' '), /tiposSesion/);
  const fetcher = async () => ({ ok: true, json: async () => jsonCatalogo() });
  const c = await cargarCatalogo('content/protocolos.json', fetcher);
  assert.equal(c.meta.esquema, 1);
  await assert.rejects(cargarCatalogo('x', async () => ({ ok: false, status: 404 })), /404/);
});
