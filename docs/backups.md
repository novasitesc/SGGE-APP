# Backups de base de datos (sin plan Pro de Supabase)

Supabase Free no incluye backups automáticos gestionados. Este repo usa `pg_dump` local y un workflow de GitHub Actions.

## Requisitos

1. **`pg_dump` ≥ versión del servidor** (Supabase Cloud hoy ≈ **PostgreSQL 17**).
   - En Windows, el script busca primero `tools/pgsql-17/bin/pg_dump.exe`.
   - Si no está: descarga los binarios EDB (zip, sin instalador) o `winget install PostgreSQL.PostgreSQL.17`.
2. Variable **`SUPABASE_DB_URL`**: URI de conexión **directa** (puerto `5432`), no el pooler (`6543` / `pooler.supabase.com`).

En el Dashboard de Supabase: **Settings → Database → Connection string → URI → Direct connection**.

Ejemplo:

```text
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

Agrégala a `.env.local` (el script PowerShell la lee sola) o expórtala en la sesión.

## Backup local (Windows)

```powershell
# Una vez: define la URL (o ponla en .env.local)
$env:SUPABASE_DB_URL = 'postgresql://postgres:...@db.xxx.supabase.co:5432/postgres'

npm run db:backup
# o SQL legible:
npm run db:backup:sql
```

Salida en `backups/sgge-YYYYMMDDTHHMMSSZ.dump` (rotación: conserva 14 por defecto).

## Backup en CI (GitHub Actions)

1. Repo → **Settings → Secrets and variables → Actions**.
2. Crea el secret `SUPABASE_DB_URL` con la URI directa.
3. El workflow [`.github/workflows/db-backup.yml`](../.github/workflows/db-backup.yml):
   - Corre **diario a las 06:00 UTC**
   - También se puede lanzar a mano: **Actions → Database backup → Run workflow**
   - Sube el dump como **artifact** (retención 30 días)

Descarga: Actions → run del backup → Artifacts → `sgge-db-backup-*`.

## Restaurar

```bash
# Formato custom (.dump)
pg_restore --no-owner --no-acl -d "$SUPABASE_DB_URL" backups/sgge-XXXX.dump

# Formato SQL
psql "$SUPABASE_DB_URL" -f backups/sgge-XXXX.sql
```

Prueba el restore en un proyecto staging antes de tocarlo en producción.

## Qué no cubre este dump

| Elemento | Nota |
|----------|------|
| Esquema + datos de Postgres | Sí (tablas, RLS policies en el dump, etc.) |
| Archivos de **Storage** (PDFs, etc.) | No — hay que respaldar el bucket aparte |
| Migraciones del repo | Complementan el esquema; no sustituyen un dump con datos |

## Script bash (Linux/mac/CI)

```bash
export SUPABASE_DB_URL='postgresql://...'
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
./scripts/backup-db.sh --format sql --keep 7
```
