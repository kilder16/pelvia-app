// Regenera la lista PRECACHE de sw.js con todos los archivos que la app necesita offline.
// Uso (desde la raíz del repo):  node tools/generar-precache.mjs        → reescribe sw.js
//                                node tools/generar-precache.mjs --check → falla si sw.js está desactualizado
// Incluye: index.html, manifest, css/, js/, content/, assets/il/, assets/icons/.
// Excluye: assets/capturas/ (solo documentación), tests/, docs/, tools/.

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const carpetas = ['css', 'js', 'content', 'assets/il', 'assets/icons'];
const extensiones = /\.(html|css|js|json|svg|png|webmanifest)$/i;

function recorrer(dir) {
  const abs = join(raiz, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((n) => {
    const p = join(abs, n);
    return statSync(p).isDirectory() ? recorrer(relative(raiz, p)) : [relative(raiz, p).split(sep).join('/')];
  });
}

const archivos = ['./', 'index.html', 'manifest.webmanifest',
  ...carpetas.flatMap(recorrer).filter((f) => extensiones.test(f))].filter((f, i, a) => a.indexOf(f) === i);
for (const f of archivos) if (f !== './' && !existsSync(join(raiz, f))) throw new Error(`No existe ${f}`);

const swRuta = join(raiz, 'sw.js');
const sw = readFileSync(swRuta, 'utf8');
const bloque = `// <precache> (generado por tools/generar-precache.mjs; no editar a mano)\nconst PRECACHE = [\n${archivos.map((f) => `  '${f}',`).join('\n')}\n];\n// </precache>`;
const nuevo = sw.replace(/\/\/ <precache>[\s\S]*?\/\/ <\/precache>/, bloque);

const pesoTotal = archivos.filter((f) => f !== './').reduce((s, f) => s + statSync(join(raiz, f)).size, 0);
if (process.argv.includes('--check')) {
  if (nuevo !== sw) {
    console.error('sw.js: la lista PRECACHE está desactualizada. Ejecuta node tools/generar-precache.mjs');
    process.exit(1);
  }
  console.log(`sw.js al día: ${archivos.length} entradas, ${(pesoTotal / 1024).toFixed(0)} KB.`);
} else {
  writeFileSync(swRuta, nuevo);
  console.log(`sw.js actualizado: ${archivos.length} entradas, ${(pesoTotal / 1024).toFixed(0)} KB precacheados.`);
}
if (pesoTotal > 2 * 1024 * 1024) {
  console.error('ATENCIÓN: el peso total supera 2 MB (RNF-06).');
  process.exit(2);
}
