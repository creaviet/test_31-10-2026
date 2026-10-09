<#
  sync-to-runtime.ps1 — Gleicht das Repository von der QUELLE (z. B. H:, Netzlaufwerk)
  auf die lokale LAUFZEIT-KOPIE (z. B. C:) ab und baut dort den Docker-Stack neu.

  Hintergrund: Docker Desktop kann von Netzlaufwerken keine Bind-Mounts lesen —
  Container sehen die eingehängten Verzeichnisse leer (verimi-mock/Keycloak-Setup
  scheitern). Deshalb liegt die Quelle (editierbar) auf H:, der Docker-Stack läuft
  in einer lokalen Kopie auf C:. Dieses Skript hält die Kopie aktuell.

  Aufruf (BITTE AUS DER QUELLE, z. B. H:, ausführen — nicht aus der Kopie):
    powershell -ExecutionPolicy Bypass -File .\sync-to-runtime.ps1
    powershell -ExecutionPolicy Bypass -File .\sync-to-runtime.ps1 -SkipDocker
    powershell -ExecutionPolicy Bypass -File .\sync-to-runtime.ps1 -TargetRoot 'D:\work\test_31-10-2026'

  Nicht kopiert (pro Umgebung / generiert / Laufzeit):
    data/, node_modules/, .runtime/, .git/, test-results/, playwright-report/, *.db*
#>
[CmdletBinding()]
param(
  # Zielverzeichnis der lokalen Laufzeit-Kopie (muss vorhanden sein oder wird angelegt).
  [string]$TargetRoot = 'C:\dev\test\test_31-10-2026',
  # Nur synchronisieren, KEIN `docker compose up -d --build` ausführen.
  [switch]$SkipDocker
)

$ErrorActionPreference = 'Stop'
# PowerShell 7.3+: native Exitcodes/Stderr nicht als Exception behandeln — wir
# prüfen $LASTEXITCODE unten explizit (in Windows PowerShell 5.1 nicht vorhanden).
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

$scriptDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$prototypeDir = Split-Path -Parent $scriptDir       # ...\prototype
$sourceRoot   = Split-Path -Parent $prototypeDir    # Repo-Wurzel = Quelle

function Resolve-Full([string]$p) {
  return [System.IO.Path]::GetFullPath($p).TrimEnd('\')
}

$src = Resolve-Full $sourceRoot
$dst = Resolve-Full $TargetRoot

Write-Host "[sync] Quelle: $src"
Write-Host "[sync] Ziel:   $dst"

if ($src -ieq $dst) {
  throw 'Quelle und Ziel sind identisch. Bitte dieses Skript aus der QUELLE (z. B. H:) ausführen, nicht aus der Ziel-Kopie.'
}
if (-not (Test-Path -LiteralPath $src)) { throw "Quelle nicht gefunden: $src" }
if (-not (Test-Path -LiteralPath $dst)) {
  Write-Host '[sync] Ziel existiert nicht — wird angelegt.'
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
}

# --- Kopieren (robocopy) ------------------------------------------------------
$excludeDirs  = @('.runtime', 'node_modules', 'data', 'test-results', 'playwright-report', '.git')
$excludeFiles = @('*.db', '*.db-shm', '*.db-wal')

Write-Host '[sync] Kopiere Änderungen (robocopy) ...'
$roboArgs = @(
  $src, $dst, '/E', '/MT:8', '/R:1', '/W:1', '/NP', '/NFL', '/NDL', '/NJH',
  '/XD'
) + $excludeDirs + @('/XF') + $excludeFiles

& robocopy @roboArgs
$rc = $LASTEXITCODE
# robocopy: 0–7 = Erfolg (0 = nichts zu tun, 1 = Dateien kopiert, …), >= 8 = Fehler.
if ($rc -ge 8) { throw "robocopy meldete einen Fehler (Exitcode $rc)." }
Write-Host "[sync] Kopieren ok (robocopy-Exitcode $rc)."

if ($SkipDocker) {
  Write-Host '[sync] -SkipDocker gesetzt — kein Docker-Build.'
  exit 0
}

# --- Docker-Stack in der Kopie bauen -----------------------------------------
$composeDir = Join-Path $dst 'prototype'
if (-not (Test-Path -LiteralPath (Join-Path $composeDir 'docker-compose.yml'))) {
  throw "docker-compose.yml nicht gefunden unter: $composeDir"
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker-CLI nicht gefunden. Bitte Docker Desktop installieren und starten.'
}

Write-Host "[sync] docker compose up -d --build (in $composeDir) ..."
Push-Location $composeDir
try {
  & docker compose up -d --build
  if ($LASTEXITCODE -ne 0) {
    throw 'docker compose up fehlgeschlagen. Läuft Docker Desktop?'
  }
} finally {
  Pop-Location
}

Write-Host '[sync] Fertig. Container-Status:'
Push-Location $composeDir
try { & docker compose ps } finally { Pop-Location }
