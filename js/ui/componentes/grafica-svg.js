// Gráficas en SVG propio, sin librerías (RF-13, RNF-02). Funciones puras que devuelven marcado seguro:
// un <svg role="img" aria-label="…"> con ejes y etiquetas, más una tabla accesible oculta visualmente.

import { esc, crudo } from '../../util/dom.js';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 'AAAA-MM-DD…' → '3 nov' */
export function fechaEje(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return String(iso ?? '');
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1]}`;
}

/** Días desde época para una fecha ISO (solo la parte de calendario). */
export function diaNumero(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return 0;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000);
}

/** Escala lineal: dominio [d0, d1] → rango [r0, r1]. Dominio degenerado → centro del rango. */
export function escalaLineal(d0, d1, r0, r1) {
  if (d1 === d0) return () => (r0 + r1) / 2;
  return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

/** Rango "redondo" que contiene [min, max] con ~4 divisiones. */
export function rangoRedondo(min, max, divisiones = 4) {
  let a = Number.isFinite(min) ? min : 0;
  let b = Number.isFinite(max) ? max : 1;
  if (a === b) { a = Math.max(0, a - 1); b += 1; }
  const crudoPaso = (b - a) / divisiones;
  const mag = 10 ** Math.floor(Math.log10(crudoPaso));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((p) => p >= crudoPaso) ?? 10 * mag;
  const lo = Math.floor(a / paso) * paso;
  const hi = Math.ceil(b / paso) * paso;
  const marcas = [];
  for (let v = lo; v <= hi + paso / 1000; v += paso) marcas.push(Math.round(v * 1000) / 1000);
  return { min: lo, max: hi, paso, marcas };
}

const fmt = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

function tablaOculta(titulo, cabeceras, filas) {
  return `<table class="solo-lectores"><caption>${esc(titulo)}</caption><thead><tr>${cabeceras.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${filas.map((f) => `<tr>${f.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

/**
 * Curva de una serie [{fecha, valor}] ordenada por fecha.
 * @param {{titulo?:string, unidad?:string, color?:string, yMin?:number, yMax?:number, ancho?:number, alto?:number}} op
 */
export function graficaLinea(serie, op = {}) {
  const { titulo = 'Evolución', unidad = '', color = 'var(--primario)', ancho = 340, alto = 190 } = op;
  const datos = [...(serie ?? [])].filter((p) => Number.isFinite(p.valor))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const etiquetaValor = (v) => `${fmt(v)}${unidad ? ` ${unidad}` : ''}`;
  const aria = datos.length
    ? `${titulo}: ${datos.map((p) => `${fechaEje(p.fecha)} ${etiquetaValor(p.valor)}`).join('; ')}`
    : `${titulo}: sin datos todavía`;
  if (!datos.length) {
    return crudo(`<figure class="grafica"><svg viewBox="0 0 ${ancho} 60" role="img" aria-label="${esc(aria)}"><text x="${ancho / 2}" y="34" text-anchor="middle" class="g-vacio">Sin datos todavía</text></svg></figure>`);
  }
  const m = { izq: 40, der: 14, arr: 14, aba: 30 };
  const vals = datos.map((p) => p.valor);
  const r = rangoRedondo(op.yMin ?? Math.min(0, ...vals), op.yMax ?? Math.max(...vals));
  const xs = datos.map((p) => diaNumero(p.fecha));
  const x = escalaLineal(Math.min(...xs), Math.max(...xs), m.izq + 8, ancho - m.der - 8);
  const y = escalaLineal(r.min, r.max, alto - m.aba, m.arr);
  const pts = datos.map((p, i) => [x(xs[i]), y(p.valor)]);

  const rejilla = r.marcas.map((v) => `<line class="g-rejilla" x1="${m.izq}" x2="${ancho - m.der}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="g-eje" x="${m.izq - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${esc(fmt(v))}</text>`).join('');
  // Etiquetas de fecha: primera, última y (si caben) intermedias sin solaparse.
  const etiquetas = [];
  let ultimaX = -Infinity;
  pts.forEach(([px], i) => {
    const esExtremo = i === 0 || i === pts.length - 1;
    if (px - ultimaX >= 52 || (esExtremo && i === pts.length - 1 && px - ultimaX >= 40)) {
      etiquetas.push(`<text class="g-eje" x="${px.toFixed(1)}" y="${alto - 10}" text-anchor="middle">${esc(fechaEje(datos[i].fecha))}</text>`);
      ultimaX = px;
    }
  });
  const linea = pts.length > 1
    ? `<polyline fill="none" style="stroke:${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}"/>`
    : '';
  const puntos = pts.map(([a, b]) => `<circle cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="4.5" style="fill:${color}" class="g-punto"/>`).join('');
  const ultimo = pts[pts.length - 1];
  const ultimoTxt = `<text class="g-valor" x="${Math.min(ultimo[0], ancho - m.der - 4).toFixed(1)}" y="${Math.max(ultimo[1] - 9, 12).toFixed(1)}" text-anchor="end">${esc(etiquetaValor(datos[datos.length - 1].valor))}</text>`;
  const svg = `<svg viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${esc(aria)}" preserveAspectRatio="xMidYMid meet">
<line class="g-ejeLinea" x1="${m.izq}" x2="${m.izq}" y1="${m.arr}" y2="${alto - m.aba}"/>
<line class="g-ejeLinea" x1="${m.izq}" x2="${ancho - m.der}" y1="${alto - m.aba}" y2="${alto - m.aba}"/>
${rejilla}${etiquetas.join('')}${linea}${puntos}${ultimoTxt}</svg>`;
  const tabla = tablaOculta(titulo, ['Fecha', `Valor${unidad ? ` (${unidad})` : ''}`], datos.map((p) => [fechaEje(p.fecha), fmt(p.valor)]));
  return crudo(`<figure class="grafica">${svg}${tabla}</figure>`);
}

/**
 * Barras verticales [{etiqueta, valor, texto?}] con valor entre 0 y `max` (por defecto 1 = 100 %).
 * @param {{titulo?:string, max?:number, formato?:(v:number)=>string, linea?:number, etiquetaLinea?:string,
 *          ancho?:number, alto?:number}} op
 */
export function graficaBarras(datos, op = {}) {
  const { titulo = 'Barras', max = 1, ancho = 340, alto = 190,
    formato = (v) => `${Math.round(v * 100)} %`, linea = null, etiquetaLinea = '' } = op;
  const lista = datos ?? [];
  const aria = lista.length
    ? `${titulo}: ${lista.map((d) => `${d.etiqueta} ${d.texto ?? formato(d.valor)}`).join('; ')}`
    : `${titulo}: sin datos todavía`;
  if (!lista.length) {
    return crudo(`<figure class="grafica"><svg viewBox="0 0 ${ancho} 60" role="img" aria-label="${esc(aria)}"><text x="${ancho / 2}" y="34" text-anchor="middle" class="g-vacio">Sin datos todavía</text></svg></figure>`);
  }
  const m = { izq: 40, der: 8, arr: 20, aba: 28 };
  const y = escalaLineal(0, max, alto - m.aba, m.arr);
  const anchoUtil = ancho - m.izq - m.der;
  const paso = anchoUtil / lista.length;
  const anchoBarra = Math.min(36, paso * 0.66);
  const marcas = [0, 0.5, 1].map((k) => k * max);
  const rejilla = marcas.map((v) => `<line class="g-rejilla" x1="${m.izq}" x2="${ancho - m.der}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="g-eje" x="${m.izq - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${esc(formato(v))}</text>`).join('');
  const mostrarValor = paso >= 26;
  const barras = lista.map((d, i) => {
    const cx = m.izq + paso * i + paso / 2;
    const v = Math.max(0, Math.min(max, d.valor));
    const yy = y(v);
    const alto0 = alto - m.aba - yy;
    const clase = linea != null && v < linea ? 'g-barra g-barra--baja' : 'g-barra';
    return `<rect class="${clase}" x="${(cx - anchoBarra / 2).toFixed(1)}" y="${yy.toFixed(1)}" width="${anchoBarra.toFixed(1)}" height="${Math.max(alto0, 0).toFixed(1)}" rx="4"/>`
      + (mostrarValor ? `<text class="g-valor g-valor--chico" x="${cx.toFixed(1)}" y="${(yy - 5).toFixed(1)}" text-anchor="middle">${esc(formato(v))}</text>` : '')
      + `<text class="g-eje" x="${cx.toFixed(1)}" y="${alto - 9}" text-anchor="middle">${esc(d.etiqueta)}</text>`;
  }).join('');
  const lin = linea != null
    ? `<line class="g-meta" x1="${m.izq}" x2="${ancho - m.der}" y1="${y(linea).toFixed(1)}" y2="${y(linea).toFixed(1)}"/><text class="g-eje g-meta-txt" x="${ancho - m.der}" y="${(y(linea) - 4).toFixed(1)}" text-anchor="end">${esc(etiquetaLinea)}</text>`
    : '';
  const svg = `<svg viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${esc(aria)}" preserveAspectRatio="xMidYMid meet">
<line class="g-ejeLinea" x1="${m.izq}" x2="${ancho - m.der}" y1="${alto - m.aba}" y2="${alto - m.aba}"/>${rejilla}${barras}${lin}</svg>`;
  const tabla = tablaOculta(titulo, ['Semana', 'Valor'], lista.map((d) => [d.etiqueta, d.texto ?? formato(d.valor)]));
  return crudo(`<figure class="grafica">${svg}${tabla}</figure>`);
}
