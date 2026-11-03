# ADR 0003 — Todos los datos viven en el celular (localStorage versionado), sin backend ni cuentas
Estado: Aceptada
Fecha: 2026-11-03

## Contexto
La app maneja datos de salud íntimos (síntomas de incontinencia, dolor pélvico, sesiones con sonda). Es de uso individual.
Un backend implicaría cuentas, cifrado en tránsito y en reposo, custodia de datos de salud y mantenimiento permanente, sin
beneficio para una sola usuaria.

## Opciones consideradas
1. **localStorage con esquema versionado + respaldo JSON manual** — pros: cero exposición de datos, cero infraestructura, simple;
   contras: límite ~5 MB (sobra: 12 semanas × 7 sesiones ≈ 100 KB), se pierde si se borra el almacenamiento del navegador.
2. **IndexedDB** — pros: mayor capacidad y transacciones; contras: más código y asincronía para un volumen que no lo necesita.
3. **Backend (Firebase/Supabase)** — pros: sincronización entre dispositivos; contras: custodia de datos de salud, cuentas, costo
   de mantenimiento, riesgo de fuga.

## Decisión
Opción 1. Claves `pelvia.*` + `pelvia.meta {esquema}` con migraciones en `app.js`. Exportar/importar respaldo JSON (RF-18) y
recordatorio mensual de respaldo. PIN opcional de 4 dígitos (hash SHA-256 con `crypto.subtle`) como barrera de privacidad ante
miradas casuales — no es cifrado; se documenta así en "Ajustes". El repo público no contiene datos de ninguna persona; el caso
ejemplo es ficticio.

## Consecuencias
+ Privacidad por diseño; ninguna llamada de red con datos.
+ Sin costos ni servidores que mantener.
− Pérdida de datos si se borra el navegador sin respaldo: mitigado por RF-18 y el recordatorio.
− Un solo dispositivo por vez; mover de celular = exportar/importar.
