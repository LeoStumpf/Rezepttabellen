"""Kontrollbogen: die bild-1.jpg aller Rezeptordner als Raster mit Namen.
python3 -I bilderbogen.py <rezepte-ordner> <ausgabe.jpg>"""
import sys, glob, os
from PIL import Image, ImageDraw
quelle, aus = sys.argv[1], sys.argv[2]
fs = sorted(glob.glob(os.path.join(quelle, '*', 'bild-1.jpg')))
T, cols = 330, 5
rows = (len(fs) + cols - 1) // cols
s = Image.new('RGB', (cols * T, max(1, rows) * (T + 20)), 'white')
d = ImageDraw.Draw(s)
for i, f in enumerate(fs):
    im = Image.open(f)
    name = os.path.basename(os.path.dirname(f))
    print(name, im.size)
    im.thumbnail((T - 6, T - 6))
    x, y = (i % cols) * T, (i // cols) * (T + 20)
    s.paste(im, (x + 3, y + 3))
    d.text((x + 3, y + T + 3), name[:40], fill='black')
s.save(aus, quality=85)
