#!/usr/bin/env bash
# Rollt den aktuellen Stand auf den eigenen Server aus: Code kopieren, dort bauen,
# Image-Tag in .env setzen, Container neu starten. Die Rezepte unter
# $DEPLOY_BASE/data werden nicht angefasst.
#
# Werte aus ~/.config/rezepttabellen/ops.env (siehe scripts/ops-env.sh):
#   DEPLOY_HOST     ssh-Ziel des Servers
#   DEPLOY_BASE     Ordner auf dem Server (src/, compose/, data/ darunter)
#   DEPLOY_COMPOSE  docker-compose.yml für den Server
#                   (Standard: ~/.config/rezepttabellen/docker-compose.yml)
# Auf dem Server muss $DEPLOY_BASE/compose/geheim.env mit APP_PASSWORT=… liegen.
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/ops-env.sh
ops_brauche DEPLOY_HOST DEPLOY_BASE
DEPLOY_COMPOSE="${DEPLOY_COMPOSE:-$HOME/.config/rezepttabellen/docker-compose.yml}"
[ -f "$DEPLOY_COMPOSE" ] || { echo "Fehlt: $DEPLOY_COMPOSE" >&2; exit 1; }

TAG="$(git rev-parse --short HEAD)"
if [ -n "$(git status --porcelain)" ]; then
  TAG="$TAG-dirty-$(date +%Y%m%d%H%M)"
  echo "Achtung: ungespeicherte Änderungen, Tag $TAG" >&2
fi

ssh "$DEPLOY_HOST" "test -d $DEPLOY_BASE/data && mkdir -p $DEPLOY_BASE/src $DEPLOY_BASE/compose"
if ! ssh "$DEPLOY_HOST" "test -s $DEPLOY_BASE/compose/geheim.env"; then
  echo "Fehlt: $DEPLOY_HOST:$DEPLOY_BASE/compose/geheim.env mit APP_PASSWORT=… (chmod 600)" >&2
  exit 1
fi
rsync -a --delete \
  --exclude node_modules --exclude /android --exclude /data --exclude /.git \
  --exclude dist --exclude '.env*.local' --exclude CLAUDE.local.md \
  ./ "$DEPLOY_HOST:$DEPLOY_BASE/src/"
scp -q "$DEPLOY_COMPOSE" "$DEPLOY_HOST:$DEPLOY_BASE/compose/docker-compose.yml"

ssh "$DEPLOY_HOST" bash -s -- "$TAG" "$DEPLOY_BASE" <<'REMOTE'
set -euo pipefail
TAG="$1"; BASE="$2"
docker build -t "rezepttabellen:$TAG" "$BASE/src"
echo "IMAGE_TAG=$TAG" > "$BASE/compose/.env"
cd "$BASE/compose" && docker compose up -d
REMOTE

for i in $(seq 1 30); do
  if ssh "$DEPLOY_HOST" "curl -fsS http://127.0.0.1:8080/api/status" 2>/dev/null; then
    echo; echo "Läuft: rezepttabellen:$TAG"; exit 0
  fi
  sleep 2
done
echo "Server antwortet nicht – Logs: ssh $DEPLOY_HOST docker logs rezepttabellen" >&2
exit 1
