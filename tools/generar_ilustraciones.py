"""Genera las ilustraciones originales IL-01..IL-14 de PELVIA (assets/il/*.svg).

Estilo común (docs/diseno.md §9, ADR 0006): viewBox 400x300, trazo 3 px, colores
primario #2A7F7A, acento #E26D5A, neutro #C9D3D0, texto #1F2A2E. Sin degradados ni filtros.
Uso: python tools/generar_ilustraciones.py
"""
import math
from pathlib import Path

P, A, N, T, W = "#2A7F7A", "#E26D5A", "#C9D3D0", "#1F2A2E", "#FFFFFF"
OUT = Path(__file__).resolve().parent.parent / "assets" / "il"
FONT = 'font-family="system-ui, sans-serif"'


def f(v):
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def svg(title, label, body, sw=3):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" aria-label="{label}">\n'
        f"<title>{title}</title>\n"
        f'<rect width="400" height="300" rx="16" fill="{W}"/>\n'
        f'<g stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">\n{body}\n</g>\n</svg>\n'
    )


def txt(x, y, s, size=16, bold=False, anchor="middle", color=T):
    b = ' font-weight="bold"' if bold else ""
    return f'<text x="{f(x)}" y="{f(y)}" font-size="{size}"{b} text-anchor="{anchor}" fill="{color}" {FONT}>{s}</text>'


def path(d, stroke=P, fill="none", extra=""):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}"{extra}/>'


def circ(x, y, r, fill=W, stroke=P, extra=""):
    s = f' stroke="{stroke}"' if stroke else ""
    return f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{fill}"{s}{extra}/>'


def rect(x, y, w, h, rx=0, fill=W, stroke=P, extra=""):
    s = f' stroke="{stroke}"' if stroke else ""
    return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx="{f(rx)}" fill="{fill}"{s}{extra}/>'


def line(x1, y1, x2, y2, stroke=P, extra=""):
    return path(f"M{f(x1)} {f(y1)} L{f(x2)} {f(y2)}", stroke, extra=extra)


def flecha(x1, y1, x2, y2, c=P, h=10, extra=""):
    a = math.atan2(y2 - y1, x2 - x1)
    p1 = (x2 - h * math.cos(a - 0.55), y2 - h * math.sin(a - 0.55))
    p2 = (x2 - h * math.cos(a + 0.55), y2 - h * math.sin(a + 0.55))
    d = (f"M{f(x1)} {f(y1)} L{f(x2)} {f(y2)} M{f(p1[0])} {f(p1[1])} "
         f"L{f(x2)} {f(y2)} L{f(p2[0])} {f(p2[1])}")
    return path(d, c, extra=extra)


def gota_d(x, y, s=1.0):
    k = lambda v: f(v * s)
    return (f"M{f(x)} {f(y - 24 * s)} C{f(x + 8 * s)} {f(y - 12 * s)} {f(x + 16 * s)} {f(y - 4 * s)} "
            f"{f(x + 16 * s)} {f(y + 6 * s)} A{k(16)} {k(16)} 0 0 1 {f(x - 16 * s)} {f(y + 6 * s)} "
            f"C{f(x - 16 * s)} {f(y - 4 * s)} {f(x - 8 * s)} {f(y - 12 * s)} {f(x)} {f(y - 24 * s)} Z")


def gota(x, y, s=1.0, c=A):
    return path(gota_d(x, y, s), c, c)


def check(x, y, s=1.0, c=P, extra=""):
    return path(f"M{f(x - 10 * s)} {f(y)} L{f(x - 3 * s)} {f(y + 8 * s)} L{f(x + 12 * s)} {f(y - 9 * s)}", c, extra=extra)


def cuerpo(parts):
    """Partes del cuerpo como formas redondeadas: contorno primario de 3 px + relleno neutro."""
    o = "".join(f'<path d="{d}" stroke-width="{w + 6}"/>' for d, w in parts)
    i = "".join(f'<path d="{d}" stroke-width="{w}"/>' for d, w in parts)
    return f'<g fill="none" stroke="{P}">{o}</g><g fill="none" stroke="{N}">{i}</g>'


def cabeza(x, y, r=13, moño=None):
    s = ""
    if moño:
        s += circ(moño[0], moño[1], r * 0.45, P, P)
    return s + circ(x, y, r)


