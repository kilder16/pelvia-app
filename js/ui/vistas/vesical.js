// Entrenamiento vesical (RF-15): diario miccional de 3 días, intervalo objetivo y técnica de supresión.

import { html, montar, $, $$ } from '../../util/dom.js';
import { leer, guardar, agregarA, nuevoId, guardarSesion } from '../../store/repo.js';
import { intervaloMedio, intervaloObjetivo, resumenDia } from '../../engine/vesical.js';
import { hoyISO, formatoCorto, diaSemana, DIAS } from '../../util/fechas.js';
import { il } from '../../util/dom.js';
import { confirmar } from '../componentes/modal.js';

const ETIQUETA = { miccion: 'Oriné', urgencia: 'Urgencia', escape: 'Escape' };

function horaActual() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function sumarMinutos(hhmm, min) {
  const [hh, mm] = hhmm.split(':').map(Number);
  const t = (hh * 60 + mm + min) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

const fmtMin = (m) => (m == null ? '—' : m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`);

/** Agrupa eventos por fecha (más reciente primero). */
export function porDia(eventos) {
  const mapa = new Map();
  for (const e of eventos ?? []) {
    if (!mapa.has(e.fecha)) mapa.set(e.fecha, []);
    mapa.get(e.fecha).push(e);
  }
  for (const l of mapa.values()) l.sort((a, b) => a.hora.localeCompare(b.hora));
  return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

export function render({ cat, main, query }) {
  const ev = cat.entrenamientoVesical;
  const sup = cat.tipoSesion('VES-SUPRESION');
  const plan = leer('plan');
  const semanaQ = query.semana ? Number(query.semana) : null;
  const diaQ = DIAS.includes(query.dia) ? query.dia : null;

  function pintar(mensaje = '') {
    const eventos = leer('diario', []) ?? [];
    const dias = porDia(eventos);
    const conMicciones = [...dias].reverse().filter(([, l]) => l.some((e) => e.tipo === 'miccion'));
    const basal = conMicciones.slice(0, ev.diasDiario ?? 3);
    const ultimos3 = dias.slice(0, 3);
    const medio = intervaloMedio(basal.map(([, l]) => ({ micciones: l.filter((e) => e.tipo === 'miccion').map((e) => e.hora) })));
    const semanaEntreno = plan ? Math.max(0, (plan.semanaActual ?? 1) - 1) : 0;
    const objetivo = intervaloObjetivo(medio, semanaEntreno, cat);
    const hoy = hoyISO();
    const hoyMicc = eventos.filter((e) => e.fecha === hoy && e.tipo === 'miccion').sort((a, b) => a.hora.localeCompare(b.hora));
    const ultima = hoyMicc[hoyMicc.length - 1];
    const marcarDia = plan && semanaQ && diaQ;

    montar(main, html`<section>
      <div class="encabezado-vista"><h1>Entrenamiento vesical</h1>
        <p>Anota cada vez que orinas, tienes urgencia o un escape. Con 3 días de diario calculamos tu intervalo y lo alargamos ${ev.incrementoMinPorSemana} minutos cada semana, hasta ${fmtMin(ev.objetivoMin)}–${fmtMin(ev.objetivoMaxMin)}.</p></div>
      <p role="status" aria-live="polite" class="${mensaje ? 'aviso aviso-exito' : ''}">${mensaje}</p>
      <div class="botones-diario">
        <button type="button" class="btn btn-miccion" data-evento="miccion">Acabo de orinar</button>
        <button type="button" class="btn btn-urgencia" data-evento="urgencia">Tuve urgencia</button>
        <button type="button" class="btn btn-escape" data-evento="escape">Tuve un escape</button>
      </div>
      ${marcarDia ? html`<button type="button" class="btn btn-secundario btn-ancho" data-accion="terminar-dia">Terminé el diario de hoy</button>` : ''}
      <div class="tarjeta" style="margin-top:var(--esp-4)">
        <h2>Tu intervalo</h2>
        ${medio == null ? html`<p>Todavía no hay suficientes micciones anotadas. Registra al menos 2 en un día.</p>` : html`
          <p>Intervalo medio de tu diario (${basal.length} día${basal.length === 1 ? '' : 's'}): <strong>${fmtMin(medio)}</strong></p>
          <p>Objetivo de esta semana${plan ? ` (semana ${plan.semanaActual})` : ''}:</p>
          <p class="objetivo-grande">${fmtMin(objetivo)}</p>
          <p>${ultima ? html`Próxima micción objetivo: <strong>${sumarMinutos(ultima.hora, objetivo)}</strong> (última a las ${ultima.hora}).` : 'Cuando registres tu primera micción de hoy te diremos la hora objetivo de la siguiente.'}</p>`}
      </div>
      <div class="tarjeta"><h2>Resumen de los últimos 3 días</h2>
        ${ultimos3.length ? html`<div class="tabla-scroll"><table class="tabla"><thead><tr><th scope="col">Día</th><th scope="col">Micciones</th><th scope="col">Urgencias</th><th scope="col">Escapes</th><th scope="col">Intervalo</th></tr></thead>
          <tbody>${ultimos3.map(([f, l]) => { const r = resumenDia(f, l); return html`<tr><td>${formatoCorto(f)}</td><td>${r.micciones}</td><td>${r.urgencias}</td><td>${r.escapes}</td><td>${fmtMin(r.intervaloMedioMin)}</td></tr>`; })}</tbody></table></div>`
          : html`<p>Sin registros todavía.</p>`}
      </div>
      <div class="tarjeta"><h2>Registro por día</h2>
        ${dias.length ? dias.slice(0, 7).map(([f, l]) => html`<h3>${formatoCorto(f)}</h3><ul class="eventos">${l.map((e) => html`<li><span>${e.hora} · ${ETIQUETA[e.tipo]}</span><button type="button" class="btn-texto" data-quitar="${e.id}" aria-label="Quitar ${ETIQUETA[e.tipo]} de las ${e.hora}">Quitar</button></li>`)}</ul>`)
          : html`<p>Aún no anotaste nada.</p>`}
      </div>
      <div class="tarjeta"><h2>Técnica de supresión de la urgencia</h2>
        <ol class="pasos-lista">${sup.pasos.map((p) => html`<li>${p}</li>`)}</ol>
        <a class="btn btn-primario btn-ancho" href="#/sesion/VES-SUPRESION">Practicar la técnica</a></div>
      <div class="tarjeta"><h2>Consejos</h2><ul>${ev.consejos.map((c) => html`<li>${c}</li>`)}</ul>
        <p><strong>Líquidos:</strong> ${String(ev.liquidosLitrosDia[0]).replace('.', ',')} a ${String(ev.liquidosLitrosDia[1]).replace('.', ',')} litros al día.</p>
        <p><strong>Reduce los irritantes de la vejiga:</strong> ${ev.irritantes.join(', ')}.</p></div>
      ${il('IL-14')}
      <p class="aviso-corto">${cat.meta.avisoCorto}</p>
    </section>`);

    $$('[data-evento]', main).forEach((b) => b.addEventListener('click', () => {
      const hora = horaActual();
      agregarA('diario', { id: nuevoId('dia'), fecha: hoyISO(), hora, tipo: b.dataset.evento });
      pintar(`Anotado: ${ETIQUETA[b.dataset.evento]} a las ${hora}.`);
    }));
    $$('[data-quitar]', main).forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmar('Quitar registro', '¿Quitar este registro del diario?', { si: 'Quitar' }))) return;
      guardar('diario', (leer('diario', []) ?? []).filter((e) => e.id !== b.dataset.quitar));
      pintar('Registro quitado.');
    }));
    $('[data-accion="terminar-dia"]', main)?.addEventListener('click', () => {
      const ya = (leer('sesiones', []) ?? []).some((s) => s.tipoSesionId === 'VES-DIARIO' && s.semana === semanaQ && s.dia === diaQ && s.completada);
      if (!ya) {
        guardarSesion({ fecha: `${hoyISO()}T${horaActual()}:00`, dia: diaQ, semana: semanaQ, tipoSesionId: 'VES-DIARIO', nivel: plan.nivelActual, duracionRealSeg: 0, completada: true, repsPlanificadas: 0 });
      }
      pintar(`Diario del ${diaSemana(hoyISO()) === diaQ ? 'día' : 'día planificado'} marcado como hecho.`);
    });
  }
  pintar();
}
