// Acerca de: versión, fuentes clínicas, nota de revisión, privacidad y logo del autor (solo como imagen).

import { html, montar, $ } from '../../util/dom.js';
import { APP_VERSION } from '../../store/repo.js';

export function render({ cat, main }) {
  const fuentes = cat.fuentes();
  montar(main, html`<section>
    <div class="encabezado-vista"><h1>Acerca de PELVIA</h1>
      <p>Terapia de suelo pélvico guiada con ejercicios, biofeedback y electroestimulación.</p></div>
    <div class="tarjeta">
      <dl class="ficha-dl">
        <dt>Versión de la app</dt><dd>${APP_VERSION}</dd>
        <dt>Catálogo clínico</dt><dd>${cat.meta.version} (${cat.meta.fecha})</dd>
      </dl>
    </div>
    <div class="aviso aviso-alerta"><p>${cat.meta.aviso}</p></div>
    ${cat.meta.revisionProfesionalPendiente ? html`<div class="aviso aviso-info"><h2>Revisión profesional</h2><p>${cat.meta.notaRevision}</p></div>` : html`<p>${cat.meta.notaRevision}</p>`}
    <div class="tarjeta"><h2>Privacidad</h2>
      <p>Tus datos de salud se guardan solo en este celular. PELVIA no tiene servidor, cuentas ni analítica, y no envía tus datos a ningún lugar. Si borras los datos del navegador, se pierden: exporta un respaldo desde Ajustes.</p></div>
    <div class="tarjeta"><h2>Fuentes clínicas</h2>
      <ol class="lista-fuentes">${fuentes.map((f) => html`<li><span>${f.cita}</span>${f.uso ? html`<br><span class="texto-suave">${f.uso}</span>` : ''}
        ${f.url ? html`<br><a href="${f.url}" target="_blank" rel="noopener noreferrer">${f.url}</a>` : ''}</li>`)}</ol></div>
    <img class="logo-autor" id="logo-autor" src="assets/icons/logo-kolh.png" alt="Logo del autor" width="160">
    <p class="aviso-corto">${cat.meta.avisoCorto}</p>
  </section>`);
  const logo = $('#logo-autor', main);
  logo.addEventListener('error', () => {
    if (!logo.src.endsWith('logo-kolh-placeholder.svg')) logo.src = 'assets/icons/logo-kolh-placeholder.svg';
  }, { once: false });
}
