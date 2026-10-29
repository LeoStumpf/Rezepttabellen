#!/usr/bin/env bash
# Holt die offenen Foto-Aufträge vom Server in einen lokalen Arbeitsordner und
# legt Kontaktbögen an.   scripts/fotos/holen.sh <arbeitsordner>
# Werte aus ~/.config/rezepttabellen/ops.env: DEPLOY_HOST, DEPLOY_BASE.
set -euo pipefail
HIER="$(cd "$(dirname "$0")" && pwd)"
. "$HIER/../ops-env.sh"
ops_brauche DEPLOY_HOST DEPLOY_BASE
ZIEL="${1:?Arbeitsordner angeben}"
mkdir -p "$ZIEL/eingang" "$ZIEL/arbeit" "$ZIEL/pruef/rezepte"
rsync -a --exclude erledigt "$DEPLOY_HOST:$DEPLOY_BASE/data/foto-eingang/" "$ZIEL/eingang/"
python3 -I "$HIER/uebersicht.py" "$ZIEL/eingang" "$ZIEL/arbeit/bogen"
