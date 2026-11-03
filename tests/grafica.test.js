import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escalaLineal, rangoRedondo, fechaEje, graficaLinea, graficaBarras } from '../js/ui/componentes/grafica-svg.js';

test('rf13_escalasDeLaGrafica', () => {
  const x = escalaLineal(0, 10, 40, 340);
  assert.equal(x(0), 40);
  assert.equal(x(10), 340);
  assert.equal(x(5), 190);
  assert.equal(escalaLineal(3, 3, 0, 100)(3), 50);
  const r = rangoRedondo(0, 21);
  assert.ok(r.min <= 0 && r.max >= 21);
  assert.ok(r.marcas.length >= 3 && r.marcas.length <= 7);
  assert.equal(fechaEje('2026-11-03'), '3 nov');
  assert.equal(fechaEje('2026-01-15T08:00:00'), '15 ene');
});

test('rf13_graficasAccesiblesConValores', () => {
  const svg = String(graficaLinea([{ fecha: '2026-10-05', valor: 11 }, { fecha: '2026-11-02', valor: 8 }], { titulo: 'ICIQ <x>' }));
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label="ICIQ &lt;x&gt;: 5 oct 11; 2 nov 8"/);
  assert.match(svg, /<polyline/);
  assert.match(svg, /<table class="solo-lectores">/);
  const barras = String(graficaBarras([{ etiqueta: 'S1', valor: 0.8 }, { etiqueta: 'S2', valor: 0.5 }], { titulo: 'Adherencia', linea: 0.7 }));
  assert.equal((barras.match(/<rect/g) ?? []).length, 2);
  assert.match(barras, /S1 80 %; S2 50 %/);
  assert.match(String(graficaLinea([], { titulo: 'Vacía' })), /sin datos/);
});
