"""Vorschau mit Koordinatengitter (in Originalpixeln), um Ausschnitte/Eckpunkte zu bestimmen.
python3 -I raster.py <bild> <ausgabe.jpg> [drehung 0|90|180|270]
Drehung gegen den Uhrzeigersinn (wie PIL rotate). Koordinaten gelten fürs GEDREHTE Bild."""
import sys
from PIL import Image, ImageOps, ImageDraw
src, out = sys.argv[1], sys.argv[2]
rot = int(sys.argv[3]) if len(sys.argv) > 3 else 0
im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
if rot: im = im.rotate(rot, expand=True)
f = 1000 / max(im.size)
v = im.resize((round(im.width * f), round(im.height * f)))
d = ImageDraw.Draw(v)
for x in range(0, im.width, 100):
    X = x * f; d.line([(X, 0), (X, v.height)], fill=(255, 0, 255) if x % 500 == 0 else (0, 255, 255), width=1)
    if x % 500 == 0: d.text((X + 2, 2), str(x), fill=(255, 0, 255))
for y in range(0, im.height, 100):
    Y = y * f; d.line([(0, Y), (v.width, Y)], fill=(255, 0, 255) if y % 500 == 0 else (0, 255, 255), width=1)
    if y % 500 == 0: d.text((2, Y + 2), str(y), fill=(255, 0, 255))
v.save(out, quality=85)
print(f'{im.width}x{im.height} (gedreht {rot})')
