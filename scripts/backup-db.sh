#!/usr/bin/env bash
# Backup lógico de Postgres (Supabase) con pg_dump.
#
# Requiere: pg_dump en PATH (PostgreSQL client tools).
# Variable: SUPABASE_DB_URL — URI directa (puerto 5432), NO el pooler (6543).
#   Ejemplo Dashboard → Settings → Database → URI (Direct connection):
#   postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
#
# Uso:
#   export SUPABASE_DB_URL='postgresql://...'
#   ./scripts/backup-db.sh
#   ./scripts/backup-db.sh --format sql
#   ./scripts/backup-db.sh --out-dir /tmp/backups
#
# Restore (custom format):
#   pg_restore --no-owner --no-acl -d "$SUPABASE_DB_URL" backups/sgge-XXXX.dump
# Restore (plain SQL):
#   psql "$SUPABASE_DB_URL" -f backups/sgge-XXXX.sql

set -euo pipefail

FORMAT="custom"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
KEEP=14

usage() {
  cat <<'EOF'
Uso: backup-db.sh [--format custom|sql] [--out-dir DIR] [--keep N]

  --format   custom (pg_dump -Fc, default) o sql (texto)
  --out-dir  directorio de salida (default: ./backups)
  --keep     conservar solo los N backups más recientes (default: 14; 0 = no borrar)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --format)
      FORMAT="${2:-}"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="${2:-}"
      shift 2
      ;;
    --keep)
      KEEP="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Argumento desconocido: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Error: define SUPABASE_DB_URL (URI directa :5432, no pooler)." >&2
  exit 1
fi

if [[ "$SUPABASE_DB_URL" == *":6543"* ]] || [[ "$SUPABASE_DB_URL" == *"pooler.supabase.com"* ]]; then
  echo "Error: usa la conexión directa (db.*.supabase.co:5432), no el pooler." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Error: pg_dump no está en PATH. Instala PostgreSQL client tools." >&2
  exit 1
fi

if [[ "$FORMAT" != "custom" && "$FORMAT" != "sql" ]]; then
  echo "Error: --format debe ser custom o sql." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASENAME="sgge-${STAMP}"

export PGSSLMODE="${PGSSLMODE:-require}"

if [[ "$FORMAT" == "custom" ]]; then
  OUT_FILE="${OUT_DIR}/${BASENAME}.dump"
  DUMP_FORMAT="custom"
else
  OUT_FILE="${OUT_DIR}/${BASENAME}.sql"
  DUMP_FORMAT="plain"
fi

pg_dump \
  --dbname="$SUPABASE_DB_URL" \
  --no-owner \
  --no-acl \
  --format="$DUMP_FORMAT" \
  --file="$OUT_FILE"

SIZE="$(wc -c <"$OUT_FILE" | tr -d ' ')"
if [[ "$SIZE" -lt 1000 ]]; then
  echo "Error: el dump parece vacío o incompleto (${SIZE} bytes)." >&2
  exit 1
fi

echo "OK: ${OUT_FILE} (${SIZE} bytes)"

if [[ "$KEEP" =~ ^[0-9]+$ ]] && [[ "$KEEP" -gt 0 ]]; then
  # Conserva los N más recientes de este prefijo; borra el resto.
  mapfile -t OLD < <(
    ls -1t "${OUT_DIR}"/sgge-*.dump "${OUT_DIR}"/sgge-*.sql 2>/dev/null | tail -n +"$((KEEP + 1))" || true
  )
  for f in "${OLD[@]:-}"; do
    [[ -n "$f" ]] || continue
    rm -f "$f"
    echo "Eliminado (rotación): $f"
  done
fi
