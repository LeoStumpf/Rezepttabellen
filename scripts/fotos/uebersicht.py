"""Kontaktbogen je Auftrag: alle Fotos eines Auftrags nebeneinander, zum schnellen Sichten.
python3 -I uebersicht.py <eingang-ordner> <ausgabe-ordner>
Legt <ausgabe-ordner>/<auftrag>.jpg an (Höhe 700 px)."""
import sys, glob, os
from PIL import Image, ImageOps
eingang, aus = sys.argv[1], sys.argv[2]
os.makedirs(aus, exist_ok=True)
for d in sorted(glob.glob(os.path.join(eingang, '2*'))):
    ims = [ImageOps.exif_transpose(Image.open(f)).convert('RGB') for f in sorted(glob.glob(os.path.join(d, 'bild-*')))]
    if not ims: continue
    h = 700
    ims = [i.resize((round(i.width * h / i.height), h)) for i in ims]
    s = Image.new('RGB', (sum(i.width for i in ims), h), 'white')
    x = 0
    for i in ims:
        s.paste(i, (x, 0)); x += i.width
    ziel = os.path.join(aus, os.path.basename(d) + '.jpg')
    s.save(ziel, quality=80)
    print(ziel, len(ims), 'Fotos')
