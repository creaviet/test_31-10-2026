# Prototyp selbst starten — Kurzanleitung

Stand: 08.10.2026 — validiert auf diesem Rechner (Windows, Node v26.10.0, JDK 21, Docker 29.8.2).
Detaillierte Hintergründe: [`README.md`](README.md) · [`../_keycloak_info/system-architektur.md`](../_keycloak_info/system-architektur.md)

| Service | Port | Erreichbar unter |
|---|---|---|
| portal-mock | 8080 | http://localhost:8080 |
| verimi-mock | 8081 | http://localhost:8081/login |
| keycloak | 8082 | http://localhost:8082 (Admin: `/admin`, admin/admin) |

Test-User (alle mit Passwort `test`): `erika` (Passkey zurückgesetzt – eigenen registrieren),
`bob` („Nein"-Pfad), `carol` (Passkey gesetzt), `dan`, `frank`, `gerd`, `hans` (Demo-User).

---

## Variante A — NATIV (empfohlen, läuft von H:)

### 1. Starten

```powershell
cd H:\dev\test\test_31-10-2026\prototype
powershell -ExecutionPolicy Bypass -File scripts/start-native.ps1
```

Das Skript:
- prüft die Ports und überspringt schon laufende Services (kein Doppelstart),
- startet verimi-mock → portal-mock → Keycloak (KCI-Start dauert 20–40 s, wartet auf Erreichbarkeit),
- schreibt Logs nach `.runtime/logs/`.

### 2. Realm einspielen (idempotent — bei jedem Start unkritisch)

```powershell
cd keycloak
node setup-realm.mjs
cd ..
```

> **Wichtig:** Ohne diesen Schritt gibt es keinen Realm `passkey-prototyp` — Portal-Login schlägt fehl.
> `start-native.ps1` macht das automatisch **nicht**.

### 3. Start prüfen

```powershell
curl http://localhost:8080/                                                     # → HTTP 200
curl http://localhost:8081/login                                                # → HTTP 200
curl http://localhost:8082/realms/passkey-prototyp/.well-known/openid-configuration
curl -H "Authorization: Bearer dev-rops-token" http://localhost:8080/api/admin/phase   # → {"phase":"phase1",...}
```

### 4. Stoppen

```powershell
powershell -ExecutionPolicy Bypass -File scripts/stop-native.ps1            # verimi + portal
powershell -ExecutionPolicy Bypass -File scripts/stop-native.ps1 -Keycloak  # Keycloak ebenfalls beenden
```

### 5. Stop Verifizieren

```powershell
Get-NetTCPConnection -LocalPort 8080, 8081, 8082 -State Listen -ErrorAction SilentlyContinue 
# Bei einer leeren Ausgabe wurden alle 3 genannten Services erfolgreich gestoppt

```


---

## Variante B — DOCKER (Standort-Fix F1 offen, siehe „Offene Fixe")

Voraussetzung: Projekt liegt auf einem **lokalen** Laufwerk (nicht H:) — die Compose-Datei selbst ist startklar (F2/F3 erledigt).

### Klon nach lokalem Laufwerk + Start (einmalig)

```bash
# 1. Klon auf lokales Laufwerk (Bsp: C:\dev)
cd /c/dev
git clone <repo-url> test_31-10-2026
cd test_31-10-2026/prototype

# 2. Optional: Env-Datei (Defaults reichen für Dev)
cp .env.example .env

# 3. Kompletten Stack starten (inkl. Build + Realm-Setup automatisch)
docker compose up -d --build

# 4. Start prüfen (keycloak-setup muss Exit 0 / "Setup abgeschlossen" zeigen)
docker compose ps -a
docker compose logs keycloak-setup
```

Danach laufen alle drei Services über die gleichen Ports wie nativ (8080/8081/8082).

### Laufender Betrieb

```bash
docker compose ps -a              # Status
docker compose logs -f portal-mock
docker compose down               # stoppen (Daten bleiben in Volumes)
docker compose down -v            # stoppen + komplett zurücksetzen
```

### Wiederholter Start (nach dem Klon)

```bash
cd /c/dev/test_31-10-2026/prototype
docker compose up -d --build      # startet alles inkl. Abhängigkeiten
```

### Einzelne Services (optional — compose erzwingt die Reihenfolge bei `up` selbst)

```bash
docker compose up -d --build keycloak      # 1. Keycloak (auf Health warten)
docker compose run --rm keycloak-setup     # 2. Realm einspielen (idempotent)
docker compose up -d --build verimi-mock   # 3. parallel
docker compose up -d --build portal-mock   # 3. parallel
```

Der `keycloak-setup`-Service läuft bei `up` automatisch mit (hängt an `service_healthy`).

### Offene Fixe vor der Docker-Nutzung

Nur noch **F1 (Projektstandort)** ist offen — F2/F3 sind erledigt und verifiziert:

| # | Datei/Stelle | Fix | Status |
|---|---|---|---|
| F1 | Projektstandort | Klon/Kopie auf **lokales** Laufwerk (z. B. `C:\`) oder ins WSL-Dateisystem | **offen** — H: ist ein Netzlaufwerk (`\\serv904\…`); Docker Desktop teilt keine Netzlaufwerke, Bind-Mounts kommen leer an (`shared/users.json`, `config/phase-config.json` fehlen im Container → `MODULE_NOT_FOUND` bei `keycloak-setup`) |
| F2 | `docker-compose.yml` `--hostname` | `--hostname=localhost:8082` → `--hostname=http://localhost:8082` | **erledigt** (08.10.2026) — KC 26 akzeptiert nur Hostname ohne Port oder volle URL; Verifikation: Container healthy in ~21 s, Issuer = `http://localhost:8082/realms/…` |
| F3 | `docker-compose.yml` Healthcheck | Bash-`/dev/tcp` gegen **Port 9000** statt `curl` gegen 8082 | **erledigt** (08.10.2026) — zwei Fallstricke: KC-Image hat kein `curl`/`wget`, und `/health/ready` liegt am Management-Interface (9000), nicht am HTTP-Port (8082, dort 404) |

> F2/F3 sind im Compose-Stack E2E verifiziert (`docker compose up -d keycloak` → healthy). Die verbleibende Hürde ist ausschließlich F1: solange das Projekt auf H: liegt, scheitern `verimi-mock`, `portal-mock` und `keycloak-setup` an leeren Mounts. Nach dem Klon auf C: sollte `docker compose up -d --build` komplett durchlaufen.

---

## Phasenschalter (T-02)

```powershell
# Phase lesen
curl -H "Authorization: Bearer dev-rops-token" http://localhost:8080/api/admin/phase
# Phase setzen
curl -X PUT -H "Authorization: Bearer dev-rops-token" -H "Content-Type: application/json" `
  -d '{"phase":"phase2","reason":"Demo"}' http://localhost:8080/api/admin/phase
```

- `phase1` — Registrierungsphase (Verimi-Login → Passkey-Frage → Einrichtung; Nutzer mit Passkey
  kommen direkt in den geschützten Bereich — keine Passkey-Abfrage nach Verimi, Entscheidung 2026-10-08);
  zusätzlicher Einstieg „Passkey Login“ (direkter username-loser Passkey-Login)
- `phase2` — rein passkey-basiert (username-loses WebAuthn; ohne Passkey → 403 + Ereignis)

Wechselt sofort, `phase-config.json` wird pro Request neu gelesen.

---

## Troubleshooting

| Symptom | Ursache | Abhilfe |
|---|---|---|
| Port 8080/8081/8082 belegt | alter Prozess | `scripts/stop-native.ps1` bzw. Prozess auf Port beenden (`Get-NetTCPConnection -LocalPort 8082 -State Listen`) |
| Portal läuft, Login schlägt fehl | Realm fehlt | `cd keycloak; node setup-realm.mjs` |
| KC-Logs nötig | — | `.runtime/logs/kc.stdout.log`, `kc.stderr.log` |
| Alles auf Windows zurücksetzen | — | `docker compose down -v` (Docker) bzw. KC-Daten + `data/portal.db` löschen (nativ, `data/` ist Git-ignored) |
| `docker compose` schlägt fehl, Mounts leer | Projekt auf Netzlaufwerk | Offener Fix F1 — siehe oben |

**Hinweise:** Läuft ausschließlich auf localhost. Secrets (`R_OPS_TOKEN`, `VERIMI_HMAC_SECRET`, KC-Admin) sind Dev-Defaults — vor einem Produktivgang ersetzen.
