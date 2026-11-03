// Beep con WebAudio (oscilador de 150 ms). El AudioContext se crea o reanuda en el primer gesto de la usuaria.

let ctx = null;

/** Crea o reanuda el AudioContext. Llamar desde un gesto (clic/toque). No falla si no hay WebAudio. */
export function prepararAudio() {
  try {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/** Beep corto: 880 Hz al contraer, 440 Hz al relajar. */
export function beep(frecuencia = 880, duracionMs = 150) {
  try {
    const c = ctx ?? prepararAudio();
    if (!c) return false;
    const osc = c.createOscillator();
    const gan = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = frecuencia;
    const t0 = c.currentTime;
    const fin = t0 + duracionMs / 1000;
    gan.gain.setValueAtTime(0.0001, t0);
    gan.gain.exponentialRampToValueAtTime(0.3, t0 + 0.01);
    gan.gain.exponentialRampToValueAtTime(0.0001, fin);
    osc.connect(gan).connect(c.destination);
    osc.start(t0);
    osc.stop(fin + 0.02);
    return true;
  } catch {
    return false;
  }
}
