# Architektur & Arbeitspakete — Prototyp → Produktivsystem

**Datum:** 2026-10-08
**Projekt:** Passkey-Login für das Kundenportal (Ersetzung Verimi)
**Grundlage:** `_keycloak_info/system-architektur.2.drawio.svg` (Ist), `docs/` (task-plan, constraints, risks, open-questions, pre-requirements), Prototyp-Code (Stand 2026-10-08, Smoke 13/13 + E2E grün)

---

## 1. Systemverständnis und Domänen (DDD)

Das Projekt ersetzt **eine** Komponente der Ist-Landschaft: den Login-Pfeil
`FE (Scrivito) → verimi (einloggen)` durch einen Passkey-Login über Keycloak.
SAP/SQL/Backup/EC2 (Bestand, vgv) bleiben unverändert.

| Domäne | Kern | Enthaltene Bounded Contexts / Bausteine |
|---|---|---|
| **Identity & Authentication** | Wer ist der Nutzer, wie weist er es nach? | Keycloak (Realm `passkey-prototyp`, WebAuthn/Passkey, Impersonation, Admin-API) · Verimi (echt bis 31.12.2026, danach weg) |
| **Portal / Zugang** | Migrationsablauf, Registrierungsfrage, geschützter Bereich | portal-mock → Portalkomponente (Session, Phasenschalter, Ereignisprotokoll, R-OPS-Admin-API, Erreichbarkeitstest) |
| **Bestand (vgv, außerhalb des Projekts)** | Stammdaten & Bestands-Login | FE Scrivito, bestehende API (EC2), SAP (Stammdaten), täglicher Sync → SQL (vgv), Backup |
| **Betrieb** | Betreiben des neuen Login-Systems | Deployment on-prem, Backup/Restore, Monitoring, Runbook (Verantwortung **dieses Projekts**, N-08) |
| **Migrationsprozesse** | Menschen bewegen | Kampagne (~80 k), Rückruf nach Erreichbarkeitstest, manueller Schalter F-12, Support |

**Phasenmodell (Fachlogik, änderbar über R-OPS-API):**
`phase1` = Verimi-Login + Registrierungsfrage · `phase2` = Passkey-Pflicht, Nicht-Migrierte gesperrt ·
Wechsel jederzeit bis 31.12.2026 möglich (AK-10), ab 01.01.2027 irreversibel.

---

## 2. Robustheit (gegen Ausfall und Fehlverhalten)

| Prinzip | Umsetzung im System | Nachweis/Referenz |
||---|---|
| **Ersetzbarkeit ohne Codezweig** | Mock ↔ echt nur über eine Konfigurationsvariable; kein `if (mock)` im Ablauf (T-30, AC-P7, ARCH-04) | T-30-Testprotokoll |
| **Rückfallebene** | Verimi bleibt bis 31.12.2026 aktiv; Phasenschalter kippt den Ablauf ohne Deployment (AK-10, C-01) | R-09: Phasen „sperrreif" kennzeichnen |
| **Bewusst kein HA** | Single-Instance ist die *Entscheidung*, nicht die Lücke: **ein** gemessener Restore (RTO ≤ 4 h) statt Redundanz (R-13, BR-13, PRD §7) | AK-11 / T-25 |
| **Append-only-Audit** | `event_log` (SQLite, WAL) protokolliert alle sicherheitsrelevanten Zustände, pseudonymisiert (`SHA-256(verifi_id)[0:16]`), keine Identitätsfelder/Geheimnisse | T-22, AC-3 |
| **Asynchrone Nicht-Login-Pfade** | Erreichbarkeitstest läuft nach 202-Antwort im Hintergrund (ARCH-07), blockiert nie den Login | T-24 |
| **Bekannte Schwachstellen (Prototyp-Code)** | In-Memory-Sessions (Neustart = Logout), SQLite-Ein-Schreiber, `running`-Sperre im Prozess — alles bei Einzelinstanz unkritisch, **muss aber in AP-4 dokumentiert entschieden werden** | T-03, OQ-06 |

---

## 3. Skalierung (reale Last, keine Angst vor zu wenig)

