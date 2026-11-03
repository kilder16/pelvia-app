"""Verifica los SVG de assets/il/ y assets/icons/ (RNF-11, ADR 0006).

Comprueba: XML válido, role="img", aria-label no vacío, <title> como primer hijo, viewBox 0 0 400 300
(solo assets/il/), tamaño < 10 KB y ausencia de degradados, filtros, imágenes embebidas y URLs externas.
Uso: python tools/verificar_svg.py   (código de salida 1 si algo falla)
"""
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent / "assets"
NS = "{http://www.w3.org/2000/svg}"
PROHIBIDO = ("linearGradient", "radialGradient", "<filter", "filter=", "<image", "<script", "@import")


def revisar(p: Path, es_il: bool):
    errores = []
    datos = p.read_bytes()
    texto = datos.decode("utf-8")
    if len(datos) >= 10 * 1024:
        errores.append(f"pesa {len(datos)} B (>= 10 KB)")
    try:
        raiz = ET.fromstring(datos)
    except ET.ParseError as e:
        return [f"XML inválido: {e}"]
    if raiz.tag != NS + "svg":
        errores.append("la raíz no es <svg>")
    if raiz.get("role") != "img":
        errores.append('falta role="img"')
    if not (raiz.get("aria-label") or "").strip():
        errores.append("aria-label vacío")
    if len(raiz) == 0 or raiz[0].tag != NS + "title" or not (raiz[0].text or "").strip():
        errores.append("<title> no es el primer hijo o está vacío")
    if es_il and raiz.get("viewBox") != "0 0 400 300":
        errores.append(f'viewBox = {raiz.get("viewBox")!r}')
    for x in PROHIBIDO:
        if x in texto:
            errores.append(f"contiene {x}")
    if texto.replace('xmlns="http://www.w3.org/2000/svg"', "").count("http") > 0:
        errores.append("contiene una URL externa")
    for el in raiz.iter(NS + "text"):
        tam = float(el.get("font-size", "16"))
        if es_il and tam < 14:
            errores.append(f"texto de {tam}px < 14px")
    return errores


def main():
    archivos = [(p, True) for p in sorted((RAIZ / "il").glob("*.svg"))]
    archivos += [(p, False) for p in sorted((RAIZ / "icons").glob("*.svg"))]
    fallos = 0
    for p, es_il in archivos:
        err = revisar(p, es_il)
        estado = "OK " if not err else "ERR"
        print(f"{estado} {p.relative_to(RAIZ)}  {p.stat().st_size} B" + ("" if not err else "  -> " + "; ".join(err)))
        fallos += bool(err)
    print(f"\n{len(archivos)} archivos, {fallos} con errores")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
