// "Mi equipo": marca/modelo, tipo, sondas, mA máximo y mapeo de programas (RF-17; ADR-0002).

// --- Lógica pura (probada en tests/equipo.test.js; no cambiar firmas) ----------------------------
/** Sondas "base" de un equipo conocido (sin las marcadas como opcionales). */
export function sondasBase(conocido) {
  return (conocido?.sondas ?? [])
    .map((s) => s.toLowerCase())
    .filter((s) => !s.includes('opcional'))
    .map((s) => (s.startsWith('vaginal') ? 'vaginal' : s.startsWith('anal') ? 'anal' : s.startsWith('electrodos') ? 'electrodos' : null))
    .filter(Boolean);
}

/**
 * Construye el objeto EQUIPO a partir de un equipo conocido del catálogo.
 * @param {object} catalogo
 * @param {string} marca
 * @param {string} modelo
 * @param {{tipoSonda?:string, sondas?:string[], tieneEMG?:boolean}} [elecciones]  lo que la usuaria marca
 */
export function equipoDesdeConocido(catalogo, marca, modelo, elecciones = {}) {
  const c = catalogo.equipoConocido(marca, modelo);
  if (!c) throw new Error(`Equipo no encontrado: ${marca} ${modelo ?? ''}`.trim());
  const base = sondasBase(c);
  const sondas = elecciones.sondas ?? base;
  const tipoSonda = elecciones.tipoSonda ?? sondas[0] ?? null;
  // Solo mapeos a tipos de sesión existentes (p. ej. "ajuste manual según ficha" queda como nota).
  const programas = {};
  for (const [nombre, tipo] of Object.entries(c.programas ?? {})) {
    if (catalogo.tipoSesion(tipo)) programas[nombre] = tipo;
  }
  const eq = {
    marca: c.marca,
    modelo: modelo ?? c.modelos[0],
    tipo: c.tipo ?? null,
    tipoSonda,
    sondas,
    mAMax: c.mAMax,
    ajusteManual: c.ajusteManual,
    programas,
    nota: c.nota ?? '',
  };
  if (typeof c.tieneEMG === 'boolean') eq.tieneEMG = c.tieneEMG;
  if (typeof elecciones.tieneEMG === 'boolean') eq.tieneEMG = elecciones.tieneEMG;
  if (typeof c.tieneEstimulacion === 'boolean') eq.tieneEstimulacion = c.tieneEstimulacion;
  if (c.parametrosFijos) eq.parametrosFijos = { ...c.parametrosFijos };
  return catalogo.resolverEquipo ? catalogo.resolverEquipo(eq) : eq;
}
// --- Fin de la lógica pura -----------------------------------------------------------------------

// --- Render (solo navegador) ---------------------------------------------------------------------
import { html, montar, h, $, $$ } from '../../util/dom.js';
import { leer, guardar } from '../../store/repo.js';
import { regenerarConEquipo } from '../../engine/planificador.js';
import { resumenParametros } from '../componentes/ficha-parametros.js';
import { avisar, confirmar } from '../componentes/modal.js';

const SONDAS = [['vaginal', 'Sonda vaginal'], ['anal', 'Sonda anal'], ['electrodos', 'Electrodos adhesivos']];

/** Estado editable del formulario a partir de un equipo conocido (o del guardado). */
function estadoDesde(cat, marca, modelo, guardado = null) {
  const c = cat.equipoConocido(marca, modelo) ?? cat.equipoConocido(marca);
  if (!c) return null;
  const base = equipoDesdeConocido(cat, c.marca, c.modelos.includes(modelo) ? modelo : c.modelos[0]);
  const src = guardado ?? base;
  const notas = Object.entries(c.programas ?? {}).filter(([, t]) => !cat.tipoSesion(t)).map(([n, t]) => `${n}: ${t}`);
  return {
    marca: c.marca,
    modelo: src.modelo ?? base.modelo,
    tipo: src.tipo ?? base.tipo,
    sondas: [...(src.sondas ?? base.sondas ?? [])].filter((s) => SONDAS.some(([id]) => id === s)),
    tieneEstimulacion: src.tieneEstimulacion ?? base.tieneEstimulacion,
    tieneEMG: src.tieneEMG ?? base.tieneEMG ?? false,
    aplicaFicha: src.aplicaFicha ?? base.aplicaFicha,
    mAMax: src.mAMax ?? base.mAMax ?? 0,
    programas: Object.entries(src.programas ?? {}).map(([nombre, tipo]) => ({ nombre, tipo })),
    nota: c.nota ?? '',
    notasProgramas: notas,
    parametrosFijos: c.parametrosFijos ?? null,
  };
}