| Kennzahl | Wert | Konsequenz für die Architektur |
|---|---|---|
| Logins/Monat | 500 – 1.000 (C-03) | Kein Auto-Scaling, keine Cache-Schicht, keine zweite Instanz nötig (CO-05: kein Overengineering) |
| Registrierungen Migrationsphase | ~80.000 in 3 Monaten (~900/Tag, Annahme) | Der **einzige Lastspitzen-Punkt**: KC-Registrierungs-Flow + Impersonation muss ~900/Tag tragen — trivial, aber in T-33 auf 120.000/80.000 **Testdatenmengen** messen |
| Erreichbarkeitstest | iteriert alle KC-User (pageweise 200) | Läuft asynchron, Ergebnis-Entity statt Live-Antwort |
| Datenmengen | 120.000 User × 3 Felder | KC-Batch-Import/Anlage out-of-band planbar; SQLite-Event-Log wächst unbegrenzt → Retention (OQ-09) in AP-4 |

**Verdict Skalierung:** Die Architektur ist für die Last bereits richtig dimensioniert.
Der kritische Punkt ist nicht Throughput, sondern die **menschliche Migrationsquote** (AK-14/OQ-11).

---

## 4. Sicherheit (Angriffsvektoren ↔ Maßnahmen)

| Angriffsvektor | Status Prototyp | Maßnahme (Arbeitspaket) |
|---|---|---|
| **Dev-Secrets als Code-Fallback** | 🔴 `config.js` Z. 41/58: `dev-rops-token`, `verimi-mock-dev-secret` laufen **ohne** Env-Var still weiter | AP-3: Fail-Fast ohne gesetztes Secret; Secrets aus Vault/Deployment, kein Code-Fallback |
| **Keycloak im Dev-Modus** | 🔴 `start-dev`, H2-File-DB, `admin/admin`, Issuer `http://localhost:8082` | AP-3: Prod-Modus, echte DB, Admin-Kredentials, strikter Hostname |
| **Kein TLS / Secure Context** | 🔴 Nur `localhost` rettet WebAuthn; Issuer+Redirects hard auf localhost | AP-2: HTTPS überall (FE, Portal, KC); WebAuthn scheint produktiv **sonst garantiert** |
| **Token-Prüfung im geschützten Bereich** | 🟢 serverseitig (T-17) | AP-7: Security-Review AC-2 (T-32) |
| **User-Enumeration** | 🟢 generische Fehler + Antwortzeit-Toleranzband (T-21) | AP-7: T-33 legt AC-13-Toleranzband fest |
| **Brute-Force / Missbrauch** | 🟢 Rate-Limiting vorhanden (T-20) | AP-3: Produktivwerte festlegen |
| **R-OPS-Admin-API** | 🟡 statisches Bearer-Token | AP-3: starkes Token + nur über TLS, optional Netzbereich |
| **Audit/DSGVO** | 🟢 pseudonymisiert, keine Identitäten in portal.db | AP-0/AP-4: OQ-08 (AVV), OQ-09 (Aufbewahrung/Löschkonzept) |
| **Kein Recovery (R-04)** | bewusste Entscheidung (C-08) | Kein AP — akzeptiertes Risiko; Supportprozess trotzdem benennen (OQ-18 → AP-6) |
| **Alt-Schnittstelle Verimi** | 🟡 Verimi-Adapter bleibt bis Cutover | AP-8: 01.01.2027 regelhaft abschalten (FR-63, AC-8) |

---

## 5. C4

### Level 1 — Systemkontext (Zielbild)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Kunde (Desktop-Browser: Chrome/Edge/Safari/Firefox — mobil ausgeschlossen)│
└───────────────┬──────────────────────────────────────────────────────────┘
                │ HTTPS (Secure Context für WebAuthn!)
┌───────────────▼──────────────────┐          ┌─────────────────────────────┐
│ FE Scrivito + bestehende API     │          │ R-OPS (Betrieb)             │
│ (Bestand, EC2, vgv)              │          │ - Phasenschalter            │
│ bleibt unverändert               │          │ - Erreichbarkeitstest       │
└───────────────┬──────────────────┘          │ - Ereignisprotokoll         │
                │ Login-Pfeil wird umgehängt  └──────────────┬──────────────┘
                │ (AP-2)                                     │ TLS + starkes Token
