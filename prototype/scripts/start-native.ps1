<#
  start-native.ps1 — Startet den Passkey-Prototyp NATIV (ohne Docker) unter Windows.

  Dienste:
    - verimi-mock  auf Port 8081 (Start-Process, node)
    - portal-mock  auf Port 8080 (Start-Process, node)
    - Keycloak 26.7.4 auf Port 8082 — automatisch aus <projekt>\prototype\.runtime\kc\
      (KC_HOME überschreibt den Suchpfad)
    - PostgreSQL auf Port 5432 — Datenbank des Keycloak (ersetzt die H2-Dev-File-DB).
      Läuft auf 5432 bereits eine Datenbank, wird diese verwendet; sonst wird ein
      Docker-Container `prototype-postgres` gestartet (Docker Desktop nötig).

  Logs: <projekt>\prototype\.runtime\logs\{service}.{stdout,stderr}.log
  Geheimnisse nur über Umgebungsvariablen (keine im Skript).

  Aufruf:          powershell -ExecutionPolicy Bypass -File .\start-native.ps1
  Optional:        $env:KC_HOME vorher setzen, um Keycloak mitzustarten.
  DB-Zugang:       $env:KC_DB_NAME / $env:KC_DB_USER / $env:KC_DB_PASSWORD
#>
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Split-Path -Parent $scriptDir   # prototype/
$logDir    = Join-Path $repoRoot '.runtime\logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# Port-basierte Erkennung: Die CommandLine von `node src/server.js` enthält das
# WorkingDirectory NICHT (empirisch belegt) — ein Cmdline-Filter würde die
# Dienste weder finden noch doppelt starten erkennen. Der Listener auf dem
# Ziel-Port ist die verlässliche Quelle.
function Test-PortListening([int]$port) {
  return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Start-ServiceNode([string]$name, [string]$appDir, [hashtable]$envMap, [int]$port) {
  if (Test-PortListening $port) {
    Write-Host "[start] $name läuft bereits (Port $port belegt). Überspringe Start."
    return
  }
  # Env VOR Start-Process setzen (PowerShell 5.1: kein -Environment vorhanden)
  foreach ($k in $envMap.Keys) { Set-Item -Path "Env:$k" -Value $envMap[$k] }
  $out = Join-Path $logDir "$name.stdout.log"
  $err = Join-Path $logDir "$name.stderr.log"
  $p = Start-Process -FilePath 'node' -ArgumentList 'src/server.js' `
    -WorkingDirectory $appDir -RedirectStandardOutput $out -RedirectStandardError $err `
    -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 2
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$port/" -UseBasicParsing -TimeoutSec 5
    Write-Host "[start] $name PID $($p.Id) OK (HTTP $($r.StatusCode))"
  } catch {
    Write-Host "[start] $name PID $($p.Id) gestartet — Healthcheck auf :$port fehlgeschlagen: $($_.Exception.Message)"
  }
}

# --- 1. Verimi-Mock (8081) -------------------------------------------------
Start-ServiceNode 'verimi' (Join-Path $repoRoot 'verimi-mock') @{
  PORT = '8081'
  PUBLIC_BASE_URL = 'http://localhost:8081'
  PORTAL_CALLBACK_URL = 'http://localhost:8080/api/auth/verimi/callback'
} '8081'

# --- 2. Portal-Mock (8080) -------------------------------------------------
Start-ServiceNode 'portal' (Join-Path $repoRoot 'portal-mock') @{
  PORT = '8080'
  PUBLIC_BASE_URL = 'http://localhost:8080'
  SESSION_TTL_SECONDS = '900'
  # Keycloak + Admin-Client (Defaults in src/config.js passen; hier explizit)
  KEYCLOAK_URL = 'http://localhost:8082'
  KEYCLOAK_REALM = 'passkey-prototyp'
  KEYCLOAK_CLIENT_ID = 'portal-mock'
  KC_ADMIN_CLIENT_ID = 'portal-admin'
  KC_ADMIN_CLIENT_SECRET = 'dev-portal-admin-secret'
  KC_BOOTSTRAP_CLIENT_ID = 'portal-bootstrap'
  VERIMI_HMAC_SECRET = 'verimi-mock-dev-secret'
  R_OPS_TOKEN = 'dev-rops-token'
} '8080'

# --- 3. PostgreSQL (5432) — Datenbank des Keycloak (ersetzt H2-Dev-File) -----
# Keycloak braucht eine erreichbare PostgreSQL. Ist Port 5432 schon belegt, wird
# diese Instanz verwendet; sonst wird ein Docker-Container gestartet (Docker
# Desktop ist Projekt-Voraussetzung). Zugangsdaten via KC_DB_* überschreibbar.
$dbName = if ($env:KC_DB_NAME) { $env:KC_DB_NAME } else { 'keycloak' }
$dbUser = if ($env:KC_DB_USER) { $env:KC_DB_USER } else { 'keycloak' }
$dbPass = if ($env:KC_DB_PASSWORD) { $env:KC_DB_PASSWORD } else { 'keycloak' }
$pgContainer = 'prototype-postgres'