# ---------------------------------------------------------------- IL-01
def il01():
    b = [
        path("M305 55 Q350 130 300 215 L286 206 Q326 130 289 62 Z", P, N),
        f'<ellipse cx="112" cy="195" rx="13" ry="22" fill="{N}" stroke="{P}"/>',
        f'<ellipse cx="150" cy="163" rx="34" ry="27" fill="{N}" stroke="{P}"/>',
        line(140, 190, 132, 226),
        f'<ellipse cx="205" cy="128" rx="24" ry="42" transform="rotate(-35 205 128)" fill="{A}" fill-opacity="0.3" stroke="{P}"/>',
        path("M228 160 Q222 195 212 226"),
        path("M250 85 C265 130 255 175 248 226 L272 226 C280 175 290 130 274 85 Z", P, N),
        path("M112 205 Q205 268 298 205 L296 218 Q205 282 114 218 Z", A, A),
        line(80, 127, 122, 150, T), line(162, 70, 182, 94, T),
        txt(55, 124, "Vejiga", 16, True), txt(150, 64, "Útero", 16, True),
        txt(262, 72, "Recto", 16, True), txt(205, 287, "Suelo pélvico", 17, True, color=A),
        txt(92, 200, "Pubis", 14, anchor="end"), txt(368, 140, "Sacro", 14),
        txt(36, 30, "Delante", 14, anchor="start"), txt(364, 30, "Detrás", 14, anchor="end"),
    ]
    return svg("Pelvis femenina: corte lateral esquemático",
               "Corte lateral esquemático de la pelvis femenina con vejiga, útero y recto apoyados sobre el suelo pélvico, que funciona como una hamaca de soporte",
               "\n".join(b))


# ---------------------------------------------------------------- IL-02
def il02():
    b = []
    for ox, ok in ((10, True), (205, False)):
        cx = ox + 92
        b.append(rect(ox, 10, 185, 280, 14, W, N))
        b.append(circ(ox + 30, 38, 15, P if ok else A, P if ok else A))
        if ok:
            b.append(check(ox + 30, 38, 0.9, W))
        else:
            b.append(path(f"M{ox+24} 32 L{ox+36} 44 M{ox+36} 32 L{ox+24} 44", W))
        b.append(txt(ox + 54, 44, "Correcto" if ok else "Incorrecto", 18, True, "start"))
        b.append(path(f"M{ox+30} 72 C{ox+30} 150 {ox+60} 176 {cx} 176 C{ox+124} 176 {ox+154} 150 {ox+154} 72", N, extra=' stroke-width="8"'))
        if ok:
            b.append(path(f"M{ox+38} 140 Q{cx} 116 {ox+146} 140", A, extra=' stroke-width="8"'))
            for x, y0 in ((cx, 166), (ox + 62, 160), (ox + 122, 160)):
                b.append(flecha(x, y0, x, 140 if x != cx else 134, P))
        else:
            b.append(path(f"M{ox+38} 140 Q{cx} 186 {ox+146} 140", A, extra=' stroke-width="8"'))
            b.append(flecha(cx, 88, cx, 150, A))
        lines = (["Eleva y aprieta", "hacia adentro", "Abdomen y glúteos", "relajados", "Respira normal"] if ok
                 else ["Empuja hacia abajo", "Aguanta la", "respiración", "Aprieta los", "glúteos"])
        for i, s in enumerate(lines):
            b.append(txt(cx, 204 + 19 * i, s, 15))
    return svg("Contracción correcta e incorrecta",
               "Dos paneles. Correcto: el suelo pélvico se eleva y aprieta hacia adentro, con abdomen y glúteos relajados y respiración normal. Incorrecto: empujar hacia abajo, aguantar la respiración y apretar los glúteos",
               "\n".join(b))


# ---------------------------------------------------------------- IL-03
def il03():
    b = [
        rect(30, 226, 340, 10, 5, N, None),
        f'<ellipse cx="66" cy="222" rx="24" ry="6" fill="{N}" stroke="{P}"/>',
        cuerpo([("M96 211 L205 211", 20), ("M205 211 L262 158", 14), ("M262 158 L292 212 L318 214", 12)]),
        cabeza(70, 202, 14, (55, 196)),
        line(286, 228, 324, 228, A, ' stroke-width="4"'),
        txt(200, 60, "Acostada boca arriba", 18, True),
        txt(200, 84, "rodillas flexionadas, pies apoyados", 15),
    ]
    return svg("Posición acostada boca arriba",
               "Mujer acostada boca arriba sobre una colchoneta, con las rodillas flexionadas y los pies apoyados",
               "\n".join(b))


