# Passkey-Prototyp — Kundenportal (Portal-Mock · Verimi-Mock · Keycloak)

Lauffähiger Prototyp für die Passkey-Anmeldung am Kundenportal:

- **Portal-Mock**  (`portal-mock/`) — Node/Express; Login-Einstieg, Registrierungs­frage,
  Passkey-Login, Phasenschalter, SQLite-Event-Log, serverseitige Token-Prüfung (jose)
- **Verimi-Mock** (`verimi-mock/`) — Node-Mock des Identitäts-Providers (HMAC-Signatur)
- **Keycloak 26.7.4** — Passkey-Registrierung (Variante A: Impersonation + Required
  Action `webauthn-register-passwordless` + SSO-Cookie) und Passkey-Login
  (`webauthn-authenticator-passwordless`, username-lose/discoverable)

| Komponente | Port | Erreichbar unter |
|---|---|---|
| Portal | 8080 | http://localhost:8080 |
| Verimi-Mock | 8081 | http://localhost:8081/login |
| Keycloak | 8082 | http://localhost:8082 (Admin-Konsole `/admin`, admin/admin) |
| KC-Account | – | http://localhost:8082/realms/passkey-prototyp/account |

## Phasen (T-02: Phasenschalter = Konfigurationsdatei)

`config/phase-config.json` wird bei **jeder** Anfrage neu gelesen — ein Wechsel wirkt sofort:

```json
{ "phase": "phase1", "changed_at": "…", "changed_by": "R-OPS", "reason": "…" }
```

- **`phase1`** — Registrierungsphase: Verimi-Login → Passkey-Frage → Einrichtung;
  Nutzer **mit** Passkey → direkt in den geschützten Bereich (Entscheidung 2026-10-08:
  KEINE erneute Passkey-Abfrage nach Verimi mehr; vorheriger Verify-Pfad zu AC-P3 entfernt).
  Zusätzlicher Einstieg „Passkey Login“: direkter username-loser Passkey-Login über Keycloak.
- **`phase2`** — rein passkey-basiert: username-loses WebAuthn ohne Verimi; Nutzer ohne
  Passkey werden gesperrt (403 + Ereignis, AC-3/BE-07).

Phasenwechsel per R-OPS-API (Token: `dev-rops-token`, Default):

```bash
# Phase lesen
curl -H "Authorization: Bearer dev-rops-token" http://localhost:8080/api/admin/phase
# Phase setzen
curl -X PUT -H "Authorization: Bearer dev-rops-token" -H "Content-Type: application/json" \
  -d '{"phase":"phase2","reason":"Demo"}' http://localhost:8080/api/admin/phase
```

## Start NATIV (Windows/PowerShell — ohne Docker)

Voraussetzungen: Node ≥ 22 (getestet mit v26.10.0), JDK 21. Die Keycloak-26.7.4-Distribution
liegt projektlokal unter `prototype\.runtime\kc\keycloak-26.7.4` (wird automatisch gefunden —
kein `KC_HOME` nötig; ein gesetztes `KC_HOME` gewinnt). Logs landen in
`prototype\.runtime\logs\` (alles unter `.runtime\` ist gitignored und liegt NICHT auf C:).

```powershell
# Alles starten (Keycloak wird automatisch aus .runtime\kc gefunden):
powershell -ExecutionPolicy Bypass -File scripts\start-native.ps1

# Realm einspielen/aktualisieren (idempotent; legt Flows, Clients, User an):
cd keycloak; node setup-realm.mjs
cd ..

# Alles beenden:
powershell -ExecutionPolicy Bypass -File scripts\stop-native.ps1
```

`start-native.ps1` startet Portal, Verimi und Keycloak mit präzisen Port-Filtern und
Healthchecks; `stop-native.ps1` beendet sie (Keycloak optional per `-Keycloak`).

Mit `-Keycloak` **stellt `stop-native.ps1` vor dem Stoppen automatisch den Passkey-Zustand
wieder her** (`scripts/reset-demo-state.mjs`, browserfrei über die Keycloak-Admin-API):
erika/bob ohne Passkey, carol mit Passkey. Ein vollständiger Stop bringt den Prototypen damit
immer in den Ausgangszustand — ein manueller Restore-Schritt entfällt:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\stop-native.ps1 -Keycloak
# -> [stop] Keycloak läuft — Passkey-Zustand wird zurückgestellt ...
# -> [reset] erika: ...  bob: ...  carol: ...  OK — Demo-Baseline wiederhergestellt.
# -> stoppt 8080, 8081, 8082
```

