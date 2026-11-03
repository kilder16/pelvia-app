"""Genera los iconos PWA de PELVIA (assets/icons/*.png) con Pillow, replicando assets/icons/icon.svg.

Motivo: círculo coral sobre una "hamaca" (arco) blanca, fondo primario #2A7F7A.
- icon-192.png / icon-512.png: propósito "any", esquinas redondeadas (fuera transparente).
- icon-maskable-512.png: fondo completo, motivo reducido dentro del 80 % central (zona segura).
Uso: python tools/generar_iconos.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

PRIMARIO, ACENTO, BLANCO = (42, 127, 122, 255), (226, 109, 90, 255), (255, 255, 255, 255)
OUT = Path(__file__).resolve().parent.parent / "assets" / "icons"
SS = 4  # supermuestreo para suavizar bordes

# Geometría en coordenadas 512 (igual que icon.svg)
CIRCULO = (256, 196, 62)                 # cx, cy, r
HAMACA = ((118, 292), (256, 432), (394, 292))  # bezier cuadrática: inicio, control, fin
ANCHO_HAMACA = 36
RADIO_ESQUINA = 112


def bezier(p0, p1, p2, n=800):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1])
            for t in (i / n for i in range(n + 1))]


def dibujar(size, maskable):
    S = size * SS
    k = S / 512
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle((0, 0, S, S), fill=PRIMARIO)
        esc, off = 0.8, 256 * (1 - 0.8)  # motivo escalado al 80 % alrededor del centro
    else:
        d.rounded_rectangle((0, 0, S - 1, S - 1), radius=RADIO_ESQUINA * k, fill=PRIMARIO)
        esc, off = 1.0, 0.0
    tr = lambda x, y: ((x * esc + off) * k, (y * esc + off) * k)

    pts = [tr(x, y) for x, y in bezier(*HAMACA)]
    w = ANCHO_HAMACA * esc * k
    for x, y in pts:  # trazo grueso con extremos redondeados: discos a lo largo de la curva
        d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=BLANCO)

    cx, cy = tr(CIRCULO[0], CIRCULO[1])
    r = CIRCULO[2] * esc * k
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=ACENTO)
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for nombre, size, mask in (("icon-192.png", 192, False), ("icon-512.png", 512, False),
                               ("icon-maskable-512.png", 512, True)):
        dibujar(size, mask).save(OUT / nombre, optimize=True)
        print(nombre, (OUT / nombre).stat().st_size, "B")


if __name__ == "__main__":
    main()
