// Agregados para "Progreso" (RF-13) y el informe imprimible (RF-18). Puro, sin DOM.

import { conteoSemana } from './progresion.js';

function porFecha(a, b) {
  return String(a.fecha).localeCompare(String(b.fecha));
}

/**
 * @param {{evaluaciones:object[], sesiones:object[], plan:object, cambiosNivel?:object[], perfil?:object}} estado
 * @param {object} [catalogo]
 */
export function resumen({ evaluaciones = [], sesiones = [], plan = null, cambiosNivel = [] } = {}, catalogo = null) {
  const evs = [...evaluaciones].sort(porFecha);
  const ses = [...sesiones].filter((s) => s.completada).sort(porFecha);

  const ultimaSemana = plan ? Math.min(plan.semanaActual ?? 1, plan.duracionSemanas ?? 12) : 0;
  const adherenciaPorSemana = [];
  for (let w = 1; w <= ultimaSemana; w++) {
    const { hechas, planificadas } = conteoSemana(plan, sesiones, w);
    adherenciaPorSemana.push({ semana: w, hechas, planificadas, fraccion: planificadas ? hechas / planificadas : 0 });
  }

  const series = {
    E: evs.filter((e) => e.fuerza).map((e) => ({ fecha: e.fecha, valor: e.fuerza.E })),
    F: evs.filter((e) => e.fuerza).map((e) => ({ fecha: e.fecha, valor: e.fuerza.F })),
    ICIQ: evs.filter((e) => e.iciq).map((e) => ({ fecha: e.fecha, valor: e.iciq.total })),
    EVA: evs.filter((e) => e.eva != null).map((e) => ({ fecha: e.fecha, valor: e.eva })),
    mA: ses.filter((s) => typeof s.intensidadMA === 'number').map((s) => ({ fecha: s.fecha, valor: s.intensidadMA, tipo: s.tipoSesionId })),
  };

  const historialNiveles = [...cambiosNivel].sort(porFecha);
  const nivelActual = plan?.nivelActual ?? null;
  const total = adherenciaPorSemana.reduce((a, x) => ({ h: a.h + x.hechas, p: a.p + x.planificadas }), { h: 0, p: 0 });
  const adherenciaGlobal = total.p ? total.h / total.p : 0;

  const nombreNivel = (n) => catalogo?.nivel(n)?.nombre ?? '';
  const nombrePerfil = plan && catalogo ? catalogo.perfil(plan.perfil)?.nombre ?? plan.perfil : plan?.perfil ?? '';
  const ini = series.ICIQ[0];
  const fin = series.ICIQ[series.ICIQ.length - 1];
  const lineas = [];
  if (plan) {
    lineas.push(`Perfil: ${nombrePerfil}. Plan iniciado el ${plan.fechaInicio}; semana ${plan.semanaActual} de ${plan.duracionSemanas}.`);
    lineas.push(`Nivel actual: ${nivelActual}${nombreNivel(nivelActual) ? ` (${nombreNivel(nivelActual)})` : ''}; nivel inicial: ${plan.nivelInicial}.`);
  }
  lineas.push(`Adherencia global: ${Math.round(adherenciaGlobal * 100)} % (${total.h} de ${total.p} sesiones planificadas).`);
  if (ini && fin && ini !== fin) lineas.push(`ICIQ-UI SF: de ${ini.valor} (${ini.fecha}) a ${fin.valor} (${fin.fecha}).`);
  else if (ini) lineas.push(`ICIQ-UI SF inicial: ${ini.valor} (${ini.fecha}).`);
  const eU = series.E[series.E.length - 1];
  const fU = series.F[series.F.length - 1];
  if (eU) lineas.push(`Última autoevaluación: sostén ${eU.valor} s, rápidas ${fU.valor}.`);
  if (series.mA.length) {
    const prom = Math.round(series.mA.reduce((s, x) => s + x.valor, 0) / series.mA.length);
    lineas.push(`Intensidad media usada en electroestimulación: ${prom} mA (${series.mA.length} sesiones).`);
  }
  const conDolor = ses.filter((s) => s.dolor === true).length;
  lineas.push(`Sesiones con dolor registrado: ${conDolor}.`);
  for (const c of historialNiveles) lineas.push(`Cambio de nivel ${c.nivelDesde} → ${c.nivelHasta} (${c.fecha}): ${c.motivo}`);

  return {
    adherenciaPorSemana,
    adherenciaGlobal,
    series,
    nivelActual,
    historialNiveles,
    sesionesCompletadas: ses.length,
    sesionesConDolor: conDolor,
    texto: lineas.join('\n'),
  };
}