# ---------------------------------------------------------------- IL-04
def il04():
    b = [
        line(110, 254, 320, 254, N),
        path("M150 100 L150 192 M146 192 L232 192 M154 192 L154 250 M226 192 L226 250"),
        cuerpo([("M176 178 L176 118", 20), ("M176 180 L246 180", 14), ("M246 180 L248 244 L270 245", 12)]),
        cuerpo([("M180 128 L196 164 L228 172", 10)]),
        cabeza(178, 95, 14, (164, 88)),
        line(236, 254, 278, 254, A, ' stroke-width="4"'),
        txt(200, 34, "Sentada, espalda recta", 18, True),
        txt(200, 58, "pies apoyados en el suelo", 15),
    ]
    return svg("Posición sentada en silla",
               "Mujer sentada en una silla con la espalda recta y los pies apoyados en el suelo",
               "\n".join(b))


# ---------------------------------------------------------------- IL-05
def il05():
    b = [
        line(120, 254, 280, 254, N),
        cuerpo([("M188 98 L172 160", 10), ("M212 98 L228 160", 10), ("M200 90 L200 160", 24),
                ("M192 160 L187 244 L175 246", 13), ("M208 160 L213 244 L225 246", 13)]),
        circ(200, 46, 7, P, P), cabeza(200, 64, 14),
        line(187, 262, 187, 272, A), line(213, 262, 213, 272, A),
        flecha(200, 267, 189, 267, A, 6), flecha(200, 267, 211, 267, A, 6),
        txt(90, 130, "De pie,", 18, True), txt(90, 154, "erguida", 16),
        txt(315, 130, "Pies al ancho", 16, True), txt(315, 154, "de caderas", 16),
    ]
    return svg("Posición de pie",
               "Mujer de pie, erguida, con los pies separados al ancho de las caderas",
               "\n".join(b))


# ---------------------------------------------------------------- IL-06
def il06():
    b = [line(200, 20, 200, 280, N, ' stroke-dasharray="6 8"')]
    for ox, inh in ((0, True), (200, False)):
        cx = ox + 100
        b.append(txt(cx, 38, "INHALA" if inh else "EXHALA", 20, True, color=P if inh else A))
        b.append(rect(cx - 45, 55, 90, 140, 36))
        if inh:
            b.append(path(f"M{cx-43} 102 Q{cx} 92 {cx+43} 102"))
            b.append(flecha(cx, 110, cx, 132, P))
            b.append(path(f"M{cx-45} 118 Q{cx-72} 150 {cx-45} 182", A, extra=' stroke-dasharray="5 7"'))
            b.append(flecha(cx - 28, 150, cx - 52, 150, A, 8))
            b.append(path(f"M{cx-40} 182 Q{cx} 206 {cx+40} 182", A))
            b.append(flecha(cx, 200, cx, 218, A, 8))
            lines = ["Abdomen se expande", "Suelo pélvico baja", "y se relaja"]
        else:
            b.append(path(f"M{cx-43} 104 Q{cx} 62 {cx+43} 104"))
            b.append(flecha(cx, 118, cx, 92, P))
            b.append(path(f"M{cx-40} 188 Q{cx} 168 {cx+40} 188", A))
            b.append(flecha(cx, 214, cx, 186, A, 8))
            lines = ["Abdomen vuelve", "Suelo pélvico sube", "suave"]
        for i, s in enumerate(lines):
            b.append(txt(cx, 242 + 19 * i, s, 15))
    b.append(txt(100, 80, "Diafragma", 14))
    return svg("Respiración diafragmática",
               "Respiración diafragmática. Al inhalar el abdomen se expande y el suelo pélvico baja y se relaja. Al exhalar el suelo pélvico sube suave",
               "\n".join(b))


