// Pantalla siempre encendida durante la sesión (Screen Wake Lock API). Si no existe, no falla.

let candado = null;
let deseado = false;

export async function pedirWakeLock() {
  deseado = true;
  try {
    const wl = globalThis.navigator?.wakeLock;
    if (!wl || typeof wl.request !== 'function') return false;
    if (globalThis.document?.visibilityState === 'hidden') return false;
    candado = await wl.request('screen');
    candado.addEventListener?.('release', () => { candado = null; });
    return true;
  } catch {
    candado = null;
    return false;
  }
}

/** Reintento al volver de segundo plano (el navegador libera el candado al ocultarse). */
export async function reintentarWakeLock() {
  if (deseado && !candado) return pedirWakeLock();
  return !!candado;
}

export async function soltarWakeLock() {
  deseado = false;
  try {
    await candado?.release();
  } catch { /* ya liberado */ }
  candado = null;
}
