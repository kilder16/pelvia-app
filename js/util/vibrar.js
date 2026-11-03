// Vibración al cambiar de fase (Android). En iPhone `navigator.vibrate` no existe: no falla.

export function vibrar(patron = [200]) {
  try {
    const nav = globalThis.navigator;
    if (nav && typeof nav.vibrate === 'function') return nav.vibrate(patron);
  } catch { /* sin soporte */ }
  return false;
}
