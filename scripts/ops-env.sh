# Gemeinsame Betriebswerte für die Skripte in scripts/ (wird per `source` geladen).
# Die Werte stehen außerhalb des Repos in ~/.config/rezepttabellen/ops.env
# (oder der Datei in $OPS_ENV); schon gesetzte Umgebungsvariablen gewinnen.
OPS_ENV="${OPS_ENV:-$HOME/.config/rezepttabellen/ops.env}"
if [ -f "$OPS_ENV" ]; then
  while IFS='=' read -r key value; do
    case "$key" in ''|\#*) continue ;; esac
    [ -n "${!key:-}" ] || export "$key=$(eval "printf '%s' \"$value\"")"
  done < "$OPS_ENV"
fi

ops_brauche() {
  local fehlt=0
  for v in "$@"; do
    if [ -z "${!v:-}" ]; then echo "Fehlt: $v (in $OPS_ENV oder als Umgebungsvariable)" >&2; fehlt=1; fi
  done
  [ "$fehlt" = 0 ] || exit 1
}
