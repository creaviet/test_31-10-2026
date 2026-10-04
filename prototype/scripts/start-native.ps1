<#
  start-native.ps1 — Startet den Passkey-Prototyp NATIV (ohne Docker) unter Windows.

  Dienste:
    - verimi-mock  auf Port 8081 (Start-Process, node)
    - portal-mock  auf Port 8080 (Start-Process, node)
    - Keycloak 26.7.4 auf Port 8082 — automatisch aus <projekt>\prototype\.runtime\kc\
      (KC_HOME überschreibt den Suchpfad)

  Logs: <projekt>\prototype\.runtime\logs\{service}.{stdout,stderr}.log
  Geheimnisse nur über Umgebungsvariablen (keine im Skript).

  Aufruf:          powershell -ExecutionPolicy Bypass -File .\start-native.ps1
  Optional:        $env:KC_HOME vorher setzen, um Keycloak mitzustarten.
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

# --- 3. Keycloak (8082) — KC_HOME oder automatisch aus .runtime\kc -----------
$kcHome = $env:KC_HOME
if (-not $kcHome) {
  $autoKc = Join-Path $repoRoot '.runtime\kc\keycloak-26.7.4'
  if (Test-Path $autoKc) { $kcHome = $autoKc }
}
if ($kcHome) {
  if (-not (Test-Path (Join-Path $kcHome 'bin\kc.bat'))) {
    throw "KC_HOME zeigt nicht auf eine Keycloak-Distribution: $kcHome"
  }
  $kcProc = Get-NetTCPConnection -LocalPort 8082 -State Listen -ErrorAction SilentlyContinue
  if ($kcProc) {
    Write-Host "[start] Keycloak läuft bereits (Port 8082 belegt). Überspringe Start."
  } else {
    Write-Host '[start] Keycloak wird gestartet ... (Dauer: ~20–40 s, erster Start länger)'
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

Write-Host '[start] Fertig. Portal: http://localhost:8080 — Verimi: http://localhost:8081 — Keycloak: http://localhost:8082'