if (Test-PortListening 5432) {
  Write-Host '[start] PostgreSQL läuft bereits (Port 5432 belegt). Überspringe Start.'
} else {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'PostgreSQL ist auf Port 5432 nicht erreichbar und Docker wurde nicht gefunden. Bitte PostgreSQL starten oder Docker Desktop installieren.'
  }
  $existing = (& docker ps -a --filter "name=^/$pgContainer$" --format '{{.Names}}') 2>$null
  if ($existing -eq $pgContainer) {
    Write-Host "[start] PostgreSQL-Container $pgContainer wird gestartet ..."
    & docker start $pgContainer | Out-Null
  } else {
    Write-Host "[start] PostgreSQL-Container $pgContainer wird angelegt ..."
    & docker run -d --name $pgContainer `
      -e "POSTGRES_DB=$dbName" -e "POSTGRES_USER=$dbUser" -e "POSTGRES_PASSWORD=$dbPass" `
      -p 5432:5432 postgres:17-alpine | Out-Null
  }
  $pgReady = $false
  for ($i = 0; $i -lt 30; $i++) {
    & docker exec $pgContainer pg_isready -U $dbUser -d $dbName *> $null
    if ($LASTEXITCODE -eq 0) { $pgReady = $true; break }
    Start-Sleep -Seconds 2
  }
  if ($pgReady) { Write-Host '[start] PostgreSQL bereit.' }
  else { Write-Host '[start] WARNUNG: PostgreSQL meldet nach 60 s noch nicht „bereit". Keycloak könnte scheitern.' }
}

# --- 4. Keycloak (8082) — KC_HOME oder automatisch aus .runtime\kc -----------
$kcHome = $env:KC_HOME
if (-not $kcHome) {
  $autoKc = Join-Path $repoRoot '.runtime\kc\keycloak-26.7.4'
  if (Test-Path $autoKc) { $kcHome = $autoKc }
}
if ($kcHome) {
  if (-not (Test-Path (Join-Path $kcHome 'bin\kc.bat'))) {
    throw "KC_HOME zeigt nicht auf eine Keycloak-Distribution: $kcHome"
  }

  # Eigenes Login-Theme (Branding für Passkey-Registrierung/-Anmeldung) in die
  # Keycloak-Distribution kopieren. Keycloak liest Themes aus <KC_HOME>\themes;
  # .runtime ist gitignored → die Kopie entsteht bei jedem Start neu (idempotent).
  # try/catch: läuft Keycloak bereits, können Dateien gesperrt sein — das darf den
  # Start nicht abbrechen (ErrorActionPreference = 'Stop').
  $themeSrc = Join-Path $repoRoot 'keycloak\themes\kundenportal'
  $themeDst = Join-Path $kcHome 'themes\kundenportal'
  if (Test-Path $themeSrc) {
    try {
      if (Test-Path $themeDst) { Remove-Item -Recurse -Force $themeDst }
      New-Item -ItemType Directory -Force -Path $themeDst | Out-Null
      Copy-Item -Path (Join-Path $themeSrc '*') -Destination $themeDst -Recurse -Force
      Write-Host "[start] Login-Theme nach $themeDst kopiert."
    } catch {
      Write-Host "[start] WARNUNG: Login-Theme nicht kopiert (Keycloak aktiv/Datei gesperrt): $($_.Exception.Message)"
    }
  } else {
    Write-Host "[start] WARNUNG: Theme-Verzeichnis fehlt: $themeSrc (Keycloak nutzt das Standard-Theme)"
  }

  $kcProc = Get-NetTCPConnection -LocalPort 8082 -State Listen -ErrorAction SilentlyContinue
  if ($kcProc) {
    Write-Host "[start] Keycloak läuft bereits (Port 8082 belegt). Überspringe Start."
  } else {
    Write-Host '[start] Keycloak wird gestartet ... (Dauer: ~20–40 s, erster Start länger)'
    # Datenbank-Anbindung: PostgreSQL statt H2-Dev-File (Env VOR Start-Process).
    $env:KC_DB = 'postgres'
    $env:KC_DB_URL = "jdbc:postgresql://localhost:5432/$dbName"
    $env:KC_DB_USERNAME = $dbUser
    $env:KC_DB_PASSWORD = $dbPass
    $kc = Start-Process -FilePath (Join-Path $kcHome 'bin\kc.bat') `
      -ArgumentList 'start-dev --http-port=8082 --hostname=localhost' `
      -WorkingDirectory $kcHome -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput (Join-Path $logDir 'kc.stdout.log') `
      -RedirectStandardError  (Join-Path $logDir 'kc.stderr.log')
    Write-Host "[start] Keycloak Prozess gestartet (PID $($kc.Id))."
  }
  # Auf Erreichbarkeit warten (bis zu 90 s)
  for ($i = 0; $i -lt 45; $i++) {
    try {
      $null = Invoke-WebRequest -Uri 'http://localhost:8082/realms/master/.well-known/openid-configuration' -UseBasicParsing -TimeoutSec 3
      Write-Host '[start] Keycloak erreichbar.'
      break
    } catch {
      Start-Sleep -Seconds 2
    }
  }
}

Write-Host '[start] Fertig. Portal: http://localhost:8080 — Verimi: http://localhost:8081 — Keycloak: http://localhost:8082 — PostgreSQL: localhost:5432'