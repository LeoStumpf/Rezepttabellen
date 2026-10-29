"""Lesekachel: Bereich eines Fotos aufrecht, in voller Auflösung, Graustufen + Autokontrast.
python3 -I kacheln.py <bild> <ausgabe.png> <drehung> <x0> <y0> <x1> <y1>
Koordinaten im gedrehten Bild (siehe raster.py). Ausgabe max. 1800 px breit."""
import sys
from PIL import Image, ImageOps
src, out, rot = sys.argv[1], sys.argv[2], int(sys.argv[3])
x0, y0, x1, y1 = map(int, sys.argv[4:8])
im = ImageOps.exif_transpose(Image.open(src)).convert('L')
if rot: im = im.rotate(rot, expand=True)
k = ImageOps.autocontrast(im.crop((x0, y0, x1, y1)), cutoff=1)
if k.width > 1800: k = k.resize((1800, round(k.height * 1800 / k.width)), Image.LANCZOS)
elif k.width < 1200: k = k.resize((k.width * 2, k.height * 2), Image.LANCZOS)
k.save(out)
print(k.size)
