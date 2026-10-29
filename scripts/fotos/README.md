# Foto-Eingang → Rezepte

Werkzeuge und Regeln, um abfotografierte Rezepte (📷-Modus der App) in Rezepte der Sammlung zu verwandeln. Gedacht für Claude, funktioniert aber genauso von Hand. Braucht nur Python 3 mit Pillow.

`$DEPLOY_HOST`, `$DEPLOY_BASE` und `$SERVER_URL` sind die Betriebswerte aus `~/.config/rezepttabellen/ops.env` (siehe `scripts/ops-env.sh`; vorher `. scripts/ops-env.sh`).

## Ablauf

1. **Holen:** `scripts/fotos/holen.sh $W`. `$W` ist ein Arbeitsordner, bei Claude das Scratchpad.
   - Das Skript legt `$W/eingang/<auftrag>/` (Kopie vom Server), `$W/arbeit/`, `$W/pruef/rezepte/` und Kontaktbögen unter `$W/arbeit/bogen/` an.
   - Die Kontaktbögen zuerst ansehen. Dann ist klar, welches Rezept in welchem Auftrag steckt, welches Foto das Gericht und welches den Text zeigt, und welche gedreht sind.
2. **Je Rezept:** Text lesen, Bild ausschneiden und `rezept.yaml`/`notizen.md` schreiben, nach den Regeln unten.
   - Ab etwa 5 Aufträgen lohnt es sich, auf mehrere parallele Helfer zu verteilen (je 4–5 Aufträge). Jeder bekommt diese Datei und ein fertiges Muster-Rezept.
   - Zum Schluss alles auf einheitliche Tags, Titel und Einheiten prüfen.
3. **Prüfen:** `DATA_DIR=$W/pruef npx tsx server/src/pruefen.ts`. Jedes Rezept muss ✓ zeigen.
   - Für den Kontrollbogen aller Bilder: `python3 -I scripts/fotos/bilderbogen.py $W/pruef/rezepte $W/arbeit/alle.jpg`.
4. **Übertragen:**
   - Erst prüfen, dass es noch keinen gleichnamigen Ordner gibt: `ssh $DEPLOY_HOST test -e $DEPLOY_BASE/data/rezepte/<slug>`.
   - Dann `scp -r $W/pruef/rezepte/* $DEPLOY_HOST:$DEPLOY_BASE/data/rezepte/`. Der Server übernimmt die Ordner sofort.
   - Kontrolle: `curl -s $SERVER_URL/api/rezepte`, dort darf bei den neuen Rezepten kein `fehler` stehen.
5. **Abschließen:** `ssh $DEPLOY_HOST "cd $DEPLOY_BASE/data/foto-eingang && mv <aufträge> erledigt/"`. Danach die unsicheren Stellen nennen.

Die lokale Kopie (`~/Rezepte`) nicht beschreiben, maßgeblich ist der Server.

## Werkzeuge (`python3 -I scripts/fotos/<skript>`)

| Skript | Zweck |
|---|---|
| `raster.py <bild> <aus.jpg> [drehung]` | Vorschau mit Koordinatengitter in Originalpixeln. Drehung 90/180/270 gegen den Uhrzeigersinn; die Koordinaten gelten fürs gedrehte Bild. |
| `kacheln.py <bild> <aus.png> <drehung> x0 y0 x1 y1` | Lesekachel in voller Auflösung, Graustufen und Autokontrast. Kleinen Text **immer** über Kacheln lesen (Zutatenkasten, Schritte in 2–3 Teilen, Zitatkasten), nie aus der Vorschau raten. |
| `zuschnitt.py <bild> <bild-1.jpg> <drehung> xOL yOL xOR yOR xUR yUR xUL yUL` | Schneidet das Gerichtsfoto aus und entzerrt es perspektivisch über 4 Ecken (oben-links, oben-rechts, unten-rechts, unten-links). Lange Seite max. 2000 px, leichte Tonwertkorrektur. Das Ergebnis immer ansehen. |
| `uebersicht.py <eingang> <aus-ordner>` | Kontaktbogen je Auftrag (macht `holen.sh` mit). |
| `bilderbogen.py <rezepte> <aus.jpg>` | Kontrollbogen aller `bild-1.jpg`. |

Bildziel: nur das Gerichtsfoto aus dem Buch, ohne Buchfalz, Seitenrand, Text und möglichst ohne Finger. Schief fotografierte Seiten über die 4 Ecken gerade ziehen.

## Regeln für den Inhalt

Vorbilder: jedes Rezept in `rezepte/` auf dem Server, z. B. `wuerziges-kokos-linsen-dahl` (aus Fotos entstanden) oder `auberginen-nudeln-mit-sojabutter`. Das Schema steht in `shared/src/schema.ts`, die Einheiten in `shared/src/units.ts`: g kg ml l EL TL Prise Stück Zehe Bund Dose Packung Becher Scheibe „nach Geschmack“.

