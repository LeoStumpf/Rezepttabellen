# Rezepttabellen – Hinweise für Claude

Aufbau, Datenformat und Betrieb stehen in der README. Rezepte liegen **nicht** im Repo, sondern im Datenordner des Servers (`DATA_DIR`). Betriebswerte des eigenen Servers (Host, Pfade, Backup-Ziel) stehen außerhalb des Repos in `~/.config/rezepttabellen/ops.env` (gelesen von `scripts/ops-env.sh`); private Hinweise in `CLAUDE.local.md` (gitignored), falls vorhanden.

## Android-Release

Nach jeder App-Änderung: `versionCode`/`versionName` in `android/app/build.gradle` erhöhen → `npm run apk` (signiertes Release-APK, Schlüssel über `android/key.properties`) → `scripts/apk-veroeffentlichen.sh` (der eigene Server bietet das Update dann in der App an). Öffentliche Version: `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` schreiben, Tag `v<versionName>` pushen – die CI baut und veröffentlicht das Release auf GitHub (README „Releasing“). Die `applicationId` `io.github.leostumpf.rezepttabellen` nie ändern.

## Foto-Eingang auswerten („werte die Rezeptfotos aus“)

Mit dem 📷-Modus der App fotografierte Rezepte warten auf dem Server in
`$DEPLOY_BASE/data/foto-eingang/<YYYY-MM-DD_HHMM>-<id8>/`. Jeder Ordner ist ein Auftrag mit `auftrag.json` (`notiz`, `bilder`, `erstellt`) und `bild-1.jpg …`; mehrere Bilder gehören meist zu **einem** Rezept.

Ablauf, Werkzeuge und Inhaltsregeln stehen in **`scripts/fotos/README.md`**. Die **Inhaltsregeln** dort (deutsche Supermarkt-Zutaten, Abschnitte „Vegetarische Alternative“ und „Ohne Tomaten“ in `notizen.md`) gelten für **jedes** neue Rezept, auch aus Webseiten oder von Hand.

Kurz: `scripts/fotos/holen.sh <scratchpad>` → Kontaktbögen ansehen → je Rezept mit `raster.py`/`kacheln.py` lesen und mit `zuschnitt.py` das Bild ausschneiden → `rezept.yaml` und `notizen.md` nach den Regeln schreiben → mit `pruefen.ts` prüfen → per `scp` auf den Server → Aufträge nach `erledigt/` verschieben → die unsicheren Stellen nennen.

## Importierte Rezepte prüfen

Rezepte aus dem Webseiten-Import der App tragen in `notizen.md` die Zeile `<!-- import: Inhaltsregeln offen -->`. Auf „prüfe importierte Rezepte“: auf dem Server danach suchen (`grep -l 'import: Inhaltsregeln offen' $DEPLOY_BASE/data/rezepte/*/notizen.md`), die Inhaltsregeln anwenden (Zutaten ersetzen, Abschnitte ergänzen, Tags, Schrittzuordnung prüfen) und die Zeile entfernen.
