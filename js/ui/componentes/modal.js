// Modal accesible: role="dialog", aria-modal, foco atrapado, Escape cierra, devuelve el foco al cerrar.

import { html, montar, Seguro, $$ } from '../../util/dom.js';

const ENFOCABLES = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let contador = 0;

/**
 * @param {{titulo:string, cuerpo?:Seguro|Node|string, botones?:{texto:string, valor:any, clase?:string}[],
 *          cerrable?:boolean, alMontar?:(raiz:HTMLElement, cerrar:(v:any)=>void)=>void}} op
 * @returns {Promise<any>} el `valor` del botón pulsado (null si se cerró con Escape)
 */
export function abrirModal({ titulo, cuerpo = '', botones = [{ texto: 'Entendido', valor: true, clase: 'btn btn-primario' }],
  cerrable = true, alMontar } = {}) {
  return new Promise((resolver) => {
    const previo = document.activeElement;
    const id = `modal-t-${++contador}`;
    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo';
    const caja = document.createElement('div');
    caja.className = 'modal';
    caja.setAttribute('role', 'dialog');
    caja.setAttribute('aria-modal', 'true');
    caja.setAttribute('aria-labelledby', id);
    montar(caja, html`<h2 id="${id}" class="modal-titulo" tabindex="-1">${titulo}</h2><div class="modal-cuerpo"></div><div class="modal-botones"></div>`);
    const cont = caja.querySelector('.modal-cuerpo');
    if (cuerpo instanceof Seguro) montar(cont, cuerpo);
    else if (cuerpo instanceof Node) cont.append(cuerpo);
    else cont.textContent = String(cuerpo ?? '');
    const zonaBotones = caja.querySelector('.modal-botones');
    for (const b of botones) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = b.clase ?? 'btn';
      btn.textContent = b.texto;
      btn.dataset.valor = '1';
      btn.addEventListener('click', () => cerrar(b.valor));
      zonaBotones.append(btn);
    }
    fondo.append(caja);

    const fuera = $$('body > *:not(.modal-fondo)');
    fuera.forEach((el) => el.setAttribute('inert', ''));

    function cerrar(valor) {
      document.removeEventListener('keydown', teclado, true);
      fondo.remove();
      if (!document.querySelector('.modal-fondo')) fuera.forEach((el) => el.removeAttribute('inert'));
      if (previo && typeof previo.focus === 'function' && document.contains(previo)) previo.focus();
      resolver(valor);
    }

    function teclado(ev) {
      if (ev.key === 'Escape' && cerrable) {
        ev.preventDefault();
        cerrar(null);
      } else if (ev.key === 'Tab') {
        const els = $$(ENFOCABLES, caja).filter((e) => e.offsetParent !== null || e === document.activeElement);
        if (!els.length) return;
        const primero = els[0];
        const ultimo = els[els.length - 1];
        if (ev.shiftKey && (document.activeElement === primero || !caja.contains(document.activeElement))) {
          ev.preventDefault();
          ultimo.focus();
        } else if (!ev.shiftKey && (document.activeElement === ultimo || !caja.contains(document.activeElement))) {
          ev.preventDefault();
          primero.focus();
        }
      }
    }
    document.addEventListener('keydown', teclado, true);
    document.body.append(fondo);
    if (alMontar) alMontar(caja, cerrar);
    const primerBoton = zonaBotones.querySelector('button');
    (caja.querySelector('[autofocus]') ?? primerBoton ?? caja.querySelector('.modal-titulo')).focus();
  });
}

export async function confirmar(titulo, texto, { si = 'Sí, continuar', no = 'Cancelar', peligro = false } = {}) {
  const v = await abrirModal({
    titulo,
    cuerpo: texto instanceof Seguro ? texto : html`<p>${texto}</p>`,
    botones: [
      { texto: no, valor: false, clase: 'btn btn-secundario' },
      { texto: si, valor: true, clase: peligro ? 'btn btn-peligro' : 'btn btn-primario' },
    ],
  });
  return v === true;
}

export function avisar(titulo, texto, boton = 'Entendido') {
  return abrirModal({
    titulo,
    cuerpo: texto instanceof Seguro ? texto : html`<p>${texto}</p>`,
    botones: [{ texto: boton, valor: true, clase: 'btn btn-primario' }],
  });
}
