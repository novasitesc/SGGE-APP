# Backups de base de datos (sin plan Pro de Supabase)

Supabase Free no incluye backups automáticos gestionados. Este repo usa `pg_dump` local y un workflow de GitHub Actions.

## Requisitos

1. **`pg_dump` ≥ versión del servidor** (Supabase Cloud hoy ≈ **PostgreSQL 17**).
   - En Windows, el script busca primero `tools/pgsql-17/bin/pg_dump.exe`.
   - Si no está: descarga los binarios EDB (zip, sin instalador) o `winget install PostgreSQL.PostgreSQL.17`.
2. Variable **`SUPABASE_DB_URL`**: URI de conexión al puerto **`5432`**.
   - En local: **Direct connection** (`db.*.supabase.co:5432`).
   - En GitHub Actions (IPv4): **Session pooler** (`*.pooler.supabase.com:5432`).
   - Nunca uses el pooler de transacciones (`:6543`): `pg_dump` no funciona ahí.

En el Dashboard de Supabase: **Settings → Database → Connection string → URI**.

Ejemplos:

```text
# Directa (local)
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Session pooler (CI / IPv4)
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
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
2. Crea o edita el secret `SUPABASE_DB_URL`. El **valor** debe ser **solo la URI** (empieza por `postgresql://`), puerto **5432**. En Actions conviene el **Session pooler** (IPv4); la conexión directa de Supabase Free suele ser solo IPv6 y el runner no llega.
3. No pegues la línea de `.env.local`. Esto **falla** (`invalid connection option "SUPABASE_DB_URL"`):

   ```text
   SUPABASE_DB_URL=postgresql://postgres.xxxx:****@aws-0-....pooler.supabase.com:5432/postgres
   ```

   Esto es lo correcto:

   ```text
   postgresql://postgres.xxxx:****@aws-0-....pooler.supabase.com:5432/postgres
   ```

4. El workflow [`.github/workflows/db-backup.yml`](../.github/workflows/db-backup.yml):
   - Instala `pg_dump` 17 (Supabase Cloud) y corre **diario a las 06:00 UTC**
   - También se puede lanzar a mano: **Actions → Database backup → Run workflow**
   - Sube el dump como **artifact** (retención 30 días)

Si el log muestra `invalid connection option "SUPABASE_DB_URL"`, el secret incluye el nombre de la variable. Bórralo del valor o relanza tras este arreglo (el script recorta el prefijo).

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
