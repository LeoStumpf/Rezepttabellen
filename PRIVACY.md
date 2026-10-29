# Privacy policy — Rezepttabellen

_Last updated: 2026-10-29_

**Short version:** Rezepttabellen has no account, no analytics, no crash reporting and no
advertising. It is self-hosted: your recipes live on **your own server** and, on Android, in an
offline copy on your phone. The app talks only to the server address you enter. Nobody else —
including the developer — receives any of your data.

## The server you run

- Recipes (`rezept.yaml`, `notizen.md`, images), your pantry and shopping list, collections and
  the photo inbox are stored in the server's data folder (`DATA_DIR`) as plain files plus a
  small SQLite index.
- The optional password (`APP_PASSWORT`) protects **writing** (saving, deleting, uploading
  photos). Reading is open to anyone who can reach the server's port, so keep the server in
  your home network or VPN, or put it behind a reverse proxy with TLS and access control.
- **Outbound requests:** the server goes online only when you use **import from a website**:
  it then loads the page whose address you entered and the recipe image named in it
  (`server/src/import.ts`). The **PDF export** runs a local headless Chromium that only opens
  the server's own print page. Nothing else leaves the server.

## The Android app

- **Network:** the app contacts only the server address you entered in its settings — for
  syncing, recipe images, the photo inbox, the update check (`/api/app`) and website imports
  (which the server performs). The app itself never contacts the imported website.
- **Plain HTTP:** the app allows unencrypted HTTP so it can reach a server in your home network.
  Over HTTP, your data and password are readable by anyone on the same network path — use it
  only in a trusted network or behind HTTPS.
- **Stored on the phone:**
  - An offline copy of your recipes and images, the pantry and shopping list, the sync state
    and photos waiting to be uploaded, under `Android/data/io.github.leostumpf.rezepttabellen/files/`.
    Other apps can't read it; it can be reached over USB and is deleted when you uninstall.
  - Settings in the app's local storage: the server address and **the password in plain
    text**, view and sort preferences, the fridge list, running kitchen timers and cooking-mode
    progress (kept for 12 hours).
- **Permissions:**
  - Internet — the server you configured.
  - Notifications (`POST_NOTIFICATIONS`) and exact alarms (`USE_EXACT_ALARM`,
    `SCHEDULE_EXACT_ALARM`) — kitchen timers.
  - The camera is used through the system camera, only when you take a photo of a recipe.
- **Sharing into the app:** you can share a link from another app to import a recipe; the
  link goes to your server, which fetches it.
- Android's own device backup (if you have turned it on) may include the app's settings.

## Children

The app is not directed at children and collects no data from anyone.

## Changes

Changes to this policy are made in this file; the git history shows every version.

## Contact

Leo Stumpf — open an issue at <https://github.com/LeoStumpf/Rezepttabellen/issues>.
