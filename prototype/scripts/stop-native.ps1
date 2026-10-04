<#
  stop-native.ps1 — Stoppt die nativen Prototyp-Dienste (portal-mock, verimi-mock,
  optional Keycloak), die über start-native.ps1 gestartet wurden.

  Mit -Keycloak wird VOR dem Stoppen zusätzlich der Passkey-Zustand der Demo-User
  auf die Baseline zurückgestellt (scripts/reset-demo-state.mjs):
  erika/bob ohne Passkey, carol mit Passkey. So ist nach jedem vollständigen Stop
  der Ausgangszustand wiederhergestellt — ohne manuellen Restore-Schritt.

  Aufruf:   powershell -ExecutionPolicy Bypass -File .\stop-native.ps1 [-Keycloak]
  -Keycloak stoppt zusätzlich den nativen Keycloak-Prozess (java/kc.bat).
#>
param([switch]$Keycloak)
$ErrorActionPreference = 'SilentlyContinue'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Split-Path -Parent $scriptDir

function Test-PortListening([int]$port) {
  return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

# Port-basierte Erkennung (die CommandLine von `node src/server.js` enthält das
# WorkingDirectory NICHT — ein Cmdline-Filter verfehlt die Dienste; empirisch
# belegt). Gestoppt wird, wer auf dem Ziel-Port lauscht.
function Stop-PortListeners([int[]]$ports) {
  foreach ($port in $ports) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force
        Write-Host "[stop] Port $port (PID $($_.OwningProcess)) gestoppt."
      }
  }
}

# --- 0. Passkey-Zustand zurücksetzen (nur beim vollständigen Stop mit -Keycloak) ---
# Läuft VOR dem Stoppen, damit Keycloak (Port 8082) noch erreichbar ist.
if ($Keycloak) {
  if (Test-PortListening 8082) {
    $resetScript = Join-Path $scriptDir 'reset-demo-state.mjs'
    if ((Test-Path $resetScript) -and (Get-Command node -ErrorAction SilentlyContinue)) {
      Write-Host '[stop] Keycloak läuft — Passkey-Zustand wird zurückgestellt ...'
      & node $resetScript
      if ($LASTEXITCODE -ne 0) {
        Write-Host "[stop] WARNUNG: Passkey-Reset meldete Exit $LASTEXITCODE — Stop wird fortgesetzt."
      }
    }
    else {
      Write-Host '[stop] Passkey-Reset übersprungen (node oder reset-demo-state.mjs fehlt).'
    }
  }
  else {
    Write-Host '[stop] Keycloak nicht erreichbar — Passkey-Reset übersprungen.'
  }
}

# --- 1. Portal + Verimi stoppen ---------------------------------------------
Stop-PortListeners @(8080, 8081)

# --- 2. Keycloak stoppen (optional) -----------------------------------------
if ($Keycloak) {
  Stop-PortListeners @(8082)
}

Write-Host '[stop] Fertig.'
