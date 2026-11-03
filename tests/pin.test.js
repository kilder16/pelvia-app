import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, verificarPin, registrarIntento, formatoPinValido, MAX_FALLOS } from '../js/ui/componentes/pin.js';

test('rf19_hashYVerifica', async () => {
  const h = await hashPin('1234');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.notEqual(h, '1234');
  assert.equal(await hashPin('1234'), h, 'determinista');
  assert.equal(await verificarPin('1234', h), true);
  assert.equal(await verificarPin('4321', h), false);
  assert.equal(await verificarPin('12a4', h), false);
  assert.equal(await verificarPin('1234', null), false);
  await assert.rejects(hashPin('123'), RangeError);
  assert.equal(formatoPinValido('0000'), true);
  assert.equal(formatoPinValido(1234), false);
});

test('rf19_5fallosOfreceRestablecer', () => {
  let e = { fallos: 0 };
  for (let i = 1; i < MAX_FALLOS; i++) {
    e = registrarIntento(e, false);
    assert.equal(e.ofrecerRestablecer, false);
    assert.equal(e.restantes, MAX_FALLOS - i);
  }
  e = registrarIntento(e, false);
  assert.equal(MAX_FALLOS, 5);
  assert.equal(e.fallos, 5);
  assert.equal(e.ofrecerRestablecer, true);
  assert.equal(e.restantes, 0);
  const ok = registrarIntento({ fallos: 3 }, true);
  assert.deepEqual(ok, { fallos: 0, desbloqueado: true, ofrecerRestablecer: false, restantes: 5 });
  assert.equal(registrarIntento(undefined, false).fallos, 1);
});