# ---------------------------------------------------------------- IL-07 / IL-08
def pasos(sonda):
    w, h = sonda
    b = [line(20, 150, 380, 150, N, ' stroke-dasharray="6 8"')]
    for i, cx in enumerate((70, 200, 330)):
        b.append(circ(cx, 26, 13, A, A))
        b.append(txt(cx, 32, str(i + 1), 16, True, color=W))
    # 1 equipo en 0
    b += [rect(40, 52, 60, 40, 8), rect(48, 58, 44, 18, 4, N, None), txt(70, 73, "0", 16, True), circ(70, 84, 4, P, P)]
    # 2 gel en la sonda
    b += [gota(200, 56, 0.55), rect(200 - w / 2, 72, w, h, h / 2, N), path(f"M{f(200 + w / 2)} {f(72 + h / 2)} q14 0 20 12")]
    # 3 introducir con suavidad
    b += [rect(336 - w / 2, 72, w, h, h / 2, N), flecha(372, 62, 298, 66, A, 9, "") ]
    b += [txt(70, 117, "Equipo en 0", 15, True), txt(200, 117, "Gel en la sonda", 15, True),
          txt(330, 117, "Introducir", 15, True), txt(330, 135, "con suavidad", 15, True)]
    return b


def caja(x=318, y=228):
    return [rect(x, y, 56, 40, 8), rect(x + 8, y + 8, 40, 14, 3, N, None), circ(x + 28, y + 30, 3, P, P),
            txt(x + 28, y - 8, "Equipo", 15)]


def il07():
    b = pasos((60, 18))
    b += [
        rect(25, 266, 290, 9, 4, N, None),
        f'<ellipse cx="60" cy="262" rx="20" ry="5" fill="{N}" stroke="{P}"/>',
        path("M178 258 C200 296 282 292 318 255"),
        cuerpo([("M86 250 L172 250", 18), ("M172 250 L212 206", 13), ("M212 206 L240 256 L260 258", 11)]),
        cabeza(62, 244, 12, (48, 239)),
        txt(105, 205, "Acostada boca arriba", 15),
    ] + caja()
    return svg("Colocación de la sonda vaginal",
               "Esquema simple en tres pasos: equipo en cero, gel en la sonda e introducir con suavidad, acostada boca arriba con el cable de la sonda hacia el equipo",
               "\n".join(b))


def il08():
    b = pasos((44, 14))
    b += [
        rect(25, 162, 270, 92, 14, "none", N),
        f'<ellipse cx="52" cy="208" rx="11" ry="24" fill="{N}" stroke="{P}"/>',
        path("M186 220 C200 262 282 272 318 250"),
        cuerpo([("M84 208 L178 208", 18), ("M178 208 L190 172", 13), ("M190 172 L246 176 L256 186", 11)]),
        cuerpo([("M96 202 L126 178", 9)]),
        cabeza(62, 206, 12, (49, 210)),
        txt(150, 288, "De lado, rodillas flexionadas", 15),
    ] + caja()
    return svg("Colocación de la sonda anal",
               "Esquema simple en tres pasos: equipo en cero, gel en la sonda e introducir con suavidad, acostada de lado con las rodillas flexionadas y el cable de la sonda hacia el equipo",
               "\n".join(b))


# ---------------------------------------------------------------- IL-09
def il09():
    b = [
        path("M60 210 L70 110 L100 110 L110 210 Z", "none", A, ' fill-opacity="0.25"'),
        path("M210 210 L220 110 L250 110 L260 210 Z", "none", A, ' fill-opacity="0.25"'),
        path("M60 210 L70 110 L100 110 L110 210 L210 210 L220 110 L250 110 L260 210 L360 210"),
        line(55, 235, 372, 235, T),
    ]
    for t in range(0, 31, 5):
        x = 60 + 10 * t
        b.append(line(x, 235, x, 242, T))
        b.append(txt(x, 258, str(t), 14))
    for cx in (85, 235):
        b += [txt(cx, 80, "CONTRAE", 15, True, color=A), txt(cx, 98, "con el equipo", 14)]
    for cx in (160, 310):
        b.append(txt(cx, 196, "RELAJA", 15, True, color=P))
    b += [txt(210, 284, "segundos", 15), txt(200, 34, "ON 5 s / OFF 10 s · rampa 1 s", 17, True)]
    return svg("Ciclo ON/OFF del equipo",
               "Línea de tiempo del equipo: 5 segundos encendido con rampa de 1 segundo, en los que contraes con el equipo, y 10 segundos apagado, en los que relajas",
               "\n".join(b))


