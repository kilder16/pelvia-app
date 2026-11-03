// Onboarding con aviso y consentimiento explícito (RF-01).

// --- Lógica pura (probada en tests/ui.onboarding.test.js; no cambiar firmas) ---------------------
/** Rutas a las que se puede entrar sin haber aceptado el aviso. */
export const RUTAS_LIBRES = ['onboarding', 'acerca', 'pin'];

export function tieneConsentimiento(perfil) {
  return perfil?.consentimiento === true;
}

/** ¿Se puede navegar a `ruta` (sin '#/', p. ej. 'hoy', 'sesion')? */
export function accesoPermitido(perfil, ruta) {
  const base = String(ruta ?? '').replace(/^#?\/?/, '').split('/')[0];
  return RUTAS_LIBRES.includes(base) || tieneConsentimiento(perfil);
}

/** Estado habilitado/deshabilitado de los botones principales del onboarding. */
export function estadoBotones(perfil) {
  const ok = tieneConsentimiento(perfil);
  return { evaluacion: ok, hoy: ok, biblioteca: ok };
}
// --- Fin de la lógica pura -----------------------------------------------------------------------

// --- Render (solo navegador) ---------------------------------------------------------------------
import { html, montar, $, il } from '../../util/dom.js';
import { leer, guardar, cargarDemo, esDemo, nuevoId } from '../../store/repo.js';
import { hoyISO } from '../../util/fechas.js';
import { navegar } from '../../router.js';
import { confirmar } from '../componentes/modal.js';

/** Carga el caso DEMO (RF-16), pidiendo confirmación si hay datos propios. */
export async function cargarEjemplo(cat, app) {
  const hayDatos = !esDemo() && (leer('plan') || (leer('evaluaciones', []) ?? []).length || (leer('sesiones', []) ?? []).length);
  if (hayDatos) {
    const ok = await confirmar('Ver ejemplo', 'El ejemplo reemplaza los datos guardados en este celular. Si quieres conservarlos, exporta un respaldo antes en Ajustes.', { si: 'Reemplazar y ver ejemplo', peligro: true });
    if (!ok) return false;
  }
  cargarDemo(cat, hoyISO());
  app.avisosPendientes = [];
  app.refrescarCabecera();
  navegar('#/hoy');
  return true;
}

export function render({ cat, main, app }) {
  const pintar = () => {
    const perfil = leer('perfil');
    const b = estadoBotones(perfil);
    const ok = tieneConsentimiento(perfil);
    montar(main, html`<section class="onboarding">
      <div class="encabezado-vista">
        <h1>Bienvenida a PELVIA</h1>
        <p>Tu guía para la terapia del suelo pélvico con ejercicios, biofeedback y tu electroestimulador.</p>
      </div>
      <div class="aviso aviso-alerta" id="aviso-completo">
        <h2>Antes de empezar</h2>
        <p>${cat.meta.aviso}</p>
      </div>
      <div class="tarjeta">
        <label class="casilla"><input type="checkbox" id="consentimiento" ${ok ? 'checked' : ''}>
          <span>Leí y entiendo el aviso. Uso PELVIA como apoyo y consultaré a un profesional de salud si tengo dudas, dolor o no mejoro.</span></label>
      </div>
      <div class="pila">
        <button type="button" class="btn btn-primario btn-grande" data-ir="#/evaluacion" ${b.evaluacion ? '' : 'disabled'}>Evaluación</button>
        <div class="fila">
          <button type="button" class="btn btn-secundario" data-ir="#/hoy" ${b.hoy ? '' : 'disabled'}>Hoy</button>
          <button type="button" class="btn btn-secundario" data-ir="#/biblioteca" ${b.biblioteca ? '' : 'disabled'}>Biblioteca</button>
        </div>
        ${!ok ? html`<p class="texto-suave" id="ayuda-consent">Marca la casilla para activar los botones.</p>` : ''}
        <button type="button" class="btn" id="ver-ejemplo">Ver ejemplo (datos ficticios)</button>
        <a class="btn-texto" href="#/acerca">Acerca de PELVIA y fuentes clínicas</a>
      </div>
      ${il('IL-01')}
      <p class="aviso-corto">${cat.meta.avisoCorto}</p>
    </section>`);
    $('#consentimiento', main).addEventListener('change', (ev) => {
      const previo = leer('perfil');
      const hoy = hoyISO();
      if (ev.target.checked) {
        guardar('perfil', { id: previo?.id ?? nuevoId('perfil'), ...(previo ?? {}), consentimiento: true, fechaConsentimiento: hoy, creado: previo?.creado ?? hoy, demo: previo?.demo ?? false });
      } else if (previo) {
        guardar('perfil', { ...previo, consentimiento: false });
      }
      pintar();
      $('#consentimiento', main).focus();
    });
    main.querySelectorAll('[data-ir]').forEach((btn) => btn.addEventListener('click', () => navegar(btn.dataset.ir)));
    $('#ver-ejemplo', main).addEventListener('click', () => cargarEjemplo(cat, app));
  };
  pintar();
}
