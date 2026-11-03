# INICIO RÁPIDO — PELVIA
Micropasos para pasar de este paquete (fases 1–2) a la app funcionando en el celular de tu amiga.
Máquina recomendada: **LAPTOP PERSONAL** (proyecto personal). Todo funciona igual en **LAPTOP EMPRESA**
(Claude Code ya instalado; el bloqueo de npm no afecta porque el proyecto no usa npm). Evita PC EMPRESA (poca RAM).

## Paso 1 — Descomprimir (LAPTOP PERSONAL)
Descomprime `pelvia-app-fase1-2.zip` en tu carpeta de proyectos. Debe quedar así:
```
C:\Users\<tu usuario>\Documents\pelvia-app\
├── docs\  (spec.md, diseno.md, adr\, matriz-trazabilidad.md)
├── content\protocolos.json
├── PROMPT-CLAUDE-CODE.md
├── PENDIENTES-EXTERNOS.md
└── INICIO-RAPIDO.md
```
(En LAPTOP EMPRESA usa `D:\pelvia-app\`.)

## Paso 2 — Abrir Claude Code (LAPTOP PERSONAL)
PowerShell:
```powershell
cd "$env:USERPROFILE\Documents\pelvia-app"
claude
```

## Paso 3 — Lanzar la implementación (LAPTOP PERSONAL, dentro de Claude Code)
Pega exactamente:
```
Lee PROMPT-CLAUDE-CODE.md y ejecútalo completo en modo autónomo, sin pedirme confirmación entre fases.
```
Cuando pida permisos para comandos repetidos e inofensivos (`node --test`, `git add`, lecturas), elige la opción 2 ("no volver a preguntar"); nunca para patrones amplios.

## Paso 4 — Revisar el informe final (LAPTOP PERSONAL)
Claude Code termina con la tabla de avance, la matriz de trazabilidad y los 3 pasos siguientes. Verifica que `node --test tests/` salga en verde:
```powershell
node --test tests/
```

## Paso 5 — Probarla en la PC antes de publicar (LAPTOP PERSONAL)
```powershell
python -m http.server 8080
```
Abre `http://localhost:8080` en Chrome, pulsa **Ver ejemplo** y corre una sesión de 2 minutos. (Si no tienes Python en la LAPTOP PERSONAL, usa la extensión Live Server de VS Code.)

## Paso 6 — Crear el repositorio en GitHub (navegador, cuenta `kilder16`)
GitHub → New repository → nombre `pelvia-app` → **Public** → sin README (ya existe) → Create.

## Paso 7 — Subir el código (LAPTOP PERSONAL)
```powershell
cd "$env:USERPROFILE\Documents\pelvia-app"
git remote add origin https://github.com/kilder16/pelvia-app.git
git push -u origin main --tags
```

## Paso 8 — Activar GitHub Pages (navegador)
Repo → Settings → Pages → Source: *Deploy from a branch* → Branch: `main` / `/ (root)` → Save. En 1–2 minutos:
`https://kilder16.github.io/pelvia-app/`

## Paso 9 — Instalar en el celular de tu amiga
Abrir el enlace en Chrome (Android) o Safari (iPhone) → menú → **Agregar a pantalla de inicio**. Luego aceptar el aviso, hacer la evaluación y configurar **Mi equipo** con el modelo real del electroestimulador.

## Paso 10 — Cerrar pendientes externos
Ver `PENDIENTES-EXTERNOS.md`: modelo del equipo (#1), revisión por el profesional (#2), logo KOLH (#3, está en LAPTOP EMPRESA `D:\LOGO KOLH.png`), prueba real en su celular (#5).