┌───────────────▼──────────────────┐          ┌──────────────▼──────────────┐
│ Portalkomponente                 │◀────────▶│ Monitoring (AP-5)           │
│ Session · Phasen · Audit ·       │  3 Alarme│ KC-Ausfall / Login nicht    │
│ Admin-API                        │          │ erreichbar / Reg-Fehler     │
└───────────────┬──────────────────┘          └─────────────────────────────┘
                │ Admin-API (Impersonation)
┌───────────────▼──────────────────┐
│ Keycloak (Prod-Modus, AP-3)      │──── bis 31.12.2026 ────▶ Verimi (echt)
│ Passkey-Registrierung/-Login     │     parallel (AK-10)     [01.01.2027 Raus]
│ Identitätsdaten: Name, Vorname,  │
│ E-Mail (nur hier, C-07)          │
└───────────────┬──────────────────┘
                │ Backup / Restore mit gemessener RTO ≤ 4 h (AK-11)
┌───────────────▼──────────────────┐
│ Produktiv-DB (AP-4)              │
└──────────────────────────────────┘

Bestand (bleibt): SAP (Stammdaten, vgv) ─täglich─▶ SQL (vgv) ─▶ Backup
```

### Level 2 — Container (Prototyp → Ziel-Zuordnung)

```
                        ┌────────────────────────────────────────────┐
                        │ Prototyp-Container        Ziel-Zuordnung   │
