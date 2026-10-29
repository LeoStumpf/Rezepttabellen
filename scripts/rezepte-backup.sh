#!/usr/bin/env bash
# Spiegelt den lokalen Rezepte-Ordner in einen Backup-Ordner (ohne SQLite-Dateien und
# Cache – die werden neu aufgebaut). Werte aus ~/.config/rezepttabellen/ops.env:
#   REZEPTE_DIR   Rezepte-Ordner (Standard: ~/Rezepte)
#   BACKUP_DIR    Ziel
#   BACKUP_MOUNT  optional: muss eingehängt sein (z. B. ein Cloud-Laufwerk), sonst kein Backup
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/ops-env.sh
ops_brauche BACKUP_DIR
REZEPTE_DIR="${REZEPTE_DIR:-$HOME/Rezepte}"

if [ ! -d "$REZEPTE_DIR/rezepte" ]; then
  echo "Kein Rezepte-Ordner unter $REZEPTE_DIR – Abbruch." >&2
  exit 1
fi
# Ohne eingehängtes Laufwerk würde rsync in einen lokalen Ordner schreiben
if [ -n "${BACKUP_MOUNT:-}" ] && ! mountpoint -q "$BACKUP_MOUNT"; then
  echo "$BACKUP_MOUNT ist nicht eingehängt – Backup übersprungen." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
rsync -a --delete --exclude '*.sqlite*' --exclude '.cache/' "$REZEPTE_DIR/" "$BACKUP_DIR/"
echo "Backup nach $BACKUP_DIR: $(ls "$BACKUP_DIR/rezepte" | wc -l) Rezepte."