export function render({ cat, main }) {
  const guardado = leer('equipo');
  const tiposCorriente = cat.tiposSesion().filter((t) => cat.usaCorriente(t.id));
  let f = guardado ? estadoDesde(cat, guardado.marca, guardado.modelo, guardado) : null;
  const raiz = h('div');
  main.append(raiz);

  function pintar() {
    const conocido = f ? cat.equipoConocido(f.marca) : null;
    const tipoEq = f ? cat.tipoEquipo(f.tipo) : null;
    const generico = f && /^Gen[ée]rico/i.test(f.marca);
    montar(raiz, html`<section>
      <div class="encabezado-vista"><h1>Mi equipo</h1>
        <p>Elige tu electroestimulador o sensor. PELVIA no se conecta al equipo: solo te dice qué programa o qué valores usar.</p></div>
      ${guardado && !f ? html`<div class="aviso aviso-info"><p>Equipo registrado: <strong>${guardado.marca} ${guardado.modelo ?? ''}</strong>. Elige una marca de la lista para editarlo.</p></div>` : ''}
      <form id="form-equipo" novalidate>
        <div class="tarjeta">
          <div class="campo"><label for="eq-marca">Marca</label>
            <select id="eq-marca"><option value="">Elige la marca…</option>${cat.equiposConocidos.map((e) => html`<option value="${e.marca}" ${f?.marca === e.marca ? 'selected' : ''}>${e.marca}</option>`)}</select></div>
          ${f ? html`<div class="campo"><label for="eq-modelo">Modelo</label>
            <select id="eq-modelo">${conocido.modelos.map((m) => html`<option value="${m}" ${f.modelo === m ? 'selected' : ''}>${m}</option>`)}</select></div>
          <div class="campo"><label for="eq-tipo">Tipo de equipo</label>
            <select id="eq-tipo">${cat.tiposEquipo().map((t) => html`<option value="${t.id}" ${f.tipo === t.id ? 'selected' : ''}>${t.nombre}</option>`)}</select>
            ${tipoEq ? html`<span class="texto-suave">${tipoEq.descripcion}</span>` : ''}</div>` : html`<p class="texto-suave">${cat.equipoNoIdentificado}</p>`}
        </div>
        ${f ? html`
        ${generico ? html`<div class="aviso aviso-info"><p>${cat.equipoNoIdentificado}</p></div>` : ''}
        ${f.nota ? html`<div class="aviso aviso-info"><p>${f.nota}</p></div>` : ''}
        ${f.tieneEstimulacion === false ? html`<div class="aviso aviso-alerta"><p><strong>Tu equipo no electroestimula:</strong> el plan no tendrá sesiones con corriente; se reemplazan por ejercicios y biofeedback.</p></div>` : ''}
        ${f.aplicaFicha === false && f.tieneEstimulacion !== false ? html`<div class="aviso aviso-alerta"><p><strong>Tu equipo fija sus parámetros:</strong> solo sigue el temporizador.${f.parametrosFijos ? ` (${resumenParametros(f.parametrosFijos)})` : ''}</p></div>` : ''}
        <fieldset class="tarjeta"><legend>Sondas o electrodos que tienes</legend>
          ${SONDAS.map(([id, txt]) => html`<label class="casilla"><input type="checkbox" name="sonda" value="${id}" ${f.sondas.includes(id) ? 'checked' : ''}><span>${txt}</span></label>`)}</fieldset>
        <fieldset class="tarjeta"><legend>Qué hace tu equipo</legend>
          <label class="casilla"><input type="checkbox" id="eq-est" ${f.tieneEstimulacion ? 'checked' : ''}><span>Electroestimula (da corriente)</span></label>
          <label class="casilla"><input type="checkbox" id="eq-emg" ${f.tieneEMG ? 'checked' : ''}><span>Tiene biofeedback EMG (muestra la actividad del músculo)</span></label>
          <label class="casilla"><input type="checkbox" id="eq-ficha" ${f.aplicaFicha ? 'checked' : ''}><span>Puedo ajustar los valores (Hz, µs, ON/OFF) o elegir programas: usar la ficha</span></label>
          <div class="campo"><label for="eq-ma">Intensidad máxima del equipo (mA)</label><input type="number" id="eq-ma" inputmode="numeric" min="0" max="200" step="1" value="${f.mAMax}"></div>
        </fieldset>
        <div class="tarjeta"><h2>Programas de tu equipo</h2>
          <p class="texto-suave">Nombre del programa en tu equipo → sesión de PELVIA equivalente. Puedes editarlos según tu manual.</p>
          ${f.programas.length ? html`<table class="tabla-programas"><thead><tr><th scope="col">Programa</th><th scope="col">Sesión</th><th scope="col"><span class="solo-lectores">Quitar</span></th></tr></thead><tbody>
          ${f.programas.map((p, i) => html`<tr>
            <td><input type="text" data-prog-nombre="${i}" value="${p.nombre}" aria-label="Nombre del programa ${i + 1}" maxlength="60"></td>
            <td><select data-prog-tipo="${i}" aria-label="Sesión equivalente al programa ${i + 1}">${tiposCorriente.map((t) => html`<option value="${t.id}" ${p.tipo === t.id ? 'selected' : ''}>${t.id}</option>`)}</select></td>
            <td><button type="button" class="btn-quitar" data-prog-quitar="${i}" aria-label="Quitar programa ${p.nombre}">×</button></td></tr>`)}
          </tbody></table>` : html`<p class="texto-suave">Sin programas: configura el equipo a mano con la ficha de cada sesión.</p>`}
          <button type="button" class="btn btn-secundario" data-accion="agregar">Agregar programa</button>
          ${f.notasProgramas.length ? html`<h3 style="margin-top:var(--esp-3)">Notas del fabricante</h3><ul>${f.notasProgramas.map((n) => html`<li>${n}</li>`)}</ul>` : ''}
        </div>
        <div class="acciones-pie"><button type="submit" class="btn btn-primario btn-grande">Guardar mi equipo</button></div>` : ''}
      </form>
      ${guardado ? html`<button type="button" class="btn-texto" data-accion="quitar-equipo">No tengo equipo / quitar el registrado</button>` : ''}
      ${f || guardado ? '' : html`<p class="texto-suave">Si aún no tienes equipo, tu plan usa ejercicios equivalentes.</p>`}
      <p class="aviso-corto">${cat.meta.avisoCorto}</p>
    </section>`);
    enlazar();
  }

  function leerFormulario() {
    if (!f || !$('#eq-est', raiz)) return;
    f.sondas = $$('input[name="sonda"]:checked', raiz).map((x) => x.value);
    f.tieneEstimulacion = $('#eq-est', raiz).checked;
    f.tieneEMG = $('#eq-emg', raiz).checked;
    f.aplicaFicha = $('#eq-ficha', raiz).checked;
    f.mAMax = Number($('#eq-ma', raiz).value || 0);
    f.programas = f.programas.map((p, i) => ({
      nombre: $(`[data-prog-nombre="${i}"]`, raiz)?.value ?? p.nombre,
      tipo: $(`[data-prog-tipo="${i}"]`, raiz)?.value ?? p.tipo,
    }));
  }

  function enlazar() {
    $('#eq-marca', raiz).addEventListener('change', (e) => {
      const c = cat.equipoConocido(e.target.value);
      f = c ? estadoDesde(cat, c.marca, c.modelos[0]) : null;
      pintar();
      $('#eq-marca', raiz).focus();
    });
    $('#eq-modelo', raiz)?.addEventListener('change', (e) => {
      f = estadoDesde(cat, f.marca, e.target.value);
      pintar();
      $('#eq-modelo', raiz).focus();
    });
    $('#eq-tipo', raiz)?.addEventListener('change', (e) => {
      leerFormulario();
      const d = cat.resolverEquipo({ tipo: e.target.value });
      Object.assign(f, { tipo: e.target.value, tieneEstimulacion: d.tieneEstimulacion, tieneEMG: d.tieneEMG, aplicaFicha: d.aplicaFicha });
      pintar();
      $('#eq-tipo', raiz).focus();
    });
    ['#eq-est', '#eq-ficha'].forEach((sel) => $(sel, raiz)?.addEventListener('change', () => { leerFormulario(); pintar(); $(sel, raiz).focus(); }));
    $('[data-accion="agregar"]', raiz)?.addEventListener('click', () => {
      leerFormulario();
      f.programas.push({ nombre: '', tipo: 'EST-IUE' });
      pintar();
      $(`[data-prog-nombre="${f.programas.length - 1}"]`, raiz)?.focus();
    });
    $$('[data-prog-quitar]', raiz).forEach((b) => b.addEventListener('click', () => {
      leerFormulario();
      f.programas.splice(Number(b.dataset.progQuitar), 1);
      pintar();
    }));
    $('[data-accion="quitar-equipo"]', raiz)?.addEventListener('click', async () => {
      if (!(await confirmar('Quitar equipo', 'Tu plan usará ejercicios equivalentes en lugar de las sesiones con equipo.', { si: 'Quitar' }))) return;
      guardar('equipo', null);
      const plan = leer('plan');
      if (plan) guardar('plan', regenerarConEquipo(plan, null, cat));
      await avisar('Equipo quitado', plan ? 'Tu plan se recalculó desde esta semana.' : 'Listo.');
      location.hash = '#/ajustes';
    });
    $('#form-equipo', raiz).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!f) return;
      leerFormulario();
      const programas = {};
      for (const p of f.programas) if (p.nombre.trim() && cat.tipoSesion(p.tipo)) programas[p.nombre.trim()] = p.tipo;
      const base = equipoDesdeConocido(cat, f.marca, f.modelo, { sondas: f.sondas, tipoSonda: f.sondas[0] ?? null, tieneEMG: f.tieneEMG });
      const eq = cat.resolverEquipo({
        ...base, tipo: f.tipo, tieneEstimulacion: f.tieneEstimulacion, tieneEMG: f.tieneEMG, aplicaFicha: f.aplicaFicha,
        mAMax: f.mAMax, programas, notasProgramas: f.notasProgramas,
      });
      guardar('equipo', eq);
      const plan = leer('plan');
      if (plan) guardar('plan', regenerarConEquipo(plan, eq, cat));
      await avisar('Equipo guardado', plan ? 'Tu plan se recalculó con tu equipo desde esta semana.' : 'Cuando hagas la evaluación, tu plan usará este equipo.');
      location.hash = '#/hoy';
    });
  }
  pintar();
}
