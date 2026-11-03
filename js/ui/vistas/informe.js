// Informe de progreso imprimible para el profesional (RF-18). Sin barra de navegación; @media print limpio.

import { html, montar, $ } from '../../util/dom.js';
import { leer } from '../../store/repo.js';
import { resumen } from '../../engine/reporte.js';
import { hoyISO, formatoCorto } from '../../util/fechas.js';
import { bloqueGraficas, historialNiveles } from './progreso.js';
import { volver } from '../../router.js';

function textoSeguridad(s) {
  if (!s) return '—';
  const partes = [];
  partes.push(s.contraindicacionEST ? `Contraindicación para electroestimulación (${s.contraindicaciones.map((c) => c.id).join(', ') || 'sin responder'})` : 'Sin contraindicaciones');
  if (s.precauciones?.length) partes.push(`precauciones: ${s.precauciones.map((p) => p.id).join(', ')}`);
  if (s.banderasRojas?.length) partes.push(`banderas rojas: ${s.banderasRojas.map((b) => b.id).join(', ')}${s.consultada ? ' (consultó con médico)' : ''}`);
  return partes.join('; ');
}

export function render({ cat, main }) {
  const perfil = leer('perfil');
  const plan = leer('plan');
  const evaluaciones = leer('evaluaciones', []);
  const sesiones = leer('sesiones', []);
  const cambiosNivel = leer('cambiosNivel', []);
  const equipo = leer('equipo');
  const r = resumen({ evaluaciones, sesiones, plan, cambiosNivel }, cat);
  const inicial = [...evaluaciones].reverse().find((e) => e.tipo === 'inicial');
  const conDolor = sesiones.filter((s) => s.dolor === true);
  const nombrePerfil = plan ? cat.perfil(plan.perfil)?.nombre ?? plan.perfil : null;

  montar(main, html`<article class="informe">
    <div class="fila no-imprimir" style="margin-bottom:var(--esp-4)">
      <button type="button" class="btn" data-accion="volver">← Volver</button>
      <button type="button" class="btn btn-primario" data-accion="imprimir">Imprimir / Guardar PDF</button>
    </div>
    <h1>Informe de progreso — PELVIA</h1>
    <p>Generado el ${formatoCorto(hoyISO())}${perfil?.alias ? html` · Paciente: <strong>${perfil.alias}</strong>` : ''}${perfil?.edad ? ` · ${perfil.edad} años` : ''}${perfil?.demo ? ' · DEMO (datos ficticios)' : ''}</p>
    <p class="aviso aviso-alerta">${cat.meta.avisoCorto}</p>

    <h2>Resumen</h2>
    <pre>${r.texto}</pre>
    ${plan ? html`<dl class="ficha-dl">
      <dt>Perfil</dt><dd>${nombrePerfil}${inicial?.resultado?.predominio ? ` (predominio ${inicial.resultado.predominio.toLowerCase()})` : ''}</dd>
      <dt>Inicio del plan</dt><dd>${plan.fechaInicio}</dd>
      <dt>Semana</dt><dd>${plan.semanaActual} de ${plan.duracionSemanas}</dd>
      <dt>Nivel actual</dt><dd>${plan.nivelActual} · ${cat.nivel(plan.nivelActual)?.nombre ?? ''} (inicial ${plan.nivelInicial})</dd>
      <dt>Adherencia global (semanas terminadas)</dt><dd>${Math.round(r.adherenciaGlobal * 100)} %</dd>
      <dt>Plan</dt><dd>${plan.motivo}</dd>
    </dl>` : html`<p>Sin plan activo.</p>`}

    <h2>Evaluaciones</h2>
    ${evaluaciones.length ? html`<div class="tabla-scroll"><table class="tabla"><thead><tr><th scope="col">Fecha</th><th scope="col">Tipo</th><th scope="col">ICIQ</th><th scope="col">Fuerza P/E/R/F</th><th scope="col">Dolor</th><th scope="col">Seguridad</th></tr></thead><tbody>
      ${evaluaciones.map((e) => html`<tr><td>${e.fecha}${e.semana ? ` (sem. ${e.semana})` : ''}</td><td>${e.tipo}</td>
        <td>${e.iciq ? `${e.iciq.total} (${e.iciq.severidad})` : '—'}</td>
        <td>${e.fuerza ? `${e.fuerza.P} / ${e.fuerza.E} s / ${e.fuerza.R} / ${e.fuerza.F}` : '—'}</td>
        <td>${e.eva != null ? `${e.eva}/10` : '—'}</td>
        <td>${e.seguridad ? textoSeguridad(e.seguridad) : '—'}</td></tr>`)}
    </tbody></table></div>` : html`<p>Sin evaluaciones.</p>`}
    ${inicial?.sintomas ? html`<p><strong>Síntomas iniciales (0–3):</strong> ${Object.entries(inicial.sintomas).map(([k, v]) => `${k} ${v}`).join(' · ')}${inicial.contexto?.ctxDiagnostico ? html` · Diagnóstico previo: ${inicial.contexto.ctxDiagnostico}` : ''}</p>` : ''}
    ${inicial?.resultado?.mensajesDerivacion?.length ? html`<p><strong>Derivación sugerida:</strong> ${inicial.resultado.mensajesDerivacion.join(' ')}</p>` : ''}

    <h2>Niveles</h2>
    ${historialNiveles(r, cat)}

    <h2>Adherencia y evolución</h2>
    <div class="graficas-informe">${bloqueGraficas(r, plan)}</div>

    <h2>Sesiones con dolor</h2>
    ${conDolor.length ? html`<ul>${conDolor.map((s) => html`<li>${s.fecha.slice(0, 10)} · ${s.tipoSesionId}${s.intensidadMA != null ? ` · ${s.intensidadMA} mA` : ''}${s.nota ? html` · «${s.nota}»` : ''}</li>`)}</ul>` : html`<p>Ninguna sesión con dolor registrado.</p>`}

    <h2>Equipo</h2>
    ${equipo ? html`<p>${equipo.marca} ${equipo.modelo ?? ''} · sonda: ${equipo.tipoSonda ?? '—'} · máx. ${equipo.mAMax ?? '—'} mA · EMG: ${equipo.tieneEMG ? 'sí' : 'no'} · electroestimula: ${equipo.tieneEstimulacion === false ? 'no' : 'sí'}</p>
      ${Object.keys(equipo.programas ?? {}).length ? html`<p>Programas: ${Object.entries(equipo.programas).map(([n, t]) => `${n} → ${t}`).join(' · ')}</p>` : ''}` : html`<p>Sin equipo registrado.</p>`}

    <h2>Aviso</h2>
    <p>${cat.meta.aviso}</p>
    <p class="texto-suave">Informe generado por PELVIA ${cat.meta.version ? `(catálogo ${cat.meta.version})` : ''} el ${hoyISO()}. Los datos los registra la propia usuaria.</p>
  </article>`);
  $('[data-accion="imprimir"]', main).addEventListener('click', () => window.print());
  $('[data-accion="volver"]', main).addEventListener('click', () => volver('#/progreso'));
}