## Start per Docker Compose

> **Hinweis (dieser Rechner):** Der Docker-Desktop-Installer und das WSL-Setup
> (`install-wsl.ps1`) liegen projektlokal unter `prototype\.runtime\docker-installer\`
> (gitignored) — die Installation ist Sache der IT, siehe 9bdecfa/README-Verlauf.

```bash
cp .env.example .env      # Werte bei Bedarf anpassen
docker compose up -d --build
docker compose logs -f portal-mock
docker compose down       # Daten bleiben (Volumes)
docker compose down -v    # + komplette Rücksetzung (KC-Daten, Portal-DB)
```

Der `keycloak-setup`-Service läuft einmalig nach jedem `up` (idempotent) und spielt
Realm/Flows/Clients/Test-User ein. **Wichtig (URL-Splitting):** Server-seitig nutzt das
Portal `http://keycloak:8082` (`KEYCLOAK_URL`), browser-seitig `http://localhost:8082`
(`KEYCLOAK_PUBLIC_URL`); Keycloak läuft mit `--hostname localhost:8082`, damit der
Token-Issuer und alle Frontend-Redirects für den Browser stimmen (jose-Issuer-Check).

## Test-User (Verimi-Mock & Keycloak)

| User | Passwort | verifi_id | Passkey |
|---|---|---|---|
| erika | test | `4f7a2c91b6d34e8fa50c1d2e3b4a5c6d` | – (08.10. zurückgesetzt – eigene Registrierung im Portal) |
| bob | test | `9c1e5f7a2b4d6e8f0a1b2c3d4e5f6a7b` | – ("Nein"-Pfad) |
| carol | test | `2d4f6a8b0c1e3f5a7b9d0e2f4a6c8b1d` | ✔ (08.10. manuell gesetzt) |
| dan | test | `5b8e2d71c9a43f60e17d82b5c4a9f361` | – (Demo) |
| frank | test | `c3f6a95b18d24e70af36c1b8d5e2704a` | – (Demo, hieß zuerst `fan`) |
| gerd | test | `e7a14f82b6d93c05f82e6a1d4b7c9350` | – (Demo, hieß zuerst `gan`) |
| hans | test | `9d4c2a7e6b1845f3a0c9d5e27b6f81a4` | – (Demo) |

Im Keycloak lautet der Username = `verifi_id` (C-P.4). Passkeys werden beim Anlegen
per Required Action registriert (Variante A).

> **⚠️ Achtung – Test-Läufe verändern den Passkey-Zustand:**
> - `smoke.mjs` setzt erikas Passkey zurück (gewollt, siehe Tests).
> - Die E2E-Suite (`e2e.spec.js` `beforeAll`) setzt die Passkeys von **erika, bob UND carol**
>   zurück und registriert in T1 einen neuen für erika. Nach einem E2E-Lauf ist carols
>   manueller Passkey also gelöscht (in T5 erwartet der Test carol ohne Passkey) und erika
>   hat den Virtuellen-Authenticator-Passkey aus T1.
> - **Wiederherstellen:** einfach `stop-native.ps1 -Keycloak` (ruft automatisch
>   `scripts/reset-demo-state.mjs` auf) — oder vor dem Stop direkt `node scripts/reset-demo-state.mjs`.

## Tests

```bash
cd tests
npm install                        # einmalig (@playwright/test)
node smoke.mjs                     # 13 API-Smoke-Tests (setzt erikas Passkey selbst zurück)
npx playwright test --config=playwright.config.js   # E2E T1–T5 + T2b (Chrome, Seriell)
```

E2E-Abnahmetests (alle grün):

1. **T1** Registrierung: Verimi → Frage → Einrichtung → geschützter Bereich
2. **T2** Nach Logout erneuter Verimi-Login **mit Zugangsdaten** → direkt geschützter Bereich.
   Prüft zugleich den **OIDC-Logout**: Der Abmelde-Redirect geht über Keycloaks
   `end_session` **mit `id_token_hint`** (SSO-Revocation: kein stiller Re-Login mehr)
3. **T2b** „Passkey Login“-Button: username-loser Passkey-Login ohne Verimi (neuer Einstieg)
4. **T2c** Sicherheits-Fix: Back-Button nach Logout zeigt keinen geschützten Bereich (bfcache/History)
5. **T3** „Nein“-Pfad (AC-P2): geschützter Bereich ohne Passkey, ohne Fehlertext
6. **T4** Phase-2-Login: username-loses WebAuthn ohne Verimi (FR-16)
7. **T5** Sperr-Demo (AC-3, BE-07): Phase 2 + Nutzer ohne Passkey → 403 + Ereignis

