# PENDIENTES-EXTERNOS — PELVIA
Lo que **no** puede resolver Claude Code por sí solo. Nada de esto bloquea la implementación completa (la app se construye con
valores por defecto y se ajusta después); sí bloquea la **entrega final a la usuaria**.

| # | Pendiente | Responsable | Qué se necesita | Bloquea |
|---|---|---|---|---|
| 1 | Marca y modelo del electroestimulador con biofeedback de la amiga, y foto/lista de sus programas (nombres, Hz, µs si el manual los indica) | Kilder → amiga | Verificar el mapeo `equiposConocidos` en `content/protocolos.json` y, si hace falta, agregar el modelo | Entrega final (no la implementación) |
| 2 | Revisión del catálogo clínico (`content/protocolos.json` y la Biblioteca de la app) por un fisioterapeuta de suelo pélvico o el médico tratante | Kilder → profesional de la amiga | Confirmar parámetros, frecuencias y textos; marcar `meta.revisionProfesionalPendiente = false` | Entrega final |
| 3 | Logo KOLH en PNG con fondo transparente para `assets/icons/logo-kolh.png` (pantalla "Acerca de") | Kilder — está en **LAPTOP EMPRESA**: `D:\LOGO KOLH.png` (versión recortada/transparente en SIGDA `src/main/resources/membrete/`) | Copiar el archivo al repo | Solo la pantalla Acerca de (se usa placeholder mientras tanto) |
| 4 | Crear el repositorio público `kilder16/pelvia-app` en GitHub y activar GitHub Pages (rama `main`, carpeta `/ (root)`) | Kilder | Ver `INICIO-RAPIDO.md` pasos 6–9 | Despliegue (fase 6) |
| 5 | Prueba real en el celular de la amiga (Android o iPhone): instalar desde el enlace, correr una sesión completa de 20 min, verificar vibración/sonido/pantalla encendida | Kilder + amiga | Reportar modelo de celular, navegador y cualquier falla | Cierre del proyecto |
| 6 | Nombre definitivo de la app (nombre de trabajo: **PELVIA**) e ícono | Kilder | Decidir antes de publicar; cambiar `manifest.webmanifest`, `<title>` y `meta.nombre` | Publicación |
| 7 | Licencia del ICIQ-UI SF si la app se difundiera más allá del uso personal (la versión incluida es una adaptación libre) | Kilder | Solicitar en iciq.net solo si aplica | No bloquea el uso personal |
| 8 | Decidir si se quiere empaquetar para Google Play más adelante (TWA/Capacitor) | Kilder | Nuevo ADR cuando se decida | No bloquea |