# ---------------------------------------------------------------- IL-10
def figura_pie(cx, brazos=None):
    hy = 72
    partes = [(f"M{cx} {hy+22} L{cx} {hy+78}", 18),
              (f"M{cx-5} {hy+78} L{cx-7} {hy+138}", 11), (f"M{cx+5} {hy+78} L{cx+7} {hy+138}", 11)]
    partes += brazos or [(f"M{cx-6} {hy+28} L{cx-15} {hy+70}", 9), (f"M{cx+6} {hy+28} L{cx+15} {hy+70}", 9)]
    return [cuerpo(partes), circ(cx, hy - 16, 6, P, P), cabeza(cx, hy, 12)]


def il10():
    b = [line(20, 218, 380, 218, N), flecha(112, 140, 150, 140), flecha(250, 140, 288, 140)]
    # 1 contrae
    b += figura_pie(70)
    b += [path("M59 150 Q70 143 81 150", A), flecha(98, 172, 98, 140, A, 8)]
    # 2 tose / levanta
    b += figura_pie(200, [("M194 100 L184 136", 9), ("M206 100 L216 136", 9)])
    b += [rect(182, 128, 36, 26, 4), path("M59 150 Q70 143 81 150".replace("59", "189").replace("70", "200").replace("81", "211"), A),
          path("M216 64 L228 58 M218 72 L232 72 M216 80 L228 86", A)]
    # 3 suelta
    b += figura_pie(330)
    b += [path("M319 148 Q330 158 341 148", A), flecha(358, 140, 358, 168, P, 8)]
    b += [txt(200, 30, "El «Knack»: contrae antes del esfuerzo", 17, True),
          txt(70, 245, "1 Contrae", 17, True), txt(70, 266, "justo antes", 14),
          txt(200, 245, "2 Tose / levanta", 17, True), txt(200, 266, "mantén apretado", 14),
          txt(330, 245, "3 Suelta", 17, True), txt(330, 266, "relaja", 14)]
    return svg("El Knack: contraer antes del esfuerzo",
               "Secuencia en tres pasos: 1 contrae el suelo pélvico, 2 tose o levanta una caja manteniendo la contracción, 3 suelta y relaja",
               "\n".join(b))


# ---------------------------------------------------------------- IL-11
def il11():
    b = [line(200, 20, 200, 280, N, ' stroke-dasharray="6 8"'),
         rect(25, 12, 150, 215, 12, "none", N),
         cuerpo([("M100 58 L100 135", 20), ("M92 68 L62 122", 9), ("M108 68 L138 122", 9),
                 ("M94 135 L56 178 L96 212", 12), ("M106 135 L144 178 L104 212", 12)]),
         circ(100, 22, 6, P, P), cabeza(100, 38, 13),
         flecha(48, 168, 34, 168, A, 7), flecha(152, 168, 166, 168, A, 7),
         rect(215, 217, 170, 8, 4, N, None),
         cuerpo([("M258 205 L325 205", 18), ("M325 205 L298 152", 13), ("M298 152 L304 96 L322 94", 11)]),
         cuerpo([("M266 200 L300 106", 9)]),
         cabeza(238, 203, 12, (226, 199)),
         txt(100, 250, "Mariposa", 17, True), txt(100, 268, "plantas juntas,", 14), txt(100, 286, "rodillas abiertas", 14),
         txt(300, 250, "Bebé feliz", 17, True), txt(300, 268, "rodillas al pecho,", 14), txt(300, 286, "pies al techo", 14)]
    return svg("Posturas de relajación",
               "Dos posturas de relajación del suelo pélvico: mariposa acostada con las plantas juntas y las rodillas abiertas, y bebé feliz con las rodillas al pecho y los pies hacia el techo",
               "\n".join(b))


