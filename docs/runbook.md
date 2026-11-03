# Runbook de despliegue — PELVIA (GitHub Pages)
Destino: repositorio público `kilder16/pelvia-app`, rama `main`, carpeta raíz → `https://kilder16.github.io/pelvia-app/`.
No hay build: lo que está en `main` es lo que se publica (ADR-0001).

> **Máquina:** los pasos están escritos para **LAPTOP PERSONAL** (PowerShell). En **LAPTOP EMPRESA** son idénticos; solo cambia
> la carpeta (`D:\pelvia-app`). El proyecto no usa npm, así que el bloqueo del proxy no afecta. Hoy el repositorio con todos los
> commits y el tag `v0.1.0` está en **`D:\pelvia-app`** (la máquina donde se generó). Si vas a publicar desde LAPTOP PERSONAL,
> copia la carpeta **completa, incluida la carpeta oculta `.git`** (o publica desde LAPTOP EMPRESA si GitHub no está bloqueado ahí).
> Evita PC EMPRESA.

## 1. Checklist previo al despliegue
- [ ] `node --test "tests/*.test.js"` → 0 fallos.
- [ ] `node --test --experimental-test-coverage "tests/*.test.js"` → `js/engine/` ≥ 80 % de líneas.
- [ ] `node tools/generar-precache.mjs --check` → "sw.js al día" y peso < 2 MB.
- [ ] Si cambió cualquier archivo de la app desde la última publicación: subir `CACHE_VERSION` en `sw.js` (y `APP_VERSION` en
      `js/store/repo.js` si es una versión nueva), ejecutar `node tools/generar-precache.mjs` y anotar el cambio en `CHANGELOG.md`.
- [ ] Prueba local: `python -m http.server 8080` → `http://localhost:8080` → "Ver ejemplo" → correr una sesión de 2 min → Informe.
- [ ] `git status` limpio; ningún respaldo con datos reales (`pelvia-respaldo-*.json`) dentro del repo.
- [ ] `content/protocolos.json → meta.revisionProfesionalPendiente`: si sigue en `true`, la app lo muestra; para la entrega final
      debe estar revisado (PENDIENTES-EXTERNOS #2).

## 2. Primera publicación (v0.1.0) — LAPTOP PERSONAL
### 2.1 Crear el repositorio (navegador, cuenta `kilder16`)
GitHub → **New repository** → nombre `pelvia-app` → **Public** → **sin** README, .gitignore ni licencia → **Create repository**.

### 2.2 Subir el código (PowerShell)
```powershell
cd "$env:USERPROFILE\Documents\pelvia-app"      # en LAPTOP EMPRESA: cd D:\pelvia-app
git status                                      # debe decir "nothing to commit, working tree clean"
git log --oneline -1                            # último commit
git tag                                         # debe listar v0.1.0
git remote add origin https://github.com/kilder16/pelvia-app.git
git push -u origin main --tags
```
Si hubiera cambios sin commitear (por ejemplo, agregaste `assets/icons/logo-kolh.png`):
```powershell
node tools/generar-precache.mjs
git add -A
git commit -m "feat(ui): logo del autor en Acerca de [RF-01]"
git push origin main
```

### 2.3 Activar GitHub Pages (navegador)
Repo → **Settings** → **Pages** → *Build and deployment* → Source: **Deploy from a branch** → Branch: **main** / **/ (root)** → **Save**.
En 1–2 minutos aparece: `https://kilder16.github.io/pelvia-app/`.

## 3. Publicaciones siguientes — LAPTOP PERSONAL
```powershell
cd "$env:USERPROFILE\Documents\pelvia-app"
node --test "tests/*.test.js"
# editar sw.js: CACHE_VERSION = <n + 1>   y   js/store/repo.js: APP_VERSION = '<x.y.z>'
node tools/generar-precache.mjs
git add -A
git commit -m "chore(release): v0.1.1"
git tag v0.1.1
git push origin main --tags
```
Anota la fila en `docs/despliegues.md` (y commitéala).

## 4. Verificación post-despliegue (celular de la usuaria)
1. Abrir `https://kilder16.github.io/pelvia-app/` en Chrome (Android) o Safari (iPhone). Debe cargar sin errores.
2. **Instalar**: menú ⋮ → *Instalar aplicación* / *Agregar a pantalla de inicio* (iPhone: botón Compartir → *Agregar a inicio*).
3. Abrir desde el ícono; en **Ajustes → Acerca de** comprobar la versión (`0.1.0`).
4. **Modo avión** → cerrar y volver a abrir la app → debe funcionar igual (offline).
5. **Ver ejemplo** → abrir una sesión → correr **2 minutos** del temporizador: alterna CONTRAE/RELAJA, vibra (Android) y suena,
   la pantalla no se apaga. Terminar y guardar. Luego **Ajustes → Restablecer** para borrar el ejemplo.
6. Registrar el resultado en `docs/despliegues.md`.

## 5. Rollback
El service worker sirve la versión en caché: después de cualquier rollback hay que **subir `CACHE_VERSION`** para que los celulares
descarguen la versión restaurada (la app mostrará "Nueva versión disponible — recargar").

**Opción A — revertir el commit problemático (recomendada, no reescribe historia):**
```powershell
git log --oneline -5
git revert <commit-malo>
# editar sw.js: CACHE_VERSION = <n + 1>
node tools/generar-precache.mjs
git commit -am "revert: vuelve al comportamiento de v0.1.0"
git push origin main
```

**Opción B — volver exactamente al tag anterior (reescribe `main`; usar solo si A no basta):**
```powershell
git checkout -b rescate-antes-del-rollback          # guarda el estado actual por si acaso
git checkout main
git reset --hard v0.1.0
# editar sw.js: CACHE_VERSION = <mayor que la publicada>  (si no, los celulares no se enteran)
node tools/generar-precache.mjs
git commit -am "chore(release): rollback a v0.1.0"
git push --force origin main
```
Verificar con la sección 4. Los datos de la usuaria no se pierden en un rollback (viven en su celular), pero recomiéndale
**exportar un respaldo** antes de actualizar si hubo cambios de esquema.

## 6. Problemas frecuentes al publicar
| Síntoma | Causa | Solución |
|---|---|---|
| 404 en `https://kilder16.github.io/pelvia-app/` | Pages no activado o aún desplegando | Revisar Settings → Pages; esperar 2 min; pestaña *Actions* |
| El celular sigue mostrando la versión vieja | `CACHE_VERSION` no subió | Subir `CACHE_VERSION`, regenerar precache, publicar; en el celular pulsar "recargar" |
| La instalación del SW falla (consola: `addAll` rechazado) | Un archivo de `PRECACHE` no existe | `node tools/generar-precache.mjs` y volver a publicar |
| `git push` pide credenciales | Primera vez en esa máquina | Iniciar sesión con el navegador (Git Credential Manager) o un token personal |
| `git push` rechazado en LAPTOP EMPRESA | Proxy corporativo | Publicar desde LAPTOP PERSONAL |
