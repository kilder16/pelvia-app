// Ajustes: vibración, sonido, PIN, Mi equipo, entrenamiento vesical, respaldo, informe, ejemplo, restablecer.

import { html, montar, h, $ } from '../../util/dom.js';
import { ajustes, guardarAjustes, leer, esDemo } from '../../store/repo.js';
import { exportar, importar } from '../../store/respaldo.js';
import { montarPin, hashPin } from '../componentes/pin.js';
import { abrirModal, confirmar, avisar } from '../componentes/modal.js';
import { cargarEjemplo } from './onboarding.js';
import { vibrar } from '../../util/vibrar.js';
import { beep, prepararAudio } from '../../util/audio.js';

function pedirNuevoPin() {
  const cont = h('div');
  return abrirModal({
    titulo: 'PIN de privacidad',
    cuerpo: cont,
    botones: [],
    alMontar: (_caja, cerrar) => montarPin(cont, { modo: 'crear', alExito: (pin) => cerrar(pin), alCancelar: () => cerrar(null) }),
  });
}

export function render({ cat, main, app, query }) {
  function pintar(mensaje = '') {
    const a = ajustes();
    const demo = esDemo();
    montar(main, html`<section>
      <div class="encabezado-vista"><h1>Ajustes</h1></div>
      <p role="status" aria-live="polite" class="${mensaje ? 'aviso aviso-exito' : ''}">${mensaje}</p>
      <div class="tarjeta"><h2>Durante las sesiones</h2>
        <label class="interruptor"><span>Vibrar al cambiar de fase</span><input type="checkbox" role="switch" id="aj-vib" ${a.vibracion ? 'checked' : ''}></label>
        <label class="interruptor"><span>Sonido al cambiar de fase</span><input type="checkbox" role="switch" id="aj-son" ${a.sonido ? 'checked' : ''}></label>
        <p class="texto-suave">En iPhone la vibración no está disponible desde el navegador; usa el sonido.</p>
      </div>
      <div class="tarjeta"><h2>PIN de privacidad</h2>
        <p>El PIN es una barrera de privacidad, no cifrado: evita miradas casuales, pero no protege los datos ante alguien con acceso técnico al celular.</p>
        <div class="fila">
          <button type="button" class="btn btn-secundario" data-accion="pin">${a.pinHash ? 'Cambiar PIN' : 'Crear PIN'}</button>
          ${a.pinHash ? html`<button type="button" class="btn" data-accion="quitar-pin">Quitar PIN</button>` : ''}
        </div>
      </div>
      <ul class="enlace-lista tarjeta">
        <li><a href="#/equipo">Mi equipo</a></li>
        <li><a href="#/vesical">Entrenamiento vesical (diario miccional)</a></li>
        <li><a href="#/informe">Informe para mi profesional</a></li>
        <li><a href="#/evaluacion?tipo=seguridad">Actualizar cuestionario de seguridad</a></li>
        <li><a href="#/evaluacion">Nueva evaluación inicial</a></li>
      </ul>
      <div class="tarjeta" id="respaldo"><h2>Respaldo</h2>
        <p>Tus datos se guardan solo en este celular. Exporta un respaldo de vez en cuando${a.ultimoRespaldo ? ` (último: ${a.ultimoRespaldo})` : ''}.</p>
        <div class="fila">
          <button type="button" class="btn btn-primario" data-accion="exportar">Exportar respaldo</button>
          <label class="btn btn-secundario" for="aj-importar">Importar respaldo</label>
        </div>
        <input type="file" id="aj-importar" accept=".json,application/json" class="solo-lectores">
      </div>
      <div class="tarjeta"><h2>Ejemplo y datos</h2>
        <p>${demo ? 'Estás viendo el ejemplo con datos ficticios.' : 'Mira cómo se ve PELVIA con 4 semanas de datos ficticios.'}</p>
        <div class="fila">
          ${demo ? '' : html`<button type="button" class="btn btn-secundario" data-accion="demo">Ver ejemplo (DEMO)</button>`}
          <button type="button" class="btn btn-peligro" data-accion="restablecer">Restablecer</button>
        </div>
      </div>
      <ul class="enlace-lista tarjeta"><li><a href="#/acerca">Acerca de PELVIA</a></li></ul>
      <p class="aviso-corto">${cat.meta.avisoCorto}</p>
    </section>`);
    enlazar();
  }

  function enlazar() {
    $('#aj-vib', main).addEventListener('change', (e) => { guardarAjustes({ vibracion: e.target.checked }); if (e.target.checked) vibrar([200]); });
    $('#aj-son', main).addEventListener('change', (e) => { guardarAjustes({ sonido: e.target.checked }); if (e.target.checked) { prepararAudio(); beep(880); } });
    $('[data-accion="pin"]', main).addEventListener('click', async () => {
      const pin = await pedirNuevoPin();
      if (!pin) return;
      guardarAjustes({ pinHash: await hashPin(pin), pinFallos: 0 });
      pintar('PIN guardado. Te lo pediremos al abrir la app.');
    });
    $('[data-accion="quitar-pin"]', main)?.addEventListener('click', async () => {
      if (!(await confirmar('Quitar PIN', 'La app se abrirá sin pedir PIN.', { si: 'Quitar PIN' }))) return;
      guardarAjustes({ pinHash: null, pinFallos: 0 });
      pintar('PIN quitado.');
    });
    $('[data-accion="exportar"]', main).addEventListener('click', () => {
      const { nombre, blob } = exportar();
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: nombre });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      pintar(`Respaldo descargado: ${nombre}. Guárdalo en un lugar seguro (por ejemplo, tu nube o correo).`);
    });
    $('#aj-importar', main).addEventListener('change', async (e) => {
      const archivo = e.target.files?.[0];
      if (!archivo) return;
      const texto = await archivo.text();
      const ok = await confirmar('Importar respaldo', `Se reemplazarán TODOS los datos actuales por los del archivo «${archivo.name}».`, { si: 'Reemplazar mis datos', peligro: true });
      e.target.value = '';
      if (!ok) return;
      try {
        importar(texto);
        app.refrescarCabecera();
        await avisar('Respaldo importado', 'Tus datos se restauraron.');
        location.hash = '#/hoy';
      } catch (err) {
        await avisar('No se pudo importar', err.message);
      }
    });
    $('[data-accion="demo"]', main)?.addEventListener('click', () => cargarEjemplo(cat, app));
    $('[data-accion="restablecer"]', main).addEventListener('click', async () => {
      const uno = await confirmar('Restablecer', 'Se borrarán todos los datos de este celular: evaluaciones, plan, sesiones, diario y ajustes.', { si: 'Continuar', peligro: true });
      if (!uno) return;
      const dos = await confirmar('¿Seguro?', 'Esta acción no se puede deshacer. Si no exportaste un respaldo, perderás tu progreso.', { si: 'Sí, borrar todo', peligro: true });
      if (dos) app.restablecerTodo({ preguntar: false });
    });
  }
  pintar();
  if (query?.ir === 'respaldo') $('#respaldo', main)?.scrollIntoView();
}