# ---------------------------------------------------------------- IL-12
def il12():
    b = [rect(30, 20, 340, 262, 22, N), rect(50, 40, 300, 175, 12, W, P),
         path("M50 100 L350 100 M50 155 L350 155 M200 40 L200 100 M200 155 L200 215", N),
         txt(125, 62, "Frecuencia", 14), txt(125, 90, "35 Hz", 24, True),
         txt(275, 62, "Ancho de pulso", 14), txt(275, 90, "250 µs", 24, True),
         txt(200, 121, "Ciclo", 14), txt(200, 146, "ON 5 s / OFF 10 s", 22, True),
         txt(125, 176, "Subida y bajada", 14), txt(125, 204, "Rampa 1 s", 22, True),
         txt(275, 176, "Intensidad", 14), txt(275, 204, "28 mA", 24, True, color=A),
         circ(270, 248, 16), circ(320, 248, 16),
         path("M262 248 L278 248 M312 248 L328 248 M320 240 L320 256"),
         txt(54, 254, "Ejemplo ilustrativo", 16, True, "start", P)]
    return svg("Parámetros del equipo",
               "Pantalla de un equipo de electroestimulación genérico con valores de ejemplo: 35 Hz, 250 µs, ON 5 s / OFF 10 s, rampa 1 s y 28 mA",
               "\n".join(b))


# ---------------------------------------------------------------- IL-13 (iconos de perfil)
def reloj(x, y, r):
    return [circ(x, y, r),
            path(f"M{x} {y-r+6} L{x} {y-r+12} M{x+r-6} {y} L{x+r-12} {y} M{x} {y+r-6} L{x} {y+r-12} M{x-r+6} {y} L{x-r+12} {y}"),
            path(f"M{x} {y} L{x} {f(y-r*0.62)} M{x} {y} L{f(x+r*0.5)} {f(y+r*0.25)}"), circ(x, y, 4, P, P)]


def busto(x, y, r, moño_dx, hombros=60):
    return [circ(x + moño_dx, y - r * 0.6, r * 0.38, P, P),
            path(f"M{x-hombros} 215 C{x-hombros} {y+r-25} {x+hombros} {y+r-25} {x+hombros} 215 Z", P, N),
            circ(x, y, r)]


def escudo(cx, top, s):
    k = lambda v: f(v * s)
    return path(f"M{cx} {top} l{k(40)} {k(15)} l0 {k(35)} c0 {k(28)} {k(-18)} {k(45)} {k(-40)} {k(55)} "
                f"c{k(-22)} {k(-10)} {k(-40)} {k(-27)} {k(-40)} {k(-55)} l0 {k(-35)} Z", P, P)


ICONOS = {
    "esfuerzo": ("Esfuerzo", "Incontinencia de esfuerzo: figura tosiendo con una gota",
                 lambda: busto(185, 115, 34, -26) + [path("M232 100 L250 92 M236 115 L258 115 M232 130 L250 138", A), gota(282, 175)]),
    "urgencia": ("Urgencia", "Incontinencia de urgencia: reloj con una gota",
                 lambda: reloj(180, 125, 62) + [gota(272, 178, 1.3)]),
    "mixta": ("Mixta", "Incontinencia mixta: reloj, gota y figura tosiendo",
              lambda: reloj(135, 118, 44) + busto(268, 128, 28, 22, 50) +
              [path("M228 115 L214 108 M226 128 L208 128 M228 141 L214 148", A), gota(190, 190)]),
    "fecal": ("Fecal", "Incontinencia fecal: círculo abstracto protegido por un escudo",
              lambda: [circ(165, 115, 55, N), circ(165, 115, 22),
                       path("M165 85 L165 79 M195 115 L201 115 M165 145 L165 151 M135 115 L129 115"),
                       escudo(250, 100, 1.0), check(250, 150, 1.3, W)]),
    "dolor": ("Dolor", "Dolor pélvico: pelvis estilizada con líneas de tensión",
              lambda: [path("M120 85 C140 60 175 75 185 100 L215 100 C225 75 260 60 280 85 C300 120 270 170 240 195 "
                            "L160 195 C130 170 100 120 120 85 Z", P, N),
                       f'<ellipse cx="200" cy="150" rx="28" ry="22" fill="{W}" stroke="{P}"/>',
                       path("M100 95 L90 108 L102 118 L92 131 M300 95 L310 108 L298 118 L308 131 "
                            "M178 50 L189 62 L200 48 L211 62 L222 50", A)]),
    "prolapso": ("Prolapso", "Prolapso: flecha hacia abajo sobre la hamaca del suelo pélvico y flechas de soporte hacia arriba",
                 lambda: [circ(200, 160, 24, N), flecha(200, 50, 200, 126, A, 14),
                          path("M110 160 Q200 212 290 160 L290 172 Q200 226 110 172 Z", A, A),
                          circ(110, 166, 7, P, P), circ(290, 166, 7, P, P),
                          flecha(160, 234, 160, 204, P, 10), flecha(240, 234, 240, 204, P, 10)]),
    "postparto": ("Postparto", "Postparto: silueta de mujer con un bebé en brazos",
                  lambda: busto(175, 110, 32, -26, 62) +
                  [f'<ellipse cx="214" cy="186" rx="42" ry="17" transform="rotate(-15 214 186)" fill="{W}" stroke="{P}"/>',
                   circ(258, 170, 14), path("M140 202 Q196 224 250 194"),
                   path("M282 122 C266 110 268 95 282 104 C296 95 298 110 282 122 Z", A, A)]),
    "prevencion": ("Prevención", "Prevención: escudo con una marca de verificación",
                   lambda: [escudo(200, 45, 1.55), check(200, 128, 2.6, W, ' stroke-width="8"')]),
}


