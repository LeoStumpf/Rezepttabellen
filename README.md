# Rezepttabellen

A self-hosted recipe collection in the style of the **recipe tables** from
[Cooking for Engineers](https://www.cookingforengineers.com): the ingredients run down the left,
the steps run to the right, and each step spans exactly the ingredients that go into it. You read
a recipe as a tree, not a list — everything in the first column can start at once, and a long cell
means that result can wait until it is needed.

Rezepttabellen is a **web app you run on your own server** (Docker) plus an **Android app** that
keeps a full offline copy and syncs both ways. Recipes are stored as plain, readable files — YAML,
Markdown and images — that stay usable without the app. **The app's user interface is German
only.**

## Install

Rezepttabellen has two parts: the server holds the recipes, and the Android app (or any browser)
talks to it.

### Server (Docker)

```bash
git clone https://github.com/LeoStumpf/Rezepttabellen.git
cd Rezepttabellen
REZEPTE_DIR=/srv/rezepte docker compose up -d --build
```

Then open `http://<server-ip>:8080`. The root [`docker-compose.yml`](docker-compose.yml) builds
the image (Node plus Chromium for the PDF export) and is the only thing you need:

| Setting | Default | Meaning |
|---|---|---|
| `REZEPTE_DIR` | `~/Rezepte` | Host folder with your recipes, mounted at `/app/data` |
| `APP_PASSWORT` | empty | Optional password for everything that *writes*: saving, deleting, photo upload |
| port | `8080` | Change the left side of `ports:` to move it |
| `user:` | `${UID}:${GID}` | The files belong to you, so you can edit them by hand |

**Your recipes are not part of the code.** Keep `REZEPTE_DIR` outside the repository and back it
up like any other folder.

**Keep it private.** The server speaks plain HTTP, and `APP_PASSWORT` only guards writes — anyone
who can reach the port can read your recipes. Run it in your LAN or behind a VPN, or put it behind
a reverse proxy with TLS (and access control) if it must be reachable from outside.

Without Compose:

```bash
docker build -t rezepttabellen .
docker run -d --name rezepttabellen --restart unless-stopped --user 1000:1000 \
  -p 8080:8080 -v /srv/rezepte:/app/data rezepttabellen
```

Without Docker (Node ≥ 20):

```bash
npm install
npm run build
DATA_DIR=/srv/rezepte CHROMIUM_PATH=/usr/bin/chromium npm start   # CHROMIUM_PATH only for PDF export
```

### Android app

1. **Download from GitHub** — take the APK from the
   [latest release](https://github.com/LeoStumpf/Rezepttabellen/releases/latest), open it and
   allow the install. To get updates automatically, add this repository to
   [Obtainium](https://obtainium.imranr.dev/).
2. **Install through Google Play as a tester** — *coming soon.* A closed test on Google Play is
   being set up; this section will link to it once it is open.

The app needs your server: open **⇅ Sync** and fill in **Server-Adresse** (server address, e.g.
`http://192.168.1.10:8080`) and **Passwort (falls am Server gesetzt)** (password, if the server
has one), then **⇅ Jetzt synchronisieren** (sync now). After that every recipe is on the phone,
and reading, editing and creating work offline; changes go to the server on the next sync. The
app syncs on its own when it starts or returns to the foreground (at most every two minutes).

**Updates from your own server (optional).** The server can hand out an APK too: put
`rezepttabellen.apk` and a `version.json` (`{ "versionCode": 12, "versionName": "1.11" }`) into
`<REZEPTE_DIR>/app/`. The app checks `GET /api/app` and offers *Neue App-Version … Installieren*
when the server's `versionCode` is newer; the link downloads `/app/rezepttabellen.apk`. Opening
that URL in a phone browser is also a cable-free first install. Android only accepts an update
signed with the same key as the installed app, so serve the same APK flavour you installed.

> **Transparency:** Rezepttabellen was "vibe-coded" collaboratively with Claude (Anthropic's AI
> assistant), which wrote much of the code under human direction.

## Features

**Reading a recipe**
- **Schritte · Tabelle · Liste** (steps · table · list). The table is the default; it scrolls
  sideways when a recipe has many steps, and the text of a long step travels along while you
  scroll. Pinch to zoom (Ctrl + mouse wheel on a computer); **⤢ Ganz** fits the whole table.
- **Scaling**: change the servings with − / +, or tap an amount and enter what you have (250 g
  instead of 500 g pasta) — every amount is recalculated and rounded to kitchen-friendly values.
- **Cooking mode** keeps the screen on and lets you tick off steps; the ticks survive an app
  restart for 12 hours.
- **Timers**: times in a step ("10 Minuten", "15–20 min", "1½ Std.") are tappable and start a
  timer; on Android a notification fires even when the phone is locked.
- **PDF export** onto exactly one A4 page, scaled to fit, with QR codes to the source and video.
  On the phone, the A4 view opens Android's print dialog ("Save as PDF").
- Share a recipe or just its ingredients as text, with the current scaled amounts.

**Finding recipes**
- Three overview layouts: tiles, details (with time, ingredients and what is missing from your
  pantry), and **Discover** — one recipe per screen, swipe up like reels, endless.
- Full-text search over titles, tags and **ingredients**; filters for diet (vegan, vegetarian,
  pescetarian, meat — derived from tags) and time (≤ 30/45/60 min).
- **Fridge mode**: enter what you have and see recipes that use *all* or *at least one* of it.
  Matching is deliberately strict ("Paprika" does not match paprika powder) but knows synonyms
  ("Karotte" finds "Möhren").
- Favourites, sorting (A–Z, newest, quickest, recently cooked, not cooked for a while) and a
  **cooking log** with optional ★ rating and note.
- **Variants**: recipes that share a core (apple cake: sunken, crumble, covered…) form a group
  shown as one tile, with a comparison of the common base and the extras each variant needs.

**Pantry and shopping**
- **Vorrat** (pantry): every item is *da* / *knapp* / *leer* (have / low / out) in a category.
  "Aus Rezepten abhaken" lists every ingredient of your recipes so the pantry is built in minutes.
- In a recipe, ✓ marks what you have; the **🛒 shopping view** marks what is missing.
- **Einkaufsliste** (shopping list): add what a recipe is missing with the current amounts; the
  same ingredient from several recipes is summed (g/kg, ml/l converted). Tick items off while
  shopping, and "Einkauf fertig" puts them back into the pantry. Share the list as text.

**Adding recipes**
- A form editor with a live table preview. Every recipe needs at least one image, and a source
  link is always stored.
- **Import from a website**: paste a URL (or share it from the browser into the Android app). The
  server reads the page's schema.org recipe data — most recipe sites and blogs — plus its image.
  Which ingredient goes into which step is a guess, so check the table preview before saving.
- **Photo mode (📷)**: photograph recipes from books, magazines or notes, several pages per
  recipe. The photos land in the server's **photo inbox** (`foto-eingang/`) for transcribing by
  hand or with an AI assistant; offline, they wait on the phone and upload automatically later.
  Tools and rules for turning them into recipes are in [`scripts/fotos/README.md`](scripts/fotos/README.md).
- Add photos to a recipe straight from the camera or gallery, and pick the main image.

**Data**
- Plain files on the server, editable by hand; the server picks up changes immediately.
- Two-way sync with the Android app. If a recipe was changed on both sides, the server wins and
  the phone's version is kept as "… (Konflikt Handy)" — nothing is lost. Pantry, shopping list,
  favourites and log sync too (newest change wins).
- Deleted recipes go to a trash folder; the whole collection downloads as a ZIP.

## Recipe format

```
<REZEPTE_DIR>/
  rezepte/linguine-mit-karamellisierten-zwiebeln/
    rezept.yaml          title, ingredients, steps, source, video link, tags …
    notizen.md           tips and long-form notes (Markdown)
    bild-1.jpg           at least one image (the first is the main image)
  papierkorb/            deleted recipes
  foto-eingang/          photo inbox (see above)
  vorrat.sqlite          pantry (readable copy: vorrat-backup.json)
  persoenlich.sqlite     shopping list, favourites, cooking log (copy: persoenlich-backup.json)
  index.sqlite           index and sync log only — delete it and it is rebuilt from the files
  app/                   optional: rezepttabellen.apk + version.json for in-app updates
```

An excerpt from `rezept.yaml`:

```yaml
zutaten:
  - { id: zwiebeln, menge: 3, einheit: Stück, name: große Zwiebeln, hinweis: ca. 600 g }
  - { id: butter1, menge: 80, einheit: g, name: Butter }
schritte:
  - id: s1
    text: halbieren, in feine Halbringe schneiden
    nimmt: [ zwiebeln ]
  - id: s2
    text: Butter schmelzen, Zwiebeln 30–40 min karamellisieren
    nimmt: [ s1, butter1 ]        # ingredients and/or earlier steps
variante: { gruppe: Apfelkuchen, name: Mit Streuseln, nr: 2 }   # optional
```

Every ingredient and every step is "taken" (`nimmt`) exactly once; the table is built from that.
Each step is placed as far left as it can go and spans down over everything that feeds into it.
The numbers are only a suggestion (column by column, top to bottom) — the table itself prescribes
no order.

Units: `g kg ml l EL TL Prise Stück Zehe Bund Dose Packung Becher Scheibe` and `nach Geschmack`.
The diet filter reads the tags `Vegan`, `Vegetarisch`, `Pescetarisch`/`Fisch` and `Fleisch`
(meats like `Hähnchen`, `Schwein` or `Wurst` count as meat).

**Editing by hand is fine.** A new folder with a `rezept.yaml` is a new recipe (its `id` is added
automatically), and YAML errors are shown in the app. To check the whole collection:

```bash
DATA_DIR=/srv/rezepte npx tsx server/src/pruefen.ts
```

Imported recipes carry the marker `<!-- import: Inhaltsregeln offen -->` in `notizen.md` until
someone has reviewed them.

## Tech stack

| Part | Built with |
|---|---|
| Shared model | TypeScript, [zod](https://zod.dev) schema, [`yaml`](https://eemeli.org/yaml/), the table-layout algorithm |
| Server | [Fastify](https://fastify.dev), SQLite via `better-sqlite3`, `chokidar` (file watching), `sharp` (images), `archiver` (ZIP), `playwright-core` + Chromium (PDF) |
| Web app | [Svelte 5](https://svelte.dev) + Vite, `marked` + `DOMPurify` (notes), `qrcode` |
| Android | [Capacitor 7](https://capacitorjs.com) (camera, filesystem, local notifications, share), plus a small print plugin |
| Tests | [Vitest](https://vitest.dev), `svelte-check` |

```
shared/    schema, units, table-layout algorithm, YAML
server/    Fastify API, file store, SQLite index, PDF (Chromium), website import, photo inbox
web/       Svelte app (browser and Android) incl. offline store and sync
android/   Capacitor project incl. the print plugin
scripts/   deploy, APK publishing, backup, photo-inbox tools
```

## Develop

```bash
npm install
npm run dev:server     # API on :8080 (DATA_DIR=… for another data folder)
npm run dev:web        # Vite on :5173, proxying to the API
npm test               # table layout, schema, store and sync logic
npm run check          # type checks (shared, web, server)
npm run build          # production build of the web app
```

### Android

Needs the Android SDK and JDK 21.

```bash
npm run apk
# → android/app/build/outputs/apk/release/app-release.apk
```

The release build is signed with your upload keystore through `android/key.properties`
(gitignored, never committed):

```properties
storeFile=/home/you/rezepttabellen-upload-keystore.jks
storePassword=…
keyAlias=upload
keyPassword=…
```

Without that file the build falls back to the debug key, which is fine for trying things out but
cannot update an APK signed with a real key.

An optional `web/.env.android.local` (gitignored) pre-fills the server for your own builds:
`VITE_SERVER_URL=http://192.168.1.10:8080` and `VITE_APP_PASSWORT=…`. The password then sits in
the APK — never publish an APK built that way.

### Releasing

1. Raise `versionCode` and `versionName` in `android/app/build.gradle`.
2. Write `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` (≤ 500 characters).
3. Commit and push, then tag:

   ```bash
   git tag v<versionName> && git push origin v<versionName>
   ```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs `npm test` and `npm run check`
on every push, builds the web app and the Android release APK and AAB, and on a `v*` tag publishes
a GitHub release with `Rezepttabellen-<versionName>.apk`. The AAB for Google Play is in the run's
artifact. Signing uses three repository secrets: `ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_PASSWORD`.

### Operating your own instance

A few helper scripts cover deploying to a server over SSH, publishing an APK for in-app updates,
and backups. They read their settings from `~/.config/rezepttabellen/ops.env`:

```bash
DEPLOY_HOST=myserver                  # ssh host the app runs on
DEPLOY_BASE=/srv/rezepttabellen       # holds compose/, data/ and src/ on that host
SERVER_URL=http://192.168.1.10:8080   # where the app answers
BACKUP_DIR=$HOME/Backups/Rezepte      # target of the local backup
PCLOUD_DIR=$HOME/CloudDrive           # mount point that must be present before backing up
```

- `scripts/ausrollen.sh` — copies the code to `$DEPLOY_HOST:$DEPLOY_BASE/src`, builds the image
  there (works on arm64), installs your compose file (`DEPLOY_COMPOSE`, default
  `~/.config/rezepttabellen/docker-compose.yml`), tags the image with the Git commit and restarts.
  Rolling back is an older tag in `compose/.env` and `docker compose up -d`.
- `scripts/apk-veroeffentlichen.sh` — copies the release APK and a matching `version.json` to
  `$DEPLOY_HOST:$DEPLOY_BASE/data/app`, so installed apps offer the update.
- `scripts/rezepte-backup.sh` — mirrors a local recipe folder to `$BACKUP_DIR` (skipping the
  rebuildable SQLite index and image cache; the pantry is covered by `vorrat-backup.json`). A
  systemd user timer runs it hourly:

  ```bash
  mkdir -p ~/.config/systemd/user
  cp scripts/systemd/rezepte-backup.* ~/.config/systemd/user/
  systemctl --user daemon-reload
  systemctl --user enable --now rezepte-backup.timer
  loginctl enable-linger $USER          # keep the timer running without a login
  ```

- `scripts/fotos/` — fetches the photo inbox from `$DEPLOY_HOST` and helps turn photos into
  recipes; see [`scripts/fotos/README.md`](scripts/fotos/README.md).

## Privacy

No analytics, no ads, no accounts, no telemetry. Your recipes live on your server and, if you use
the Android app, in its offline copy on your phone. The app talks only to the server address you
enter. The server makes outbound requests only when you import a recipe from a website: it then
fetches the page you entered and its recipe image. The PDF export renders the recipe in a local
Chromium that loads only the server's own page. Full detail in [`PRIVACY.md`](PRIVACY.md).

## License

Rezepttabellen is free software, released under the **GNU Affero General Public License, version 3
or (at your option) any later version** — see [`LICENSE`](LICENSE) for the full text.

You may use, study, share and modify it. If you distribute it — or a modified version — you must
pass on the same freedoms and make the complete corresponding source available under the same
licence. Because Rezepttabellen is a network service, the AGPL also applies when you let others
use a modified version over a network: its users are entitled to that source too.

    Rezepttabellen — a self-hosted recipe collection in recipe-table format.
    Copyright (C) 2026 Leo Stumpf

    This program is free software: you can redistribute it and/or modify it under the terms
    of the GNU Affero General Public License as published by the Free Software Foundation,
    either version 3 of the License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
    without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
    See the GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License along with this
    program.  If not, see <https://www.gnu.org/licenses/>.

The libraries Rezepttabellen is built on keep their own licences — see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
