// Resultado de la evaluación inicial: perfil, severidad, nivel, plan, semana tipo y fichas (RF-04..RF-07).

import { html, montar, il } from '../../util/dom.js';
import { leer } from '../../store/repo.js';
import { DIAS, NOMBRES_DIA } from '../../util/fechas.js';
import { construirLineaTiempo } from '../../engine/sesion.js';
import { nombreEntrada, duracionEntradaMin, textoReemplazo } from '../componentes/tarjeta-sesion.js';
import { fichaParametros } from '../componentes/ficha-parametros.js';

export function render({ cat, main }) {
  const evs = leer('evaluaciones', []);
  const ev = [...evs].reverse().find((e) => e.tipo === 'inicial');
  const plan = leer('plan');
  if (!ev || !plan) {
    montar(main, html`<section><h1>Aún no tienes resultado</h1><p>Haz la evaluación para conocer tu perfil y tu plan.</p>
      <a class="btn btn-primario btn-grande" href="#/evaluacion">Empezar la evaluación</a></section>`);
    return;
  }
  const r = ev.resultado;
  const perfil = cat.perfil(r.perfil);
  const nivel = cat.nivel(r.nivel);
  const sev = cat.iciq.severidad.find((x) => x.id === r.severidad)?.nombre ?? r.severidad;
  const equipo = leer('equipo');
  const sem1 = plan.semanas[0];
  const conEquipo = [...new Set(DIAS.flatMap((d) => sem1.dias[d].map((e) => e.tipo)))].filter((t) => cat.usaCorriente(t));
  const seg = ev.seguridad;

  montar(main, html`<section>
    <div class="encabezado-vista"><h1>Tu resultado</h1><p>Evaluación del ${ev.fecha}</p></div>
    ${r.mensajesDerivacion?.length ? html`<div class="aviso aviso-peligro" role="alert"><h2>Te recomendamos una valoración profesional</h2>${r.mensajesDerivacion.map((m) => html`<p>${m}</p>`)}</div>` : ''}
    ${seg?.contraindicacionEST ? html`<div class="aviso aviso-peligro"><h2>Consulta con tu profesional antes de usar el electroestimulador</h2><p>${cat.seguridad.mensajes.contraindicacion}</p></div>` : ''}
    ${seg?.banderasRojas?.length && !seg.consultada ? html`<div class="aviso aviso-peligro"><h2>Bandera roja: consulta médica antes de continuar</h2><p>${cat.seguridad.mensajes.banderaRoja}</p></div>` : ''}
    <div class="tarjeta">
      <div class="fila" style="flex-wrap:nowrap;align-items:flex-start">
        ${il(perfil?.icono, 'il-icono')}
        <div><p class="texto-suave" style="margin:0">Tu perfil</p><h2>${perfil?.nombre ?? r.perfil}</h2>
          ${r.predominio ? html`<p><span class="etiqueta">Predominio: ${r.predominio === 'URGENCIA' ? 'urgencia' : 'esfuerzo'}</span></p>` : ''}</div>
      </div>
      <p>${perfil?.descripcion}</p>
      <p><strong>Objetivo:</strong> ${perfil?.objetivo}</p>
      <p><strong>Severidad de los escapes (ICIQ ${r.iciqTotal} / 21):</strong> ${sev}</p>
    </div>
    <div class="tarjeta">
      <p class="texto-suave" style="margin:0">Nivel inicial</p>
      <h2>Nivel ${r.nivel} · ${nivel?.nombre}</h2>
      <p>${r.motivoNivel}</p>
      <p><strong>Meta del nivel:</strong> ${nivel?.objetivo}</p>
    </div>
    <div class="aviso aviso-info"><h2>Tu plan de ${plan.duracionSemanas} semanas</h2><p>${plan.motivo}</p></div>
    <h2 class="seccion-titulo">Tu semana tipo (semana 1)</h2>
    <div class="tarjeta tabla-scroll"><table class="tabla">
      <caption class="solo-lectores">Sesiones de cada día de la semana 1</caption>
      <tbody>${DIAS.map((d) => html`<tr><th scope="row" title="${NOMBRES_DIA[d]}">${d}</th><td>
        ${sem1.dias[d].length ? sem1.dias[d].map((e) => {
          const min = duracionEntradaMin(e, { nivel: sem1.nivel, semana: 1, equipo }, cat);
          const rep = textoReemplazo(e, cat);
          return html`<div>${nombreEntrada(e.tipo, cat)}${min ? html` <span class="texto-suave">· ${min} min</span>` : ''}${rep ? html`<br><span class="texto-suave chico">${rep}</span>` : ''}</div>`;
        }) : html`<span class="texto-suave">Descanso</span>`}
      </td></tr>`)}</tbody></table></div>
    ${conEquipo.length ? html`<h2 class="seccion-titulo">Sesiones con tu equipo</h2>
      ${conEquipo.map((t) => {
        const lt = construirLineaTiempo(t, { nivel: sem1.nivel, semana: 1, equipo }, cat);
        return html`<h3>${cat.tipoSesion(t).nombre}</h3>${fichaParametros({ tipo: cat.tipoSesion(t), parametros: lt.parametros, bloques: lt.bloques, semana: 1, equipo, catalogo: cat, conIlustraciones: false })}`;
      })}` : html`<div class="aviso aviso-info"><p>Tu plan no incluye sesiones con corriente por ahora. ${equipo ? '' : 'Si tienes electroestimulador, regístralo en Mi equipo y el plan se recalcula.'}</p>
        ${equipo ? '' : html`<a class="btn btn-secundario" href="#/equipo">Registrar mi equipo</a>`}</div>`}
    <h2 class="seccion-titulo">Tu suelo pélvico</h2>
    ${il('IL-01')}
    <a class="btn btn-primario btn-grande" href="#/hoy">Ir a Hoy</a>
    <p class="aviso-corto">${cat.meta.avisoCorto}</p>
  </section>`);
}