def il13():
    res = {}
    for k, (nombre, desc, motivo) in ICONOS.items():
        body = "\n".join(motivo()) + "\n" + txt(200, 264, nombre, 28, True)
        res[f"IL-13-{k}"] = svg(f"Perfil: {nombre}", desc, body)
    # hoja 4x2
    b = []
    sc = 0.4
    for i, (k, (nombre, _, motivo)) in enumerate(ICONOS.items()):
        cx, top = 50 + 100 * (i % 4), 150 * (i // 4)
        b.append(f'<g transform="translate({f(cx - 200 * sc)} {f(top + 10)}) scale({sc})" stroke-width="{f(3 / sc)}">'
                 + "".join(motivo()) + "</g>")
        b.append(txt(cx, top + 126, nombre, 14, True))
    res["IL-13"] = svg("Iconos de perfiles",
                       "Hoja con los ocho iconos de perfil: esfuerzo, urgencia, mixta, fecal, dolor, prolapso, postparto y prevención",
                       "\n".join(b))
    return res


# ---------------------------------------------------------------- IL-14
def il14():
    b = [rect(10, 30, 252, 245, 12)]
    b += [circ(46 + 45 * k, 30, 6) for k in range(5)]
    b += [txt(135, 62, "Diario miccional", 16, True),
          txt(42, 92, "Hora", 14, True), txt(100, 92, "Micción", 14, True),
          txt(168, 92, "Urgencia", 14, True), txt(232, 92, "Escape", 14, True), line(20, 102, 252, 102)]
    filas = [("8:00", 0, 0), ("10:30", 1, 0), ("13:00", 0, 0), ("15:30", 1, 1)]
    for i, (h, urg, esc) in enumerate(filas):
        y = 128 + 35 * i
        if i:
            b.append(line(20, y - 18, 252, y - 18, N))
        b.append(txt(42, y + 5, h, 14))
        b.append(check(100, y, 0.8))
        b.append(circ(168, y, 6, A, A) if urg else line(162, y, 174, y, N))
        b.append(gota(232, y + 2, 0.45) if esc else line(226, y, 238, y, N))
    b += [path("M325 135 L325 87 A48 48 0 0 1 373 135 Z", "none", A, ' fill-opacity="0.25"')]
    b += reloj(325, 135, 48)
    b += [path("M325 75 A60 60 0 0 1 385 135", A), path("M377 126 L385 136 L393 126", A),
          txt(325, 220, "+15 min", 18, True, color=A), txt(325, 242, "por semana", 15),
          txt(325, 264, "intervalo objetivo", 14)]
    return svg("Diario miccional e intervalo",
               "Diario miccional con columnas de hora, micción, urgencia y escape, junto a un reloj que indica aumentar el intervalo entre micciones 15 minutos por semana",
               "\n".join(b))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = {"IL-01": il01(), "IL-02": il02(), "IL-03": il03(), "IL-04": il04(), "IL-05": il05(),
             "IL-06": il06(), "IL-07": il07(), "IL-08": il08(), "IL-09": il09(), "IL-10": il10(),
             "IL-11": il11(), "IL-12": il12(), "IL-14": il14()}
    files.update(il13())
    for name, content in files.items():
        (OUT / f"{name}.svg").write_text(content, encoding="utf-8")
        print(f"{name}.svg  {len(content.encode('utf-8'))} B")


if __name__ == "__main__":
    main()