Die E2E-Suite nutzt einen gemeinsamen Playwright-Context mit **einem** virtuellen
Authenticator (CTAP2, resident, user-verified) auf einer gemeinsamen Flow-Seite
(CDP-Sessions sind target-gebunden — eine Seite pro Suite).

## Keycloak-26.7-Besonderheiten (empirisch verifiziert)

- **Flow `browser-passkey`**: `auth-cookie` = `DISABLED`, `webauthn-authenticator-passwordless` = `REQUIRED`.
  Eine REQUIRED-Cookie-Execution ohne SSO-Session meldet nur „attempted“ und bricht in
  `DefaultAuthenticationFlow.processFlow` (Z. 297–305) die REQUIRED-Schleife ab → die
  WebAuthn-Execution wird nie erreicht → `UNKNOWN_USER`/„Invalid username or password“.
  Mit Cookie=DISABLED ist WebAuthn das einzige REQUIRED-Element: jeder Login läuft frisch
  als username-lose Passkey-Prüfung.
- **Registrierung (Variante A)**: Der Client `portal-bootstrap` ist auf den **Standard-**
  `browser`-Flow gebunden (`authenticationFlowBindingOverrides.browser`); nur so rendert
  die Pflicht-Aktion `webauthn-register-passwordless` für Nutzer ohne jede Credential
  (KC-Verhalten, `requiresUser()==false` vs. `DefaultAuthenticationFlow` Z. 484–491).
  Der Realm-Default-Browser-Flow bleibt der Standard-`browser` (sicher für Konsolen).
- **Token-„aud“ bei SSO-Resume**: `TokenManager.restrictRequestedAudience` schneidet
  `aud` auf die Ursprungs-Audience (z. B. `"account"`), `azp` bleibt korrekt
  (`issuedFor`). Das Portal verifiziert Signatur/iss/exp via jose und bindet den Client
  über **`azp`** + eine `aud`-Whitelist (inkl. des „account“-Artefakts als String/Array).
- **OIDC-Logout**: Der Client braucht eine registrierte **`Valid Post Logout Redirect URI`**.
  KC kennt dafür KEIN Top-Level-Feld, sondern das Client-Attribut
  **`post.logout.redirect.uris=`** (Mehrfachwerte mit `##` getrennt, exakter Treffpunkt —
  kein Wildcard); das Portal nutzt dafür `${PUBLIC_BASE_URL}/logout/verimi`. Ohne
  `id_token_hint` zeigt KC 26.2+ eine Logout-Bestätigungsseite — deshalb sendet das Portal
  das gespeicherte `id_token` der Session.

## Hinweise & Grenzen

- Alles läuft ausschließlich auf **localhost** (KC-Hostname, Redirect-URIs, Cookies).
- **Logout beendet alle Sessions** (Portal + Keycloak + Verimi).
  Keycloak wird bevorzugt per **OIDC RP-Initiated Logout** (`end_session_endpoint`
  mit `id_token_hint` + `post_logout_redirect_uri`) abgemeldet — das `id_token` der
  Session wird dafür gespeichert. `id_token_hint` ist zwingend: ohne ihn rendert
  Keycloak 26.2+ eine Logout-Bestätigungsseite und leitet nicht automatisch weiter.
  Für reine Verimi-Sessions (kein `id_token`) wird die Keycloak-Session ersatzweise
  serverseitig per Admin-API (`users/{id}/logout`) beendet. Danach Verimi-SSO via
  Redirect. Erst so ist ein erneuter Login wieder zugangsdaten-pflichtig.
- **Geschützter Bereich & Cache:** Das SPA-Dokument und alle `/api/*`-Antworten sind
  `Cache-Control: no-store`; der geschützte Bereich wird erst nach erfolgreicher
  Autorisierung (`/api/session`) per `<template>` erzeugt. Zusätzlich revalidiert das
  Frontend bei `pageshow`/bfcache erneut. So bleibt ein geschützter Zustand nicht über
  die Browser-History sichtbar.
- Secrets (`R_OPS_TOKEN`, `VERIMI_HMAC_SECRET`, KC-Admin) sind Entwicklungs-Defaults —
  vor einem Produktivgang ersetzen.
- Der Phasenschalter ist bewusst eine **Datei** (T-02); die R-OPS-API schreibt sie.
- Das Ereignis-Log liegt in `data/portal.db` (SQLite, append-only, pseudonymisiert).