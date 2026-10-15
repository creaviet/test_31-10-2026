# Changelog — Doku-Sync

Dieses Dokument hält Änderungen an der Projektdokumentation fest, die den
Doku-Stand an den tatsächlichen Code-Stand angleichen. Es werden **nur
Dokumente** geändert — kein Code.

---

## 2026-10-15 — Doku-Sync Gaps 1–8 (Doku ↔ Code)

**Anlass:** Fortsetzung der Gap-Analyse. Acht Lücken (im Vorgänger-Eintrag als
M1–M3 bezeichnet sowie fünf weitere) wurden an den Code-Stand angeglichen.
**Kein Code geändert** — der Prototyp war bereits korrekt, die Dokumente wurden
nachgezogen.

| # | Widerspruch (vorher) | Code/Wahrheit | Geänderte Dokumente |
|---|---|---|---|
| **1** | Logout: `ADR-002` „vorgeschlagen", `risks.md` R-14 „offen — nicht implementiert", `README.md`/`START.md` „leitet **unbedingt** über Verimi" | Portal-eigener, konditionaler, fehlertoleranter Logout (`public.js`: `handleLogout`, `verimiLogoutOrHome`, `session.viaVerimi`, `/logout/verimi`, `/logout/done`); E2E **T2d** grün | `ADR/ADR-002.md`, `docs/risks.md`, `prototype/README.md`, `prototype/START.md`, `architecture_10-08-2026.md` |
| **2** | `technical-spec.md` §7/§10: Session-Dauer **offen** (OQ-TS-4) | **15 Minuten** (`config.js` `sessionTtlMs`/`SESSION_TTL_SECONDS`, T-03) | `docs/technical-spec.md` (§7, §10) |
| **3** | `technical-spec.md` §6 API-03: `ceremony` = **WebAuthn-Parameter** | `ceremony: { mode, redirect_to }` = Weiterleitung in den Keycloak-Registrierungsflow (OIDC) | `docs/technical-spec.md` (§6) |
| **4** | `technical-spec.md` §6 listet nur API-01..API-08 | Zusätzliche Ablaufwehre: `/api/auth/prefill`, `/auth/decision/no`, `/api/auth/kc/start`, `/api/auth/kc/callback`, `/api/logout`, `/logout/verimi`, `/logout/done`, `/api/admin/events` | `docs/technical-spec.md` (neue §6-Untertabelle „Prototype-internal endpoints") |
| **5** | `technical-spec.md` Integration 2 ohne Clients/Impersonation | Drei KC-Clients (`portal-mock`, `portal-bootstrap`, `portal-admin`), Impersonation + SSO-Cookie-Relay, Registration best-effort | `docs/technical-spec.md` (Integration 2) |
| **6** | `technical-spec.md` §5: `failed_credentials` = Credential-IDs | Fehlfälle `{ reference, credential_id }`, im Prototyp `credential_id: null` | `docs/technical-spec.md` (§5) |
| **7** | `technical-spec.md` §6 API-04: `200 { display_name, … }` | `200 { display_name, phase, passkey }` | `docs/technical-spec.md` (§6) |
| **8** | `docs/README.md`: Index listete nur 2 von 14 Dokumenten | Vollständige Indexliste | `docs/README.md` |

**Belege:** `prototype/portal-mock/src/routes/public.js` (572–620),
`prototype/portal-mock/src/config.js` (50–51), `prototype/portal-mock/src/store.js`,
`prototype/portal-mock/src/routes/admin.js` (92, 130–132),
`prototype/portal-mock/src/db.js`, `prototype/tests/e2e.spec.js` (T2d),
`prototype/keycloak/setup-realm.mjs`, `docs/auth-sequence-diagrams.md`.

**Damit erledigt:** die im Eintrag vom 2026-10-13 als „nicht enthalten"
geführten M1–M3 (hier #4, #5, #3). **OQ-TS-4** ist inhaltlich geschlossen
(siehe #2). Offen bleibt nur **L1** (veraltete OQ-Status in
`docs/open-questions.md`).

---

## 2026-10-13 — Doku-Sync H1/H2/H3 (Doku ↔ Code)

**Anlass:** Gap-Analyse „Dokumentation vs. Code". Drei hochpriorisierte
Widersprüche (H1–H3) wurden in der Dokumentation korrigiert. Die Codebasis war
bereits korrekt; die Dokumente wurden an sie angeglichen. **Kein Code geändert.**

| # | Widerspruch (vorher) | Code/Wahrheit | Geänderte Dokumente |
|---|---|---|---|
| **H1** | „Keine Speicherung von Identitätsdaten im Portal-Backend (nur Keycloak)" — `technical-spec.md` §2/§5, `task-plan.md` T-06, `architecture_10-08-2026.md` | `portal_identity(reference, first_name, last_name, email, updated_at)` in `portal.db`; Schlüssel = `SHA-256(verifi_id)[0:16]` (ADR-001, akzeptiert 2026-10-09) | `docs/technical-spec.md`, `docs/task-plan.md` (T-06), `architecture_10-08-2026.md` |
| **H2** | „genau ein Login-Einstieg" — `technical-spec.md`, `prd.md` §6 | Zwei dokumentierte Einstiege: „Anmelden" (phasengesteuert) + „Passkey Login" (direkt); Entscheidung 2026-10-08 (`index.html`) | `docs/technical-spec.md`, `docs/prd.md` |
| **H3** | „Phasenkonfiguration (Speicherort: Portal-DB)" — `technical-spec.md` §5 | Phasenschalter liegt als atomar geschriebene Datei `config/phase-config.json` vor (T-02), **keine** DB-Tabelle | `docs/technical-spec.md`, `docs/task-plan.md` (T-06) |

**Konkrete Änderungen:**

- `docs/technical-spec.md`
  - Header-`Stand` auf 2026-10-13 gesetzt (Doku-Sync-Notiz).
  - H2: §1 Core capability, externe Abhängigkeit „Kundenportal", §2-Ownership-Zeile
    Portal-Frontend, §3 Screen „Login-Einstieg" (Purpose/Actions), Components-Zeile,
    User-actions-Tabelle → **zwei** Einstiege.
  - H1: §2 DB-Zeile und State-Ownership-Zeile, §5-Entity „Identität" (Keycloak =
    autoritativ), **neue §5-Entity `portal_identity`**, §5-Querschnittsregel
    „Keine Speicherung von Identitätsdaten …".
  - H3: §5-Entity „Phasenkonfiguration" → Speicherort Konfigurationsdatei; §2
    State-Ownership-Zeile Phasenschalter.
- `docs/task-plan.md` — **T-06** neu gefasst: Entities `event_log`,
  `reachability_result`, `portal_identity` (ADR-001); Phasenkonfiguration als
  Datei; keine `phase_config`-Tabelle; Do-not-change-Boundaries angepasst.
- `docs/prd.md` — §6 Feature-Scope: „genau ein Einstieg" → zwei dokumentierte
  Einstiege (H2).
- `architecture_10-08-2026.md` — Append-only-Audit-Zeile, Audit/DSGVO-Zeile
  (🟢→🟡 mit PII-Hinweis), AP-4-`portal.db`-Punkt an `portal_identity`/ADR-001
  angeglichen (H1).

**Grundlage/Belege:** `ADR/ADR-001.md`, `prototype/portal-mock/src/db.js`,
`prototype/portal-mock/src/phase.js`, `prototype/config/phase-config.json`,
`prototype/portal-mock/public/index.html`.

**Nicht in diesem Sync enthalten:** M1–M3 (undokumentierte Endpunkte,
Keycloak-Impersonation/Client-Setup, `ceremony`-Antwortform) und L1 (veraltete
OQ-Status). M4, L2, L3, L4 wurden am 2026-10-13 nachgezogen (siehe nächster
Eintrag).

---

## 2026-10-13 — Doku-Sync M4/L2/L3/L4 (Doku ↔ Code)

**Anlass:** Fortsetzung der Gap-Analyse. Die mittleren/kleineren
Dokumentationslücken wurden an den Code-Stand angeglichen. **Kein Code geändert.**

| # | Widerspruch (vorher) | Code/Wahrheit | Geänderte Dokumente |
|---|---|---|---|
| **M4** | „13 API-Smoke-Tests“ (`prototype/README.md`), „Smoke 13/13“ (`architecture_10-08-2026.md`); E2E-Liste ohne T2d | `tests/smoke.mjs` hat **12** `ok()`-Assertions; `tests/e2e.spec.js` enthält T1, T2, T2b, T2c, T2d, T3, T4, T5 | `prototype/README.md`, `architecture_10-08-2026.md` |
| **L2** | `architecture_10-08-2026.md`: „E-Mail (nur hier, C-07)“ im C4-Diagramm (Identität ausschließlich in Keycloak) | Keycloak ist autoritativ, `portal_identity` hält zusätzlich eine Kopie (ADR-001) | `architecture_10-08-2026.md` |
| **L3** | `technical-spec.md` §5: Feld `created_at` als eigenes Registrierungs-Zeitstempel-Feld | Prototyp führt kein eigenes `created_at`; Zeitpunkt = Keycloaks `createdTimestamp` + `event_log`, Passkey-Flag = KC-Attribut `passkey_registered` | `docs/technical-spec.md` |
| **L4** | Port-Defaults nicht dokumentiert: Mocks lauschen intern auf 3000, veröffentlicht 8081/8080; Root-Datei `exit` | Mocks intern `PORT=3000`; Docker `8081:3000`/`8080:3000`; nativ setzt `start-native.ps1` `PORT`=8081/8080 | `prototype/README.md`, `prototype/START.md` |

**Konkrete Änderungen:**

- `prototype/README.md` — Smoke-Anzahl 13 → 12; E2E-Aufruf-Kommentar und die
  Nummernliste um **T2d** ergänzt und neu nummeriert; Port-Hinweis
  (dienst-intern vs. veröffentlicht) ergänzt.
- `prototype/START.md` — Port-Hinweis ergänzt.
- `architecture_10-08-2026.md` — „Smoke 13/13“ → „Smoke 12/12“ (Kopf + AP-1-Status);
  C4-Diagramm „E-Mail (nur hier, C-07)“ → „E-Mail (KC autoritativ)“.
- `docs/technical-spec.md` — §5 `created_at` präzisiert (KC-`createdTimestamp` +
  `event_log`, KC-Attribut `passkey_registered`).

**Bereits im vorigen Eintrag erledigt (L2-Kern):** Die von L2 ursprünglich
zitierten Stellen („keine Identitäten in portal.db“, AP-4) wurden schon beim
H1-Sync korrigiert; hier nur noch die verbliebene Diagramm-Stelle.

**Belege:** `prototype/tests/smoke.mjs`, `prototype/tests/e2e.spec.js`,
`prototype/verimi-mock/src/server.js`, `prototype/scripts/start-native.ps1`,
`prototype/docker-compose.yml`, `prototype/portal-mock/src/routes/public.js`.

**Nicht geändert (kein Dokument):** die Datei `exit` im Repo-Wurzel (veralteter
erfasster `git log`) — kein Doku-Artefakt und daher außerhalb dieses Syncs.
