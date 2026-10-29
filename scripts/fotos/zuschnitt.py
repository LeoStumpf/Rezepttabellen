"""Bild vom Gericht ausschneiden und perspektivisch entzerren.
python3 -I zuschnitt.py <bild> <ausgabe.jpg> <drehung> <x_ol> <y_ol> <x_or> <y_or> <x_ur> <y_ur> <x_ul> <y_ul>
Eckpunkte oben-links, oben-rechts, unten-rechts, unten-links im gedrehten Bild (raster.py).
Ergebnis: Rechteck, lange Seite max. 2000 px, leichte Tonwertkorrektur, JPEG q88."""
import sys, math
from PIL import Image, ImageOps, ImageEnhance
src, out, rot = sys.argv[1], sys.argv[2], int(sys.argv[3])
p = list(map(float, sys.argv[4:12]))
ol, orr, ur, ul = (p[0], p[1]), (p[2], p[3]), (p[4], p[5]), (p[6], p[7])
im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
if rot: im = im.rotate(rot, expand=True)
d = math.dist
w = round((d(ol, orr) + d(ul, ur)) / 2)
h = round((d(ol, ul) + d(orr, ur)) / 2)
# QUAD erwartet: oben-links, unten-links, unten-rechts, oben-rechts
r = im.transform((w, h), Image.QUAD, (*ol, *ul, *ur, *orr), Image.BICUBIC)
r = ImageOps.autocontrast(r, cutoff=0.5, preserve_tone=True)
r = ImageEnhance.Color(r).enhance(1.08)
f = min(1, 2000 / max(r.size))
if f < 1: r = r.resize((round(r.width * f), round(r.height * f)), Image.LANCZOS)
r.save(out, quality=88, optimize=True)
print(r.size)
