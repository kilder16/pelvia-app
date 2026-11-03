import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recomendacionPara, itemsBiblioteca } from '../js/ui/vistas/biblioteca.js';
import { catalogo } from './ayuda.js';

test('rf10_marcaNoRecomendadaDolor', () => {
  const items = itemsBiblioteca(catalogo, 'DOLOR_HIPERTONIA');
  assert.equal(items.length, catalogo.tiposSesion().length, 've todos los tipos de sesión');
  const iue = items.find((i) => i.tipo.id === 'EST-IUE');
  assert.equal(iue.estado, 'no-recomendada');
  assert.equal(iue.etiqueta, 'No recomendada para tu perfil');
  assert.equal(iue.motivo, 'No fortalecer un suelo pélvico tenso o doloroso.');
  assert.equal(items.find((i) => i.tipo.id === 'TENS-ALTA').estado, 'recomendada');
  assert.equal(recomendacionPara(catalogo.tipoSesion('EST-IUE'), null).estado, 'neutral');
  assert.equal(recomendacionPara(catalogo.tipoSesion('VES-DIARIO'), 'IUE').estado, 'neutral');
  // Todos los niveles se muestran en la biblioteca.
  assert.equal(catalogo.niveles().length, 7);
});
