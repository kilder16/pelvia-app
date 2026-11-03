import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accesoPermitido, estadoBotones, tieneConsentimiento } from '../js/ui/vistas/onboarding.js';

test('rf01_sinConsentimientoBloquea', () => {
  for (const perfil of [null, undefined, {}, { consentimiento: false }, { consentimiento: 'si' }]) {
    assert.deepEqual(estadoBotones(perfil), { evaluacion: false, hoy: false, biblioteca: false });
    for (const r of ['evaluacion', '#/hoy', '/biblioteca', 'sesion/EST-IUE', 'progreso', 'ajustes']) {
      assert.equal(accesoPermitido(perfil, r), false, `${r} bloqueada`);
    }
    assert.equal(accesoPermitido(perfil, '#/onboarding'), true);
    assert.equal(accesoPermitido(perfil, 'acerca'), true);
  }
  const ok = { consentimiento: true };
  assert.equal(tieneConsentimiento(ok), true);
  assert.deepEqual(estadoBotones(ok), { evaluacion: true, hoy: true, biblioteca: true });
  assert.equal(accesoPermitido(ok, '#/sesion/EST-IUE'), true);
});
