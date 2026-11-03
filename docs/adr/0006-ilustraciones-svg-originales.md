# ADR 0006 — Ilustraciones originales en SVG esquemático (sin imágenes de terceros ni fotografías)
Estado: Aceptada
Fecha: 2026-11-03

## Contexto
Kilder pidió que la app incluya imágenes y un ejemplo. Las ilustraciones médicas de libros, webs de fabricantes o bancos de imágenes
tienen derechos de autor; las fotografías de la zona pélvica serían inapropiadas para una app de uso cotidiano y para un repo público.

## Opciones consideradas
1. **SVG originales dibujados en código, esquemáticos y con etiquetas en español** — pros: sin licencias, livianos (< 10 KB c/u),
   se adaptan a modo oscuro, accesibles con `aria-label`; contras: menos realismo anatómico.
2. **Imágenes con licencia libre (Wikimedia/CC)** — pros: más realismo; contras: atribución obligatoria, estilos inconsistentes,
   dudas de licencia en material clínico.
3. **Imágenes generadas con IA** — contras: errores anatómicos difíciles de detectar, dudas de licencia.

## Decisión
Opción 1. Catálogo IL-01..IL-14 definido en `docs/diseno.md §9`, estilo unificado (viewBox 400×300, 3 colores, trazo 3 px),
un archivo por ilustración en `assets/il/`, referenciadas desde `protocolos.json` por ID. Cualquier esquema de colocación de sonda se
dibuja de forma abstracta (silueta + sonda + cable), nunca explícita.

## Consecuencias
+ Repo público sin riesgo de derechos; ilustraciones coherentes con la paleta.
+ Fáciles de corregir si el profesional pide un cambio.
− Requiere trabajo de dibujo cuidadoso en la implementación (subagente `ilustraciones-svg`) y revisión visual en el celular.