**Kopfdaten**
- Alles auf Deutsch. `titel` ist ein natürlicher deutscher Titel. `untertitel` ist der Originaltitel (ohne [VG]/[★]), dann „ – “ und eine kurze Beschreibung.
- `id` ist eine neue UUID (`python3 -c "import uuid;print(uuid.uuid4())"`). Der Ordnername (slug) ist klein, ASCII (ä→ae), mit Bindestrichen.
- `portionen` kommt aus „Serves“, `zeit.gesamt_min` aus der Zeitangabe (1 hr 15 mins = 75).
- `quelle.name` ist Buch und Seite, z. B. `MOB Veggie (Buch), S. 100`. Ist keine Seitenzahl lesbar, nur den Buchtitel.

**Tags**
- Zuerst genau **ein** Ernährungs-Tag: `Vegan`, `Vegetarisch`, `Pescetarisch` oder `Fleisch`.
  - Im Buch bedeutet [VG] Vegan und [V] Vegetarisch.
  - Ohne Marke nach den Zutaten: Ei, Käse, Butter, Honig → Vegetarisch; Fisch oder Fischsauce → Pescetarisch.
- Danach 1–3 Art-Tags aus: Nudeln, Curry, Asiatisch, Indisch, Mexikanisch, Brunch, Bowl, Salat, Schnell (≤ 30 min), Ofen, Wraps, Sandwich.

**Zutaten**
- Mengen, die nur in den Schritten stehen, in die Zutat ziehen.
  - tablespoon → EL, teaspoon → TL, clove → Zehe, tin → Dose (`hinweis: 400 g`), packet → Packung oder g.
  - cups und oz weglassen.
  - handful, glug oder splash wird `nach Geschmack` mit `hinweis`; pinch wird Prise.
- Wird eine Zutat getrennt an zwei Stellen verwendet (etwa Koriander zum Mischen und zum Garnieren), gibt es zwei Einträge (`koriander1`, `koriander2`).
- Zutatennamen auf Deutsch: spring onions = Frühlingszwiebeln, coriander = Koriander, butternut squash = Butternutkürbis, double cream = Sahne, courgette = Zucchini.
- **Nur Zutaten, die es bei Rewe/Edeka gibt.** Was ein normaler großer Supermarkt nicht führt, direkt im Rezept ersetzen, ohne Notiz (auch im ausführlichen Ablauf). Beispiele:
  - Marmite → Hefeextrakt (z. B. Vitam-R)
  - Tenderstem/Bimi/Brokkolini/Sprossenbrokkoli → Brokkoli (in Röschen)
  - Double Cream → Sahne
  - Golden Syrup → Zuckerrübensirup
  - Self-raising flour → Mehl + Backpulver
  - Asia-Regal-Artikel (Sojasauce, Mirin, Miso, Sriracha, Tahini, Fischsauce, Gochujang) sowie Paneer und Halloumi bleiben stehen.
  - Im Zweifel stehen lassen statt falsch ersetzen.

**Schritte**
- Kurze Tabellentexte ohne Wiederholung der Zutat, mit Zeiten und Temperaturen.
- `nimmt` enthält Zutaten-ids und/oder frühere Schritt-ids. Jede Zutat wird genau einmal verwendet.
- Am Ende steht ein einziger Endschritt. Parallelstränge (Reis, Sauce) sind eigene Ketten.
- Werte mit Komma oder Doppelpunkt in YAML in Anführungszeichen setzen; das Schema ist strict.

**notizen.md**
- Reihenfolge der Abschnitte: Tipps, Vegetarische Alternative, Ohne Tomaten, Ausführlicher Ablauf, Unsicher gelesen.
- `## Tipps`:
  - der Zitatkasten, übersetzt in „…“,
  - „MOB-Favorit (★ im Buch)“, falls die Marke da ist,
  - „Song zum Kochen: Künstler – Titel“.
- `## Vegetarische Alternative` (nur bei Fleisch oder Fisch, auch Fischsauce):
  - ein konkreter Ersatz, der zum Gericht passt, mit Menge und Garhinweis, z. B. „Statt 500 g Hähnchen: 400 g Räuchertofu, nur 20 min backen“
  - ggf. eine zweite Option
  - das Rezept selbst bleibt unverändert
- `## Ohne Tomaten` (nur bei Tomaten oder Tomatenprodukten wie Tomatenmark, passierte/gehackte/getrocknete Tomaten, Ketchup):
  - je Tomatenzutat ein Ersatz nach ihrer Funktion (Säure, Süße, Umami, Farbe), mit Menge
  - z. B. passierte Tomaten → geröstete Paprika (Glas) püriert + Rotweinessig, Tomatenmark → Ajvar/Paprikamark, frische Tomaten → rote Paprika, Gurke, Radieschen
  - das Rezept selbst bleibt unverändert
- `## Ausführlicher Ablauf`: **alle** Originalschritte vollständig und genau übersetzt, nummeriert.
- `## Unsicher gelesen`: jede unsichere Menge, Zeit oder Seitenzahl konkret benennen. Nichts erfinden.
