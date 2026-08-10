# Backup lógico de Postgres (Supabase) con pg_dump.
#
# Requiere: pg_dump en PATH (PostgreSQL client tools).
# Variable: SUPABASE_DB_URL — URI directa (puerto 5432), NO el pooler (6543).
#   Dashboard → Settings → Database → URI (Direct connection)
#
# Uso (PowerShell):
#   $env:SUPABASE_DB_URL = 'postgresql://postgres:...@db.xxx.supabase.co:5432/postgres'
#   .\scripts\backup-db.ps1
#   .\scripts\backup-db.ps1 -Format sql -Keep 7
#
# También carga SUPABASE_DB_URL desde .env.local si existe y la variable no está definida.
#
# Restore (custom):
#   pg_restore --no-owner --no-acl -d $env:SUPABASE_DB_URL backups\sgge-XXXX.dump
# Restore (SQL):
#   psql $env:SUPABASE_DB_URL -f backups\sgge-XXXX.sql

[CmdletBinding()]
param(
  [ValidateSet("custom", "sql")]
  [string]$Format = "custom",

  [string]$OutDir = "",

  [int]$Keep = 14
)

$ErrorActionPreference = "Stop"

function Get-EnvLocalValue {
  param([string]$Key)
  $envPath = Join-Path (Split-Path $PSScriptRoot -Parent) ".env.local"
  if (-not (Test-Path $envPath)) { return $null }
  foreach ($line in Get-Content $envPath) {
    $t = $line.Trim()
    if ($t -eq "" -or $t.StartsWith("#")) { continue }
    $idx = $t.IndexOf("=")
    if ($idx -lt 1) { continue }
    $name = $t.Substring(0, $idx).Trim()
    if ($name -ne $Key) { continue }
    $val = $t.Substring($idx + 1).Trim()
    if (
      ($val.StartsWith('"') -and $val.EndsWith('"')) -or
      ($val.StartsWith("'") -and $val.EndsWith("'"))
    ) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    return $val
  }
  return $null
}

if (-not $env:SUPABASE_DB_URL) {
  $fromFile = Get-EnvLocalValue -Key "SUPABASE_DB_URL"
  if ($fromFile) { $env:SUPABASE_DB_URL = $fromFile }
}

if (-not $env:SUPABASE_DB_URL) {
  Write-Error "Define SUPABASE_DB_URL (URI directa :5432, no pooler) o agrégala a .env.local."
}

if ($env:SUPABASE_DB_URL -match ":6543" -or $env:SUPABASE_DB_URL -match "pooler\.supabase\.com") {
  Write-Error "Usa la conexión directa (db.*.supabase.co:5432), no el pooler."
}

function Resolve-PgDump {
  $repoRoot = Split-Path $PSScriptRoot -Parent
  $candidates = @()

  # Preferir binarios locales del repo (tools/pgsql-*/bin) — evita mismatch con PG 16 del PATH.
  Get-ChildItem (Join-Path $repoRoot "tools") -Directory -Filter "pgsql-*" -ErrorAction SilentlyContinue |
    ForEach-Object {
      $p = Join-Path $_.FullName "bin\pg_dump.exe"
      if (Test-Path $p) { $candidates += $p }
    }

  $cmd = Get-Command pg_dump.exe -ErrorAction SilentlyContinue
  if ($cmd) { $candidates += $cmd.Source }

  Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
    ForEach-Object {
      $p = Join-Path $_.FullName "bin\pg_dump.exe"
      if (Test-Path $p) { $candidates += $p }
    }

  $candidates = @($candidates | Select-Object -Unique)
  if ($candidates.Count -eq 0) { return $null }

  # Preferir la versión mayor (Supabase Cloud usa PG 17).
  $best = $null
  $bestMajor = -1
  foreach ($c in $candidates) {
    $verLine = & $c --version 2>$null
    if ($verLine -match '(\d+)\.') {
      $major = [int]$Matches[1]
      if ($major -gt $bestMajor) {
        $bestMajor = $major
        $best = $c
      }
    }
  }
  return $best
}

$pgDumpPath = Resolve-PgDump
if (-not $pgDumpPath) {
  Write-Error @"
pg_dump no encontrado (se necesita >= 17 para Supabase actual).
Opciones:
  1) Usar binarios locales: tools/pgsql-17 (ver docs/backups.md)
  2) winget install PostgreSQL.PostgreSQL.17  (acepta el UAC)
"@
}
Write-Host "Usando: $pgDumpPath"

if (-not $OutDir) {
  $OutDir = Join-Path (Split-Path $PSScriptRoot -Parent) "backups"
}

if ($env:SUPABASE_DB_URL -match "\[YOUR-PASSWORD\]") {
  Write-Error "Reemplaza [YOUR-PASSWORD] en SUPABASE_DB_URL con la contraseña real de la base."
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$basename = "sgge-$stamp"

# Supabase exige SSL. Usar --dbname=... evita que PowerShell parta la URI
# (el error típico es: too many command-line arguments / --no-owner).
$env:PGSSLMODE = "require"

if ($Format -eq "custom") {
  $outFile = Join-Path $OutDir "$basename.dump"
  $dumpFormat = "custom"
} else {
  $outFile = Join-Path $OutDir "$basename.sql"
  $dumpFormat = "plain"
}

$pgArgs = @(
  "--dbname=$($env:SUPABASE_DB_URL)",
  "--no-owner",
  "--no-acl",
  "--format=$dumpFormat",
  "--file=$outFile"
)

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $pgDumpPath @pgArgs
$dumpExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap

if ($dumpExit -ne 0) {
  Write-Error @"
pg_dump falló (exit $dumpExit).
Si dice 'server version mismatch', instala un cliente >= versión del servidor:
  winget install PostgreSQL.PostgreSQL.17
Luego vuelve a abrir la terminal (para refrescar PATH) y reintenta.
También revisa URI, SSL y percent-encoding del password.
"@
}

if (-not (Test-Path $outFile)) {
  Write-Error "No se generó el archivo de backup."
}

$size = (Get-Item $outFile).Length
if ($size -lt 1000) {
  Write-Error "El dump parece vacío o incompleto ($size bytes)."
}

Write-Host "OK: $outFile ($size bytes)"

if ($Keep -gt 0) {
  $files = Get-ChildItem -Path $OutDir -File |
    Where-Object { $_.Name -match '^sgge-.*\.(dump|sql)$' } |
    Sort-Object LastWriteTime -Descending

  $files | Select-Object -Skip $Keep | ForEach-Object {
    Remove-Item $_.FullName -Force
    Write-Host "Eliminado (rotación): $($_.FullName)"
  }
}
