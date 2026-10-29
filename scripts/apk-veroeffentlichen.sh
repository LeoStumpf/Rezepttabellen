#!/usr/bin/env bash
# Legt das signierte Release-APK auf den eigenen Server, damit die App das Update
# selbst anbietet (⇅ Sync → „Neue Version“). Vorher: npm run apk
# Werte aus ~/.config/rezepttabellen/ops.env: DEPLOY_HOST, DEPLOY_BASE, optional SERVER_URL.
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/ops-env.sh
ops_brauche DEPLOY_HOST DEPLOY_BASE

APK=android/app/build/outputs/apk/release/app-release.apk
ZIEL="$DEPLOY_HOST:$DEPLOY_BASE/data/app"
code=$(sed -n 's/^ *versionCode \([0-9]*\).*/\1/p' android/app/build.gradle)
name=$(sed -n 's/^ *versionName "\(.*\)".*/\1/p' android/app/build.gradle)
[ -f "$APK" ] || { echo "Kein APK – erst npm run apk" >&2; exit 1; }
[ "$APK" -nt android/app/build.gradle ] || { echo "APK ist älter als build.gradle – erst npm run apk" >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
printf '{ "versionCode": %s, "versionName": "%s" }\n' "$code" "$name" > "$tmp/version.json"
ssh "$DEPLOY_HOST" mkdir -p "$DEPLOY_BASE/data/app"
# erst das APK, dann die Version – so zeigt die App nie eine Version an, deren Datei noch fehlt
scp -q "$APK" "$ZIEL/rezepttabellen.apk"
scp -q "$tmp/version.json" "$ZIEL/version.json"
echo "Veröffentlicht: $name ($code)"
if [ -n "${SERVER_URL:-}" ]; then curl -s "$SERVER_URL/api/app"; echo; fi
