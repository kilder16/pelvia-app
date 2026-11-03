// PIN de privacidad de 4 dígitos (RF-19; ADR-0003). No es cifrado: es una barrera ante miradas casuales.

// --- Lógica pura (probada en tests/pin.test.js; no cambiar firmas) -------------------------------
export const MAX_FALLOS = 5;
const SAL = 'pelvia:pin:v1:';

export function formatoPinValido(pin) {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

/** SHA-256 en hexadecimal vía crypto.subtle (navegador y Node ≥ 20). */
export async function hashPin(pin) {
  if (!formatoPinValido(pin)) throw new RangeError('El PIN debe tener 4 dígitos.');
  const datos = new TextEncoder().encode(SAL + pin);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verificarPin(pin, hash) {
  if (!formatoPinValido(pin) || typeof hash !== 'string') return false;
  return (await hashPin(pin)) === hash;
}

/**
 * Lleva la cuenta de intentos. Tras MAX_FALLOS fallos solo se ofrece "Restablecer datos".
 * @param {{fallos:number}} estado
 * @param {boolean} acierto
 */
export function registrarIntento(estado, acierto) {
  const fallos = acierto ? 0 : (estado?.fallos ?? 0) + 1;
  return {
    fallos,
    desbloqueado: acierto,
    ofrecerRestablecer: fallos >= MAX_FALLOS,
    restantes: Math.max(0, MAX_FALLOS - fallos),
  };
}
// --- Fin de la lógica pura -----------------------------------------------------------------------

// --- Render (solo navegador) ---------------------------------------------------------------------
import { html, montar, $, $$ } from '../../util/dom.js';
import { ajustes, guardarAjustes } from '../../store/repo.js';

/**
 * Teclado numérico grande para el PIN.
 * @param {HTMLElement} cont
 * @param {{modo:'verificar'|'crear', titulo?:string, alExito:(pin:string)=>void, alRestablecer?:()=>void,
 *          alCancelar?:()=>void}} op
 */
export function montarPin(cont, { modo = 'verificar', titulo, alExito, alRestablecer, alCancelar }) {
  let pin = '';
  let primero = null;
  let verificando = false;
  const bloqueadoAhora = () => modo === 'verificar' && (ajustes().pinFallos ?? 0) >= MAX_FALLOS;
  // Limpieza explícita del teclado físico: en éxito, bloqueo y cancelación (no depende de isConnected).
  const limpiar = () => document.removeEventListener('keydown', teclado);
  const tituloBase = titulo ?? (modo === 'crear' ? 'Elige un PIN de 4 dígitos' : 'Escribe tu PIN');

  function pintar(mensaje = '', error = false) {
    const fallos = ajustes().pinFallos ?? 0;
    const bloqueado = modo === 'verificar' && fallos >= MAX_FALLOS;
    if (bloqueado) {
      limpiar();
      montar(cont, html`<section class="pin" aria-labelledby="pin-t">
        <h1 id="pin-t">Demasiados intentos</h1>
        <p>Fallaste el PIN ${MAX_FALLOS} veces. La única salida es restablecer los datos (se borra todo lo guardado en este celular).</p>
        <button type="button" class="btn btn-peligro btn-grande" data-accion="restablecer">Restablecer datos</button>
      </section>`);
      $('[data-accion="restablecer"]', cont).addEventListener('click', () => alRestablecer?.());
      return;
    }
    const subt = modo === 'crear' && primero ? 'Repite el PIN para confirmarlo' : tituloBase;
    montar(cont, html`<section class="pin" aria-labelledby="pin-t">
      <h1 id="pin-t">${subt}</h1>
      <div class="pin-puntos" aria-label="${pin.length} de 4 dígitos escritos">${[0, 1, 2, 3].map((i) => html`<span class="${i < pin.length ? 'lleno' : ''}"></span>`)}</div>
      <p class="pin-mensaje ${error ? 'error' : ''}" role="status" aria-live="polite">${mensaje}</p>
      <div class="pin-teclado">
        ${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => html`<button type="button" class="pin-tecla" data-d="${d}">${d}</button>`)}
        ${alCancelar ? html`<button type="button" class="pin-tecla pin-tecla--txt" data-accion="cancelar">Cancelar</button>` : html`<span></span>`}
        <button type="button" class="pin-tecla" data-d="0">0</button>
        <button type="button" class="pin-tecla pin-tecla--txt" data-accion="borrar" aria-label="Borrar último dígito">Borrar</button>
      </div>
      ${modo === 'verificar' ? html`<p class="texto-suave">El PIN es una barrera de privacidad, no cifrado.</p>` : ''}
    </section>`);
    $$('[data-d]', cont).forEach((b) => b.addEventListener('click', () => tecla(b.dataset.d)));
    $('[data-accion="borrar"]', cont).addEventListener('click', () => { pin = pin.slice(0, -1); pintar(); });
    $('[data-accion="cancelar"]', cont)?.addEventListener('click', () => { limpiar(); alCancelar?.(); });
    $('.pin-tecla', cont)?.focus();
  }

  async function tecla(d) {
    if (bloqueadoAhora()) { pintar(); return; } // tras 5 fallos no se aceptan más intentos
    if (verificando || pin.length >= 4) return;
    pin += d;
    if (pin.length < 4) { pintar(); return; }
    if (modo === 'crear') {
      if (!primero) { primero = pin; pin = ''; pintar(); return; }
      if (primero !== pin) { primero = null; pin = ''; pintar('Los PIN no coinciden. Empieza de nuevo.', true); return; }
      limpiar();
      alExito(pin);
      return;
    }
    verificando = true;
    let ok;
    try {
      ok = await verificarPin(pin, ajustes().pinHash);
    } finally {
      verificando = false;
    }
    const r = registrarIntento({ fallos: ajustes().pinFallos ?? 0 }, ok);
    guardarAjustes({ pinFallos: r.fallos });
    pin = '';
    if (ok) { limpiar(); alExito(); }
    else pintar(r.ofrecerRestablecer ? '' : `PIN incorrecto. Te quedan ${r.restantes} intento(s).`, true);
  }

  function teclado(ev) {
    if (!cont.isConnected) { limpiar(); return; }
    const t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (/^\d$/.test(ev.key)) tecla(ev.key);
    else if (ev.key === 'Backspace') { pin = pin.slice(0, -1); pintar(); }
  }
  document.addEventListener('keydown', teclado);
  pintar();
}