┌───────────────────────┼────────────────────────────────────────────┤
│ portal-mock (Node)    │──▶ Portalkomponente (Produktiv-Deployment) │
│ verimi-mock (Node)    │──▶ ENTFÄLDT → echter Verimi-Adapter (T-30) │
│ keycloak (start-dev)  │──▶ Keycloak Prod-Modus + echte DB (AP-3)   │
│ shared/users.json     │──▶ ENTFÄLDT → Identitäten kommen vom       │
│                       │    Verimi-Endpoint (OQ-01) ins KC          │
│ data/portal.db (SQLite)│──▶ beibehalten bei Einzelinstanz,         │
│                       │    Backup+Retention (AP-4)                 │
│ config/phase-config…  │──▶ beibehalten (T-02-Entscheidung)         │
│ scripts/*.ps1         │──▶ Deployment-Paket/Installer (AP-5)       │
│ docker-compose.yml    │──▶ lieferbares On-Prem-Paket (AP-5)        │
└───────────────────────┴────────────────────────────────────────────┘
```

---

## 6. Arbeitspakete (Arbeitsaufteilung für den Produktivgang)

> Einordnung: Die Tasks T-01…T-34 (`docs/task-plan.md`) und die Abnahmekriterien
> AK-01…AK-14 (`docs/pre-requirements.md`) bestehen bereits. Die APs gruppieren sie
> zu lieferbaren Einheiten **und** ergänzen die im Prototyp-Code festgestellten Lücken
> (TLS, KC-Hardening, Dev-Secrets, Persistenz-Entscheidungen).

### AP-0 — Blockierende Entscheidungen (kein Code)
- **Ziel:** Alle externen Klärungen schließen, die andere Pakete blockieren.
- **Inhalt:**
  - OQ-11: Migrationsziel — 100 % vs. max. 67 % erreichbar (**Frist 2026-10-31**, blockiert AK-14/Definition of Done)
  - OQ-17: Dürfen Name/Vorname/E-Mail nach Registrierung geändert werden? (Identitätsmodell, **vor Gate A 2026-10-19**)
  - OQ-04 + OQ-06: Hosting-Plattform + Verfügbarkeitsziel (**2026-11-15**, blockiert AP-5/AK-11)
  - OQ-15: verbindliche Abschaltzusage/Rückfallrecht Verimi (**sofort** — ganze Planung hängt daran)
  - OQ-08: AVV/Datenschutzprüfung für Keycloak als Speicherort (**vor Produktivgang**)
- **Abhängigkeiten:** keine (Eingang aller anderen APs)
- **DoD:** Jede OQ statusfrei „geschlossen" oder mit Owner + Frist als akzeptiertes Risiko dokumentiert (`docs/open-questions.md`).

### AP-1 — Funktions-Core (Gate A)
- **Ziel:** Die vier Kernabläufe laufen und sind testprotokolliert.
- **Inhalt:** T-09…T-19 (Phasenschalter, Login-Redirect, Callback, Registrierungsfrage, Vorbefüllung, Passkey-Login, Token-Prüfung, Sperrlogik) + T-28 Gate-A-End-zu-End-Test.
- **Status:** im Wesentlichen **erledigt** (Stand 2026-10-08: `smoke.mjs` 13/13, E2E-Serie grün).
- **DoD:** Testprotokoll **AK-01…AK-05** mit Datum/Tester/Ergebnis — Zieltermin **2026-10-19**.

### AP-2 — Integration in die Ist-Landschaft (Mock → Echt)
- **Ziel:** Der Ablauf läuft unverändert gegen die reale Welt statt gegen Mocks.
- **Inhalt:**
  - Echter Verimi-Adapter: Konfigurations-Tausch ohne zweiten Codepfad (T-30, AC-P7, ARCH-04); Verimi-Endpoint-Spezifikation nutzt OQ-01 (eindeutige, nicht erratbare ID)
  - **Umhängen des Login-Pfeils:** Scrivito-FE von `→verimi` auf `→Portal/Keycloak` (Ist-Diagramm-Änderung)
  - **Hostname/TLS-Migration:** echte Domain statt `localhost` für KC-Issuer, Redirect-URIs, Frontend-URLs — WebAuthn benötigt HTTPS als Secure Context (im Prototyp rettet nur die localhost-Ausnahme)
  - Rückfallschalter auf Verimi bis 31.12.2026 (AK-10); OQ-13: Sessions am 31.12. klären
- **Abhängigkeiten:** AP-0 (OQ-15), AP-3 (Hostname/Issuer)
- **DoD:** T-30-Protokoll (Mock/echt verglichen, gleiche Variable), Redirects laufen gegen Produktivdomain, Netzwerkanalyse belegt Umschaltung.

### AP-3 — Sicherheit hart machen
- **Ziel:** Kein Dev-Zustand kann produktiv laufen.
- **Inhalt:**
  - **Keycloak-Hardening:** `start-dev` → Prod-Modus, H2-File → echte DB, `admin/admin` abschaffen, strikter Hostname, Admin-Konsole nur intern
  - **Secrets:** Fail-Fast, wenn `R_OPS_TOKEN`/`VERIMI_HMAC_SECRET`/KC-Admin fehlen — die hartkodierten Fallbacks (`portal-mock/src/config.js` Z. 41/58, `verimi-mock/src/server.js` Z. 35) raus; Secrets aus Deployment/Vault
  - R-OPS-API nur über TLS mit starkem Token
  - Produktivwerte für Rate-Limiting/Toleranzband (T-20/T-21)
  - Querschnittstests: Rollennegativtests (T-23), Audit-Vollständigkeit (T-22)
- **Abhängigkeiten:** AP-2 (Domain)
- **DoD:** Start ohne gesetzte Secrets **verweigert**; T-32-Security-Review-Checkliste ✓/✗ mit Fundstelle; AC-8: kein Regelabruf bei Verimi; PR-01 (keine Geheimnis-Einsicht), PR-03 (keine Backdoor).

### AP-4 — Datenhaltung & Persistenz (Entscheidungen + Umsetzung)
- **Ziel:** Alle Persistenzen sind produktiv definiert, gesichert, gelöscht.
- **Inhalt:**
  - **Sessions:** In-Memory-Store — bei Einzelinstanz + 15-min-TTL bewusst „Neustart = Logout" akzeptieren **oder** persistenten Store bauen (Entscheidung hängt an OQ-06); als ADR festhalten
  - `data/portal.db` (SQLite) beibehalten: lokal (kein Netzlaufwerk!), **ins Backup einbeziehen**, Retention/Löschkonzept (OQ-09), keine Identitätsfelder/Geheimnisse (Regeln aus `db.js`)
  - `config/phase-config.json`: bleibt Datei (T-02), aber Änderungsweg nur über authentifizierte R-OPS-API + Audit-Eintrag
  - Erwartung: unbounded Wachstum des Event-Logs → Aufbewahrungsregel
- **Abhängigkeiten:** AP-0 (OQ-06, OQ-09)
- **DoD:** Entscheidungen als ADR dokumentiert; Backup deckt **alle** Persistenzen (KC, portal.db, phase-config) ab.

### AP-5 — Betrieb aufsetzen (T-24…T-27)
- **Ziel:** Das Projekt betreibt das System nachvollziehbar selbst (N-08).
- **Inhalt:**
  - **Lieferform on-prem festlegen:** versionierte Container-Images/Installer aus `docker-compose.yml` (die H:-Bind-Mount-Problematik ist ein lokales Dev-Problem, die *Lieferform* wird in AP-5 zur Entscheidung)
  - **T-25 / AK-11:** Backup **und** Restore einmal vollständig durchgespielt, RTO gemessen (≤ 4 h), Wiederanlauf **bis Passkey-Login** nachgewiesen — nicht nur Datenspiegelung
  - **T-26:** Monitoring mit 3 Alarmregeln (KC-Ausfall sofort, Login nicht erreichbar, Registrierungsfehlerhäufung) + R-OPS-Kanal
  - **T-27:** Runbook mit 6 Kapiteln (Installation, Update, Backup, Monitoring, Wiederherstellung, Notbetrieb), **geübt**, Irreversibilität ab 01.01.2027 explizit
- **Abhängigkeiten:** AP-0 (OQ-04/OQ-06 blockieren AK-11), AP-3, AP-4
- **DoD:** Restore-Protokoll mit Zeitmessung (N-09); jeder Alarm künstlich ausgelöst; geübter Durchlauf (ungeübter Plan = nicht vorhanden, NFR-Ops-04).

### AP-6 — Migrationsbetrieb (Prozesse, kaum Software)
- **Ziel:** Die ~80.000 Nutzer bewegen sich — nicht der Code.
- **Inhalt:**
  - Kampagne Brief/E-Mail (mehrfach, 30 % Auslandsanteil), wöchentliche Migrationsquote (AK-14, Zielwert erst OQ-11)
  - **T-24 Erreichbarkeitstest + Rückruf:** Fehlfallliste exportieren; OQ-16 klären, wer aktiv kontaktiert (R-06/R-12: sonst fallen Probleme erst nach der Sperrung auf)
  - **F-12 manueller Schalter (Gruppe B):** OQ-03 (authentifizierte Session am Terminal), R-05 — „informiert per Brief" ist kein Prozess; Prozessverantwortlicher benennen, AK-09
  - Supportverantwortung OQ-18 (aktuell niemand benannt, R-12)
- **Abhängigkeiten:** AP-0 (OQ-11, OQ-16, OQ-18, OQ-02, OQ-03)
- **DoD:** AK-09 (Prozessdokument), AK-14 (Report), Fehlfallliste aus T-24 als Arbeitsgrundlage.

### AP-7 — Abnahme (Gate B, T-28…T-34)
- **Ziel:** Alle Produktivkriterien nachgewiesen oder als blockiert benannt.
- **Inhalt:**
  - T-29: Browsermatrix 8 Kombinationen + **dokumentierte** Mobil-Lücke (AC-P5/AC-P10)
  - T-31: WCAG 2.1 AA der vier Abläufe (`muss`)
  - T-33: Performance-Messung auf 120.000/80.000 Testdaten, `[V]`-Ziele bestätigen (Login ≤ 3 s, Registrierung ≤ 30 s, RTO ≤ 4 h)
  - T-32: Security-Review (geht mit AP-3 einher, Nachweis hier)
  - T-34: Finale Checkliste **AK-06…AK-14** je ✓/✗/blockiert mit Owner + Frist
- **Abhängigkeiten:** AP-2…AP-6, externe Blocker
- **DoD:** Kein AC auf „unklar"; keine stillen Scope-Zusätze.

### AP-8 — Cutover 01.01.2027
- **Ziel:** Sauberer, irreversibler Übergang.
- **Inhalt:**
  - 31.12.2026: letzter Tag mit Verimi-Rückfall (AK-10)
  - 01.01.2027: Verimi-Adapter/Mock regelhaft entfernen (FR-63 „als entfernbar markieren **und abschalten**"), AC-8/AC-13: kein Verimi-Abruf im Regelbetrieb mehr
  - Notbetriebs-Kapitel des Runbooks aktivieren (Irreversibilität)
  - Stichprobe AK-12 (Drei-Felder-Abgleich) final, AK-06 (kein Verimi-Login nötig)
- **Abhängigkeiten:** AP-7 (Gate B), AP-0 (OQ-15)
- **DoD:** Netzwerkanalyse zeigt null Regelabrufe bei Verimi; Login funktioniert ohne Verimi.

### Übersicht: Reihenfolge & Verantwortungsschwerpunkt

| # | AP | Typ | Früheststart | Harte Frist |
|---|---|---|---|---|
| 0 | Blockierende Entscheidungen | Klärung | sofort | 19.10./31.10./15.11. |
| 1 | Funktions-Core (Gate A) | Code | **läuft** | **19.10.2026** |
| 2 | Integration Ist-Landschaft | Code/Infra | 19.10. | 31.12. (Rückfall) |
| 3 | Sicherheit hart machen | Code/Infra | 19.10. | vor Gate B |
| 4 | Datenhaltung & Persistenz | Entscheidung+Code | 19.10. | mit AP-5 |
| 5 | Betrieb (T-24…27) | Infra/Prozess | nach OQ-04/06 (15.11.) | vor Produktivgang |
| 6 | Migrationsbetrieb | Prozess | 19.10. | 31.12.2026 |
| 7 | Abnahme (Gate B) | Nachweis | nach AP-2…6 | **31.10. intern / vor 31.12.** |
| 8 | Cutover | Betrieb | 31.12. | **01.01.2027** |

---

## 7. Verbesserungsvorschläge / offene Punkte

1. **AP-3 kleinste Hebel zuerst:** Fail-Fast für Dev-Secrets + KC-Prod-Modus sind wenige Zeilen/Konfigurationsänderungen mit der größten Risikoreduktion — vor dem Aufwand in AP-5.
2. **ADR nachtragen:** Für alle impliziten Prototyp-Entscheidungen (In-Memory-Sessions, SQLite statt Postgres, Single-Instance, Datei-basierte Phasenconfig) je eine kurze ADR — sonst tauchen sie in der Betriebsphase als „ungeplante Lücke" wieder auf (R-13-Empfehlung: explizit festhalten, dass **kein** HA gebaut wird).
3. **Ist-Diagramm aktualisieren:** `system-architektur.2.drawio.svg` um die Zielvariante ergänzen (Edge `FE → verimi` durch `FE → Portal → KC` ersetzen, Verimi-Edge gestrichelt bis 31.12.2026) — es ist die gemeinsame Kommunikationsgrundlage.
4. **F1 nur für die Docker-Dev-Umgebung:** Clone nach lokalem Laufwerk; für AP-5 sollte die Lieferform ohnehin „Image vom Registry ziehen" sein, nicht „vom Arbeitsplatzrechner bauen".
5. **Nicht vergessen (Scope-Guards):** kein HA/Auto-Scaling, kein Recovery-Credential, kein Mobile, kein Reporting in der Software — alle bewusste PRD/C-Entscheidungen; beim Aufbau neuer Tasks gegenprüfen, damit Scope-Creep sichtbar bleibt.
6. **Testzustand der Demo-User:** E2E-`beforeAll` setzt erika/bob/carol-Passkeys zurück — nach Testläufen vor Demo carol/erika manuell wiederherstellen (README-Hinweis vorhanden).

---

*Quellen: docs/constraints.md (C-01…C-08), docs/risks.md (R-01…R-13), docs/open-questions.md (OQ-01…OQ-18), docs/task-plan.md (T-01…T-34), docs/pre-requirements.md (AK-01…AK-14), Prototyp-Code (portal-mock, verimi-mock, keycloak, scripts), _keycloak_info/system-architektur.2.drawio.svg.*
