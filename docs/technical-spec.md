# Technical Specification — Passkey-Login für das Kundenportal

Stand: 2026-10-06 · Quelle: `prd.md` (2026-10-06), `intent.md`, `requirements.md`
Status: **Entwurf** · Kein Implementierungscode — jede Entscheidung ist so formuliert, dass sie später als Aufgabe und Test umgesetzt wird.

> **Scope-Grenze (aus PRD §7):** Enthalten ist die Software dieses Projekts — Login-Einstieg, Phasenschalter, Passkey-Registrierung, Passkey-Login, Sperrlogik, Identitätsdaten, Betrieb. **Nicht enthalten:** manuelle Reaktivierung Gruppe B, Migrationsquote-Reporting, Hochverfügbarkeit, Recovery, Mobil, Support-Prozess.

---

## 1. System Overview

System name:
Passkey-Login für das Kundenportal (Arbeitsname, interne Bezeichnung „Passkey-Identity") — Ablösung des externen Identitätsanbieters Verimi.

Purpose:
Ersetzt den Verimi-Login des Kundenportals durch ein Passkey-basiertes Login (WebAuthn). Der Umschaltpunkt zwischen dem alten und dem neuen Weg ist extern konfigurierbar (Phasenschalter), damit der Stichtag 01.01.2027 verschoben werden kann, ohne die Software neu zu bauen.

Primary users:
- Endnutzer des Kundenportals (Gruppe A: migriert; Gruppe B: nicht migriert, DE/EU-Reisepass; Gruppe C: nicht migriert, Nicht-EU-Reisepass)
- Technischer Betrieb (R-OPS) — betreibt die Lösung, setzt den Phasenschalter, führt Backup/Restore und Erreichbarkeitstest durch
- Datenschutzverantwortlicher — nur als Prüfer, kein interagierender Nutzer

Core capabilities:
- Ein einziger Login-Einstieg, der je nach Phasenkonfiguration zu Verimi (Phase 1) oder Keycloak/Passkey (Phase 2) führt
- Nach Rückkehr von Verimi: Prüfung, ob ein Passkey registriert ist; Registrierungsfrage stellen (bei jedem Login, bis registriert)
- Passkey-Registrierung mit vorbefüllten Daten (Nachname, Vorname, E-Mail) — nur in authentifizierter Session
- Passkey-Login und Token-Prüfung im Portal
- Sperrung nicht migrierter Nutzer zum Stichtag, protokolliert als „mangels Passkey"
- Identitätsdaten: exakt drei Felder, verschlüsselt gespeichert
- Betrieb: Protokolle, Monitoring, Backup/Wiederherstellung, Erreichbarkeitstest (ohne Nutzermitwirkung)

System boundary:
This system includes Login-Einstieg und Phasensteuerung, Passkey-Registrierung und Passkey-Login, Prüfung der Passkey-Vorhandenseins nach Verimi-Rückkehr, Sperrlogik zum Stichtag, Speicherung der drei Identitätsfelder, Ereignis-Protokollierung, Betriebsfunktionen (Backup, Restore, Protokolle, Erreichbarkeitstest), Portal-Mock und Verimi-Mock für den Prototyp.
This system does not include manuelle Reaktivierung Gruppe B (organisatorischer Prozess des Auftraggebers), Migrationsquote-Reporting, E-Mail-/Briefkommunikation an Endnutzer, Recovery- oder Support-Zugangswiederherstellung, Hochverfügbarkeit/Redundanz, mobile Endgeräte, Support-Prozesse, Fachprozesse des Kundenportals (Entitlements, Stammdaten, Datenmigration).

External dependencies:
- **Keycloak (on-premise)** — Identity Provider für Passkeys/WebAuthn, Speicherort der Identitätsdaten und Credentials, Aussteller der Token (C-P.3, ARCH-03)
- **Verimi (Phase 1)** — authentifiziert im alten Weg und leitet zurück; im Prototyp durch den austauschbaren Verimi-Mock ersetzt (C-P.2, C-P.5)
- **Kundenportal (bestehend)** — ruft den Login-Einstieg auf, zeigt den geschützten Bereich; wird nur über den einen Einstieg angebunden (FR-03)
- **WebAuthn-Plattform der Desktop-Browser** — Windows/macOS mit Chrome, Edge, Safari, Firefox (NFR-Env-01)
- **Hosting-Plattform** — noch offen (OQ-04/OQ-06)
- **Aktiver Rückruf** — wird durch den Auftraggeber ausgeführt; die Software liefert nur die Fehlfallliste (FR-72, OQ-16)

Assumptions:
- Verimi wird zum 31.12.2026 abgeschaltet; die verbindliche Abschaltzusage steht noch aus (**OQ-15, überfällig** — gesamte Terminplanung hängt daran)
- Nutzung ausschließlich Deutsch, Desktop-only, WCAG 2.1 AA (NFR-UX-01/06, NFR-Env-02)
- Datenmengen: ca. 120.000 Identitätsdatensätze, bis zu 80.000 Passkeys (NFR-Perf-01)
- Unmittelbares Ziel bis 2026-10-31: Prototyp gemäß `intent.md` C-P.1..C-P.5 (Portal-Mock, Verimi-Mock, Keycloak+Passkey, Test-User, Ersetzbarkeitsnachweis)
- Kein Recoverypfad ist gewollt und rechtlich akzeptiert (BR-04, PR-01)
- Kommunikation mit Endnutzern (Brief/E-Mail) macht der Auftraggeber, nicht diese Software (BR-11)

---

## 2. Architecture Overview

**Architecture style:**
Einfache Web-Anwendung im Client-Server-Stil (kein Microservice-Aufbau, keine Message Queue, kein Event-Bus): ein Portal-Frontend, ein Portal-Backend, eine Datenbank, dazu zwei externe Identitätsdienste (Verimi bzw. Verimi-Mock, Keycloak). Genau ein zusätzlicher Konfigurationswert (Phasenschalter) steuert die Laufzeit-Entscheidung. Diese Form ist bewusst einfach gewählt, weil das Projekt bis 2026-10-31 liefern muss und nur ~500–1.000 Logins pro Monat bedient (CO-05, NFR-Perf-02).

**Main components, responsibility and what each must NOT own:**

```
                    Phase 1: Verimi-Weg              Phase 2: Passkey-Weg
                            │                                │
 [Endnutzer]                │                                │
      │  Klick Login        ▼                                ▼
      ├──────────►┌──────────────────┐            ┌──────────────────────┐
      │           │  Portal-Frontend │            │  Portal-Frontend     │
      │           │  + Portal-Backend│◄───────────│  + Portal-Backend    │
      │           │  (ein Login-     │  eine      │  (ein Login-         │
      │           │   Einstieg,      │  Konfig.)  │   Einstieg,          │
      │           │   Phasenschalter)│            │   Phasenschalter)    │
      │           └───────┬──────────┘            └──────────┬───────────┘
      │                   │ Redirect (Phase 1)               │ Redirect (Phase 2)
      │                   ▼                                  ▼
      │        ┌─────────────────────┐             ┌──────────────────────┐
      └───────►│ Verimi(-Mock)       │             │ Keycloak (on-prem)   │
               │ authentifiziert,    │             │ - Passkey / WebAuthn │
               │ leitet zurück       │             │ - Identitätsdaten    │
               └─────────────────────┘             │ - Token fürs Portal  │
                        │                          └──────────────────────┘
                        │ Nach Rückkehr (Phase 1):          │
                        └────► Portal prüft anhand der ─────┘
                               eindeutigen Verifi-Kennung,
                               ob ein Passkey registriert ist
```

| Komponente | Owns (zuständig) | Must not own (nicht zuständig) |
|---|---|---|
| **Portal-Frontend** | Ein Login-Einstieg, Registrierungsfrage und -formular, Anzeige der Fehlermeldungen, geschützter Bereich | Keine Entscheidung über die Phase, keine Speicherung von Identitätsdaten, keine Prüfung ob Passkey existiert |
| **Portal-Backend** | Phasenentscheidung (liest Konfiguration), Passkey-Vorhandensein-Prüfung anhand der Verifi-Kennung, Registrierungssteuerung (Session-Pflicht), Sperrlogik + Protokollierung, Token-Prüfung, Rate-Limiting | Kein Speicherort der Passkey-Geheimnisse, keine Benutzerverwaltung, keine Fachlogik des Portals |
| **Keycloak (on-prem)** | Passkey/WebAuthn, Identitätsdaten (drei Felder), Credential-Metadaten, Token-Ausgabe | Keine Phasenentscheidung, keine Sperrlogik des Portals, keine Portal-Fachdaten |
| **Verimi(-Mock)** | Authentifizierung im alten Weg und Rückleitung (Phase 1); Mock: vorabgefüllte User-DB, Weiterleitung auf konfigurierbare URL | Kein Passkey, keine Identitätsdaten für Phase 2 |
| **Konfiguration (Phasenschalter)** | Der Wert „phase1/phase2" mit Zeitstempel und Wer-hat-es-gesetzt-Protokoll | Nicht im Code hartkodiert, kein Datenbank-Objekt der Fachentität |
| **Datenbank des Portal-Backends** | Phasenkonfiguration, Ereignis-Protokolle, Erreichbarkeitstest-Ergebnisse | Keine Identitätsfelder (leben in Keycloak), keine Passkey-Geheimnisse |

**Data flow (vom Nutzerhandlung bis zur Antwort):**

*Phase 1 (bis 31.12.2026):*
1. Nutzer klickt „Anmelden" → Portal-Backend liest Phasenschalter → Redirect zu Verimi.
2. Verimi authentifiziert und leitet zurück mit einer eindeutigen, nicht erratbaren Verifi-Kennung.
3. Portal-Backend prüft anhand der Kennung, ob ein Passkey existiert.
4. Passkey vorhanden → geschützter Bereich. Kein Passkey → Registrierungsfrage („Ja" → vorbefülltes Formular → Passkey-Registrierung in derselben Sitzung; „Nein" → geschützter Bereich, Frage kommt beim nächsten Login wieder).

*Phase 2 (ab 01.01.2027):*
1. Nutzer klickt „Anmelden" → Portal-Backend liest Phasenschalter → Redirect zu Keycloak.
2. Keycloak prüft den Passkey und gibt ein Token zurück.
3. Portal-Backend prüft das Token serverseitig (Aussteller, Signatur, Laufzeit) → geschützter Bereich; ohne gültiges Token → Sperrung, protokolliert als „mangels Passkey".

**State ownership:**

| Zustand | Wo er liegt | Wer ändert ihn |
|---|---|---|
| Phasenschalter (phase1/phase2) | Konfiguration des Portal-Backends (Form siehe OQ-TS-2) | R-OPS über Admin-Schnittstelle, mit Protokoll |
| Identität (Nachname, Vorname, E-Mail) | Keycloak | Nur bei Registrierung; Änderbarkeit offen (OQ-17) |
| Passkey-Credential + Metadaten | Keycloak (Endgerät hält das Geheimnis) | Nur Nutzer-Registration, nie durch Support |
| Ereignis-Protokolle (Registrierung, Anmeldung, Sperrung, Betrieb) | Datenbank des Portal-Backends | Nur append-only durch das System |
| Erreichbarkeitstest-Ergebnisse | Datenbank des Portal-Backends | Nur durch R-OPS-Testlauf |

**Trade-offs (warum diese Design akzeptabel ist):**

- **Ein Identitätsdienst als Single Point of Failure:** Ohne Verimi/Keycloak kein Login für niemanden. Akzeptiert, weil Redundanz bewusst out of scope ist (BR-13, NFR-AV-02) — stattdessen wird die Restore-Zeit **gemessen** statt versprochen (NFR-AV-04).
- **On-premise Keycloak statt Managed-Dienst:** mehr Betriebsaufwand, aber kein Datenaustritt in Regionen ohne Rechtsgrundlage (NFR-DS-05) und Voraussetzung für den Ersetzbarkeitsnachweis (NFR-Ops-03).
- **Mock/echt austauschbar statt Parallelbetrieb:** der Verimi-Mock und das echte Verimi teilen dieselbe Konfigurationsvariable — dadurch wird „Ersetzbarkeit" im Prototyp nachweisbar (AC-P7), kostet aber eine zusätzliche Mock-Komponente bis 31.10.
- **Erfassung nur drei Felder:** Datenminimierung (CN-8/BR-02) statt bequemer Vollübernahme — Konsequenz: kein Sonderweg für Ausweisdaten (FR-14/CO-09).
- **Keine zweite Anmeldemöglichkeit (kein Recovery):** BR-03/PR-01 sind akzeptiertes Risiko und spart einen ganzen Baustein; Nutzer ohne Passkey werden zum Stichtag gesperrt.

**Testbar (ARCH):** T-ARCH-1: Phasenwert umschalten → nächster Login nutzt neuen Weg ohne Neustart. T-ARCH-2: Verimi-Mock gegen echte-Verimi-Konfiguration tauschen → Ablauf unverändert (AC-P7).

---

## 3. Frontend Requirements

### Screens and pages

**Screen: Login-Einstieg**
Purpose: Genau ein Einstiegspunkt, der je Phase umleitet.
Fields: keine Eingabefelder (kein Benutzername/Passwort-Feld — Passkey ersetzt das).
States:
- Loading: Zwischenklick bis Redirect „Einen Moment …", Button gesperrt gegen Doppelklick
- Error: Redirect fehlgeschlagen → verständliche Meldung, kein Fehlercode
- Permission denied: n/a (Einstieg ist öffentlich)
Actions: „Anmelden" klicken → Redirect (FR-03, API-01).

**Screen: Registrierungsfrage (Phase 1, kein Passkey vorhanden)**
Purpose: Nutzer entscheidet, ob er sich jetzt registriert.
Fields: keine Eingabe, nur zwei Aktionen: „Ja, registrieren" / „Nein" (FR-11).
States:
- Loading: während der Prüfung „Passkey vorhanden?" keine doppelte Frage
- Success „Nein": weiter in den geschützten Bereich, ohne Fehlermeldung und ohne Sperrhinweis (FR-12, AC-P2)
- Error: Prüfung technisch fehlgeschlagen → verständliche Meldung ohne Existenzauskunft
Wiederholung: Die Frage erscheint **bei jedem Login erneut**, bis der Nutzer registriert ist (NFR-UX-04, US-004).

**Screen: Registrierungsformular**
Purpose: Passkey für das eigene Konto anlegen — ohne Abtippen.
Fields:
- Nachname: vorbefüllt, Pflicht, readonly (FR-13)
- Vorname: vorbefüllt, Pflicht, readonly (FR-13)
- E-Mail: vorbefüllt, Pflicht, readonly (FR-13)
- Genau diese drei Felder — keine Kundennummer, keine Ausweisdaten (FR-14, AC-P4)
States:
- Loading: während der WebAuthn-Interaktion „Bitte schließen Sie die Anmeldung am Gerät ab"
- Success: Nutzer landet **in derselben Sitzung** im geschützten Bereich (FR-17, AC-P1)
- Error: verständliche Meldung ohne Existenzauskunft, Eingaben/Prozess nicht verloren (ERR-02)

**Screen: Passkey-Bestätigung (Browser-Systemdialog)**
Purpose: Plattform-eigene WebAuthn-Abfrage (PIN/Gesicht/Fingerabdruck).
Notes: Texte kommen vom Browser, nicht von uns; unsere Seite muss im Hintergrund verständlich bleiben (WCAG, FE-12). Kein zweiter, eigener Dialog.

**Screen: Geschützter Bereich**
Purpose: Nachweis, dass die Anmeldung funktioniert hat.
Fields: Personenanzeige (im Prototyp: Name) — keine Fachdaten (Prototyp-C-P.1).
States:
- Loading: nur während Token-Prüfung
- Permission denied: ohne gültiges Token → Abweisung (FR-32, AC-P6)
- Error: Identitätsdienst nicht erreichbar → Meldung nach ERR-07

**Screen: Sperrmeldung (ab Stichtag, ohne Passkey)**
Purpose: Nicht-Migrierte werden verständlich abgewiesen, berechtigte Personen (Gruppe B) erfahren, dass ein manueller Weg existiert — ohne technische Fachbegriffe (FR-45, BR-06).
States: Error (gesperrt), Logging der Ursache „mangels Passkey" (FR-44).

### Components

| Component | Einsatz | Regeln |
|---|---|---|
| Login-Button | Login-Einstieg | Genau einer im Portal, kein zweiter undokumentierter Weg (FR-03) |
| Frage-Karte „Ja/Nein" | Registrierungsfrage | Zwei Aktionen, gleiche Größe, kein vorausgewähltes „Ja" |
| Vorbefülltes Formular | Registrierungsformular | Drei readonly Felder, Submit-Button „Passkey anlegen" |
| Fehler-Banner | alle Screens | Text statt Fehlercode, nie Stacktrace, keine Existenzauskunft (NFR-Sec-04) |
| Sperr-Hinweis | Geschützter Bereich / Login | Klartext, kein „Verimi/Keycloak/WebAuthn"-Jargon (NFR-UX-01/05) |

### User actions

| Aktion | Ergebnis |
|---|---|
| „Anmelden" | Redirect je Phase (kein zweiter Pfad) |
| „Ja, registrieren" | Formular → WebAuthn-Registrierung → geschützter Bereich |
| „Nein" | Geschützter Bereich, Frage kommt beim nächsten Login wieder |
| Direktaufruf einer geschützten URL ohne Token | Abweisung (401) |

### Accessibility basics
- WCAG 2.1 AA für die vier betroffenen Abläufe: Login-Einstieg, Registrierungsfrage, Passkey-Bestätigung, Fehlermeldungen — Prüfbericht (NFR-UX-06, AC-17)
- Alle Abläufe per Tastatur bedienbar, sichtbarer Fokus, kontraststarke Texte (AC-17)
- Screenreader-Texte für Frage, Formularfelder und Fehlermeldungen; Labels an den Feldern (Nicht-Placeholder)
- Sprache ausschließlich Deutsch, ohne Fachjargon (NFR-UX-01, NFR-UX-05)

**Nicht im Frontend:** kein Recovery-Formular, kein Support-Kontaktformular, keine Zugangsdaten-Eingabe, keine Schalteroberfläche, keine mobile Variante (PRD §7, NFR-Env-02).

---

## 4. Backend Requirements

Plain-Language-Regeln — jede wird später Aufgabe + Test.

### Services

- **BE-01 Phasenschalter lesen:** Das Backend liest bei jedem Login-Anlauf die Phase aus der externen Konfiguration. Ein Wechsel wirkt ohne Neustart und ohne Codeänderung; eine Rückstellung vor dem Stichtag ist jederzeit möglich und verliert keine Daten. *Test: Konfiguration ändern → nächster Login nutzt neuen Weg; zurücksetzen → Verimi-Weg wieder da (FR-01/FR-02/FR-42, NFR-Ops-01).*
- **BE-12 Erreichbarkeitstest (eigener Job, nicht im Login-Pfad):** Prüft über serverseitig registrierte Credential-IDs, ob eine Anmeldung nachweisbar möglich ist — ohne Mitwirkung des Nutzers und ohne Kenntnis des Passkey-Geheimnisses; Ergebnis dokumentierbar, Fehlfälle exportierbar (FR-70..FR-73, AC-P9; *Verfahren offen, OQ-TS-3*).
- **BE-14 Betriebsfunktionen:** Backup auslösen, Wiederherstellung, Protokolle einsehen — nur für die Betriebsrolle (Permissions-SRS).

### Business rules

- **BE-02 Passkey-Vorhandensein:** Nach Verimi-Rückkehr wird anhand der **eindeutigen, nicht erratbaren Verifi-Kennung** geprüft, ob ein Passkey existiert. Bekannte Kennung → „vorhanden"; unbekannte → „kein Passkey" (FR-10).
- **BE-05 Ein Credential pro Nutzer:** Eine zweite, alternative Anmeldemöglichkeit wird technisch nicht angeboten (FR-33, BR-03).
- **BE-07 Sperrlogik:** Ab dem konfigurierten Phasenwechsel kein Zugang ohne gültigen, nicht abgelaufenen Token. Die Sperrung wird protokolliert und ist als **„mangels Passkey"** von anderen Sperrgründen unterscheidbar. *Test: nicht migrierter Testnutzer → gesperrt + Protokolleintrag (AC-3); migrierte Nutzer nicht gesperrt (AC-4) (FR-40, FR-44).*
- **BE-09 Protokollieren des Registrierungsereignisses:** Zeitpunkt + Ergebnis, auswertbar (FR-18/FR-19).
- **Kein Selbst-Recovery (BE-06):** kein E-Mail-Link, kein Einmalcode, keine Wiederherstellungsfunktion existiert (FR-34, BR-04, PR-01).

### Authorization rules

- **BE-03 Registrierung nur in eigener Session:** Ein Passkey lässt sich ausschließlich für das eigene, authentifizierte Konto registrieren. *Negativtest: Session eines anderen Nutzers → abgelehnt (FR-15, NFR-Sec-01, AC-P8).*
- **BE-08 Token-Prüfung serverseitig:** Abgelaufene, selbst erzeugte oder manipulierte Nachweise werden abgewiesen (FR-32, AC-P6).
- **BE-14 Rollen:** Alle Betriebsfunktionen nur für R-OPS; keine Rolle kann einen Zugang herstellen oder umgehen (SEC-03, AC-P11).

### Validation rules

- **BE-04 Datenminimierung:** Übernommen werden **exakt** Nachname, Vorname, E-Mail — alles andere weder übernommen noch gespeichert (FR-14, FR-60).
- **Eingaben** werden serverseitig geprüft (Pflicht, Format, Länge), bevor gespeichert oder weitergeleitet wird; Client-Prüfung ist nur Komfort.
- **BE-10 Rate-Limiting** je Identität und je Quelle für Authentifizierungs- und Registrierungsversuche (NFR-Sec-05).
- **BE-11 Kein Enumerieren:** Fehlermeldung **und Antwortzeit** verraten nicht, ob eine Identität existiert oder ein Passkey hinterlegt ist (NFR-Sec-04, AC-13).

### Jobs / background work

- **BE-12** Erreichbarkeitstest (siehe oben) — läuft als geplanter/manuell gestarteter Job, nie im Login-Pfad (ARCH-07).
- **BE-13 Kein Abruf beim ehemaligen Anbieter im Regelbetrieb:** Schnittstellen zu Verimi sind nach der Migration markiert und abschaltbar; kein stiller Datenabruf (FR-63, NFR-Ops-05, AC-8).
- **Monitoring/Alarme (FR-94):** Ausfall des Identitätsdatensystems, Nichterreichen der Anmeldung, Fehlerhäufungen bei der Registrierung.

### Integrations

- **Verimi(-Mock) (Phase 1):** siehe Abschnitt 6 „External Service Integration".
- **Keycloak:** Registrierungsaufruf nur mit gültiger Session und nur die drei Felder; Token-Rückkehr wird gegen Aussteller/Signatur/Laufzeit geprüft (API-04, API-05).

**Bewusst nicht im Backend:** Quotenberechnung/Wochenreport, Reaktivierungsfunktion für fremde Konten, E-Mail-Versand (alle PRD §7; BR-11).

---

## 5. Database Requirements

### Entity: Identität (Speicherort: Keycloak)
Purpose: Speichert die migrierte Identität — der einzige Identitätsspeicher nach dem Stichtag.
Fields:
- `verifi_id`: Pflicht, eindeutig, nicht erratbar — verknüpft Portal-Zugang und Passkey; vom Nutzer nicht veränderbar (FR-61, BR-08)
- `nachname`: Pflicht, Text
- `vorname`: Pflicht, Text
- `email`: Pflicht, Text, Formatprüfung
- `created_at`: Pflicht, Zeitstempel der Registrierung (FR-18)
Constraints: genau diese drei Identitätsfelder — keine Kundennummer, keine Ausweisdaten, keine Adesso-Verknüpfung (FR-60, CO-09); **kein** Feld für Passkey-Geheimnisse (das Geheimnis verlässt das Endgerät nie, NFR-Sec-02); Verschlüsselung im Ruhezustand (NFR-DS-02).
Retention/deletion: Lösch-/Aufbewahrungskonzept nach dem Stichtag ist offen (OQ-08/OQ-09), bis dahin kein Löschen ohne AVV-Entscheid (NFR-DS-03/04, AC-16).

### Entity: Passkey-Credential (Speicherort: Keycloak)
Purpose: Metadaten des registrierten Passkeys.
Fields:
- `credential_id`: Pflicht, eindeutig — Basis des Erreichbarkeitstests (FR-71)
- `verifi_id`: Pflicht, FK → Identität
- `registered_at`: Pflicht, Zeitstempel
- `status`: aktiv/zurückgerufen (für den aktiven Rückruf, FR-74)
Constraints: 1:1 zu Identität — genau ein Credential pro Endnutzer (BE-05, FR-33); **kein** Secret-Feld (DB-04).
Relationships: One identity has exactly one credential (in this version).

### Entity: Phasenkonfiguration (Speicherort: Portal-DB)
Purpose: Der Phasenschalter als prüfbarer Zustand.
Fields:
- `phase`: Pflicht, gültige Werte `phase1` | `phase2`
- `changed_at`: Pflicht, Zeitstempel
- `changed_by`: Pflicht, R-OPS-Kennung (Nachvollziehbarkeit, PR-07)
- `reason`: Pflicht, Text (Begründung der Umschaltung)
Constraints: genau ein aktiver Satz; jede Änderung wird zusätzlich ins Ereignis-Protokoll geschrieben (API-06).

### Entity: Ereignis-Protokoll (Speicherort: Portal-DB)
Purpose: Nachvollziehbarkeit sicherheitsrelevanter Ereignisse.
Fields:
- `event_id`: Pflicht, eindeutig
- `event_type`: Pflicht — `registration`, `login_success`, `login_failed`, `blocked`, `phase_change`, `ops_action` (FR-18/19, FR-44)
- `occurred_at`: Pflicht, Zeitstempel
- `result`: Pflicht, `success` | `failure`
- `reference`: pseudonymisierte Referenz — **keine** Klartext-Identitätsfelder, keine Geheimnisse (NFR-Sec-06, AC-14)
Relationships: keine fachliche Verknüpfung zu Identität (Zweckbindung, FR-65).
Retention: aufbewahrbar über einen zusammenhängenden Zeitraum (NFR-Sec-08); Dauer offen mit OQ-08/OQ-09.

### Entity: Erreichbarkeitstest-Ergebnis (Speicherort: Portal-DB)
Purpose: Arbeitsergebnis für den aktiven Rückruf (kein Personen-Report).
Fields:
- `run_id`: Pflicht, eindeutig
- `started_at` / `finished_at`: Pflicht
- `checked_count`: Pflicht, Zahl
- `failed_credentials`: Liste der Fehlfälle (Credential-IDs, exportierbar) (FR-72)
Constraints: nur R-OPS lesbar; enthält keine Passkey-Geheimnisse.

### Constraints, indexes, limits (quer)
- Index/Suchfelder: `verifi_id` (einzelner Lookup bei jedem Login — häufigster Zugriff), `credential_id` (Erreichbarkeitstest-Batch), `event_type + occurred_at` (Protokollauswertung).
- Keine Speicherung von Identitätsdaten im Portal-Backend (nur Keycloak) — Datenminimierung (NFR-DS-01).
- Skalierung: Auslegung für 120.000 Identitätsdatensätze und 80.000 Passkeys (DB-07, NFR-Perf-01).
- **Backup/Restore:** vor Produktivgang einmal vollständig durchgespielt, **gemessene** Wiederherstellungszeit dokumentiert, Wiederanlauf bis Anmeldefähigkeit geprüft (FR-91/FR-92, AC-6).
- **Keine Tabellen für:** Migrationsquote/Reporting, Reaktivierung, Entitlements, Kundennummern (PRD §7, CO-12, PR-06).

---

## 6. API Requirements

*(Schnittstellen zwischen Portal-Frontend, Portal-Backend, Verimi(-Mock) und Keycloak — Verhalten, keine Implementierung.)*

### Endpoints

| Nr. | Method and path | Purpose | Authentication | Request | Success response | Error responses | Validation |
|---|---|---|---|---|---|---|---|
| **API-01** | `GET /api/auth/start` | Phasenschalter lesen und Redirect-Ziel liefern | öffentlich | keine | `200 { phase, redirect_url }` | 500, 503 | — |
| **API-02** | `GET /api/auth/verimi/callback` | Rückkehr von Verimi: Verifi-Kennung prüfen, Passkey-Vorhandensein + ggf. Vorbefüllung liefern | Sitzung des gerade authentifizierten Nutzers | Query: `verifi_id` (string) | `200 { passkey_exists, prefill? : { first_name, last_name, email } }` | 400 (fehlend/ungültig — generische Meldung), 401, 429, 500 | `verifi_id` Pflicht, Format, nicht erratbar (FR-10) |
| **API-03** | `POST /api/registration` | Passkey-Registrierung anstoßen | **gültige, dem Nutzer zugeordnete authentifizierte Session** (FR-15) | `{ first_name, last_name, email }` | `201 Created { registration_id, ceremony }` | 400 (ungültige Felder), 401 (keine Session), 403 (fremde Session), 429, 500 | Genau drei Felder, Pflicht, E-Mail-Format, Längenlimits (FR-14, AC-P4) |
| **API-04** | `GET /api/session` | Daten des geschützten Bereichs | gültiges Token | keine | `200 { display_name, … }` | 401 (kein/ungültiges Token), 403 (gesperrt, FR-40), 500 | Token serverseitig prüfen: Aussteller, Signatur, Laufzeit (FR-32) |
| **API-05** | `GET /api/admin/phase` | Phasenschalter lesen | R-OPS | keine | `200 { phase, changed_at, changed_by, reason }` | 401, 403, 500 | — |
| **API-06** | `PUT /api/admin/phase` | Phasenschalter setzen (Umschalten/Rückstellung) | R-OPS | `{ phase, reason }` | `200 { phase, changed_at, changed_by }` | 400 (ungültiges `phase`), 401, 403, 409, 500 | `phase ∈ {phase1, phase2}`, `reason` Pflicht; Änderung wird protokolliert (FR-01/FR-42, PR-07) |
| **API-07** | `POST /api/admin/reachability-test` | Erreichbarkeitstest starten | R-OPS | keine | `202 Accepted { run_id }` | 401, 403, 409 (läuft bereits), 500 | Nur R-OPS (FR-71) |
| **API-08** | `GET /api/admin/reachability-results` | Ergebnis + exportierbare Fehlfallliste | R-OPS | keine | `200 { summary, failures[] }` | 401, 403, 404, 500 | Enthält keine Geheimnisse (FR-72) |

### API contract examples

```
POST /api/registration
Purpose: Passkey für das eigene Konto registrieren.
Auth: Gültige authentifizierte Session erforderlich (kein Wechsel der Identität möglich).

Request:
{
  "first_name": "Erika",
  "last_name": "Mustermann",
  "email": "erika@example.de"
}

Success response: 201 Created
{
  "registration_id": "…",
  "ceremony": { … }            ← WebAuthn-Parameter für den Browserdialog
}

Error responses:
  400  Ungültige/fehlende Felder        → Meldung ohne Existenzauskunft
  401  Keine Session                    → zurück zum Login-Einstieg
  403  Session gehört einem anderen Konto → abgelehnt (Sicherheitsereignis, wird protokolliert)
  429  Zu viele Versuche                → gleiche generische Meldung
  500  Technischer Fehler               → verständliche Meldung, Details nur im Log

Validation: genau die drei Felder; Nachname/Vorname Pflicht, max. 100 Zeichen;
email Pflicht, gültiges Format, max. 254 Zeichen; keine weiteren Felder akzeptiert.
```

```
PUT /api/admin/phase
Purpose: Phasenschalter umschalten oder zurückstellen.
Auth: R-OPS erforderlich; jede Änderung wird mit changed_by/reason protokolliert.

Request:
{ "phase": "phase2", "reason": "Stichtag erreicht" }

Success response: 200 OK
{ "phase": "phase2", "changed_at": "…", "changed_by": "…" }

Error responses: 400 (phase nicht in {phase1,phase2} oder reason fehlt),
401 (nicht angemeldet), 403 (Rolle fehlt), 500.
Validation: Enum-Prüfung, reason Pflicht, min. 5 Zeichen.
```

### External Service Integration

**Integration 1: Verimi (-Mock), Phase 1**

| Spec item | Definition |
|---|---|
| Provider | Verimi (echt) bzw. Verimi-Mock (Prototyp, C-P.2) |
| Purpose | Authentifizierung im alten Weg bis 31.12.2026 und Rückleitung ans Portal |
| Data sent | Redirect-Parameter für die Anmeldung (keine Identitätsdaten der neuen Lösung) |
| Data received | Rückkehr-Parameter mit **eindeutiger, nicht erratbarer Verifi-Kennung** (FR-10) |
| Failure behavior | Redirect/Verimi nicht erreichbar → verständliche Meldung „Bitte später versuchen", Log-Eintrag, kein Zugang (ERR-07); kein stilles Weiterleiten |
| Security rule | TLS (NFR-Sec-03), Kennung wird nie in Logs geschrieben, Mock und echt teilen dieselbe Konfigurationsvariable (ARCH-04) |

**Integration 2: Keycloak (on-premise)**

| Spec item | Definition |
|---|---|
| Provider | Keycloak on-prem (C-P.3) |
| Purpose | Passkey/WebAuthn, Identitätsspeicher, Token-Ausgabe |
| Data sent | Nur die drei Felder `first_name, last_name, email` bei der Registrierung (API-03/FR-14) |
| Data received | Registrierungs-/Login-Bestätigung und Token (Aussteller, Signatur, Laufzeit, Kennung) |
| Failure behavior | Keycloak nicht erreichbar → Portal-Login sofort nicht möglich (bewusst, NFR-AV-02) → verständliche Wartemeldung, Alarm an R-OPS (FR-94), keine Alternative anbieten |
| Security rule | Keine Secrets im Frontend, Token niemals im Klartext speichern oder in Logs schreiben; Kommunikation ausschließlich TLS (NFR-Sec-03); kein Recovery-Kanal (BR-03) |

**Keine API für:** Migrationsquote/Reporting, Reaktivierung am Schalter, E-Mail-Versand, Recovery (PRD §7).

---

## 7. Security Requirements

| Security area | Requirement (Nr. · Quelle · Test) |
|---|---|
| Authentication | Phase 2: Anmeldung nur mit gültigem, nicht abgelaufenem, korrekt signiertem Token von Keycloak — serverseitig geprüft (BE-08/FR-32, AC-2/AC-P6). Phase 1: Verimi-Rückkehr nur mit gültiger Verifi-Kennung (API-02). |
| Authorization | Registrierung nur in der eigenen authentifizierten Session — kein Passkey für ein fremdes Konto (SEC-01/FR-15, AC-P8). Betriebsfunktionen nur R-OPS. **Keine** Rolle darf Passkey-Geheimnisse einsehen — diese Zelle bleibt unbesetzbar (SEC-07, AC-P11). |
| Session rules | Registrierung nur in der laufenden Sitzung nach Verimi-Rückkehr; Session-Dauer offen (OQ-TS-4); nach der Registrierung kein erneuter Login (FR-17). |
| Input validation | Alle Eingaben serverseitig prüfen vor Speicherung/Weiterleitung; nur drei erlaubte Felder (BE-04, FR-14). |
| Sensitive data | Passkey-Geheimnisse verlassen das Endgerät nie; keine Export-, Kopier- oder Wiederherstellungsfunktion (SEC-02, NFR-Sec-02, PR-01). Identitätsdaten verschlüsselt im Ruhezustand (NFR-DS-02). |
| Secrets | Keine API-Keys/Tokens in Quelldateien, Konfigurationsbeispielen oder Logs; keine Klartext-Speicherung von Token (Security-Reminder der Spec-Vorlage, NFR-Sec-06). |
| Safe errors | Meldungen ohne Stacktrace, ohne Existenzauskunft, ohne technische Begriffe; identische Meldung ob Identität existiert oder nicht (SEC-04, AC-13, FR-35). |
| Rate limiting | Je Identität und je Quelle auf Authentifizierungs-/Registrierungsversuche (SEC-05, NFR-Sec-05). |
| No enumeration | Fehlermeldung **und Antwortzeit** konstant halten (BE-11, AC-13). |
| Logging | Sicherheitsrelevante Ereignisse nachvollziehbar über einen zusammenhängenden Zeitraum, ohne Klartext-Identitätsfelder und ohne Geheimnisse (SEC-06/SEC-08, AC-14). |
| No backdoor | Kein Support- oder Admin-Weg, einen Zugang herzustellen oder zu umgehen; kein Recovery, kein Einmalcode, keine SMS/E-Mail-Wiederherstellung (SEC-03/SEC-11, PR-03, BR-03/BR-04). |
| Transport | Gesamter Authentifizierungs- und Registrierungsverkehr über TLS (API-10, NFR-Sec-03). |
| Data protection | Zweckbindung und Datenminimierung (nur drei Felder, nur für Authentifizierung); keine Daten in Regionen ohne Rechtsgrundlage (SEC-10, NFR-DS-01/05). |
| Altanbieter | Kein Datenabruf beim ehemaligen Anbieter im Regelbetrieb; Alt-Schnittstellen abschaltbar (BE-13, FR-63, AC-8). |

---

## 8. Performance Requirements

**Expected users and data size:**
- Ca. 120.000 Identitätsdatensätze, bis zu 80.000 Passkeys (NFR-Perf-01)
- Dauerlast 500–1.000 Logins pro Monat; Migrations-Spitze ~900 Registrierungen pro Tag über 3 Monate, gleichmäßig verteilt — die Auslegung darf einfach bleiben (NFR-Perf-02, CO-05)
- Endnutzer-Gesamtzahl ≥ 120.000, davon bis zu 80.000 registrierungsfähig (Gruppe A)

**Response targets:**

| Ziel | Wert | Quelle |
|---|---|---|
| Antwortzeit Passkey-Login bis geschützte Seite | ≤ 3 s (95. Perzentil) *[V — bestätigen]* | NFR-Perf-03 |
| Registrierung, spürbare Verzögerung | ≤ 30 s *[V — bestätigen]* | NFR-Perf-04 |
| Identitätsprüfschritt nach Verimi-Anmeldung | ≤ 1 s zusätzlich *[V — bestätigen]* | NFR-Perf-05 |
| Wiederherstellungszeit (RTO) bis Anmeldefähigkeit | als Zahl **gemessen** dokumentiert; Vorschlag ≤ 4 h *[V — bestätigen]* | NFR-AV-04, AC-6 |

**Search targets:**
- Keine Such- oder Filterfunktion für Endnutzer (kein Listen-UI). Die einzige Suchpfade sind Punkt-Lookups: `verifi_id` beim Login und `credential_id`-Batch im Erreichbarkeitstest — beide indexiert (DB-Indexes), Einfachheit vor Optimierung.

**Known limits:**
- Ausfall des Identitätsdatensystems = sofortiger Ausfall des Portal-Logins für alle — bewusst akzeptiert, Priorisierung über Monitoring/Runbook (PERF-06, NFR-AV-02, BR-13).
- Desktop-Browser Chrome/Edge/Safari/Firefox auf Windows/macOS; abweichende Umgebungen sind nicht optimiert (NFR-Env-01).
- Mobil nicht ausgelegt und nicht als Fehler gewertet (NFR-Env-02, AC-P10).
- Kein Auto-Scaling, keine Redundanz, kein Failover (PRD §7).
- Dauerlast ist niedrig — Overengineering ausdrücklich vermieden (CO-05).

---

## 9. Error Handling Requirements

| Error situation | Expected behavior |
|---|---|
| Fehlgeschlagene Passkey-Anmeldung | Verständliche Meldung für den Nutzer **plus** auswertbarer Log-Eintrag; die Meldung verrät nicht, ob die Identität existiert (ERR-01, FR-35, AC-13) |
| Technischer Fehler bei der Registrierung | Verständliche Meldung ohne Existenzauskunft, Fehler im Log; Nutzer landet nicht in einem toten Zustand, Eingaben bleiben sichtbar (ERR-02, Flow 1 Failure path) |
| Nutzer sagt „Nein" zur Registrierung | **Kein Fehler:** ohne Fehlermeldung, ohne Sperrhinweis, mit vollständiger Portal-Funktion in den geschützten Bereich (ERR-03, AC-P2) |
| Nicht unterstützter Browser/Umgebung | Handlungsanweisung statt Fehlertext („Bitte nutzen Sie den Desktop mit Chrome, Edge, Safari oder Firefox") (ERR-04, NFR-Env-04) |
| Sperrung zum Stichtag | Verständliche Meldung; berechtigte Personen (Gruppe B) erfahren den manuellen Weg des Auftraggebers, ohne dass die Gruppe ohne Nachweismöglichkeit aktiv abgewiesen wird (ERR-05, FR-45, BR-06) |
| Protokollierung einer Sperrung | Für ein gesperrtes Konto ist nachvollziehbar, dass die Sperrung **mangels Passkey** erfolgte und nicht aus anderem Grund (ERR-06, FR-44, AC-3) |
| Verimi/Redirect nicht erreichbar (Phase 1) | Verständliche Wartemeldung, Log-Eintrag, kein Zugang, kein stiller Weiterleitungspfad (Integration 1) |
| Keycloak nicht erreichbar (Phase 2) | Portal-Login sofort nicht möglich — bewusster Ausfall; verständliche Wartemeldung, Alarm an R-OPS, **keine** Alternative/Backdoor anbieten (ERR-07, NFR-AV-02, FR-94) |
| Token ungültig/abgelaufen/manipuliert | 401, zurück zum Login-Einstieg, Log-Eintrag; niemals Zugang gewähren (API-04, FR-32) |
| Rate-Limit ausgelöst | Gleiche generische Meldung wie andere Fehler (kein Hinweis auf Sperrung/Existenz), Log-Eintrag (SEC-04/SEC-05) |
| Ungültige Eingabe im Registrierungsformular | 400, fehlendes/falsches Feld erklären, Eingaben auf dem Bildschirm behalten (Template-Regel, FR-14) |
| Notbetrieb | Runbook: wer entscheidet über einen Rückfall, wer informiert den Auftraggeber, in welcher Reihenfolge gehandelt wird — mit dem Hinweis, dass es nach dem 01.01.2027 **keinen** Rückfallweg gibt (ERR-08, FR-95, NFR-AV-06) |
| Monitoring-Alarm | Meldet: Ausfall des Identitätsdatensystems, Nichterreichen der Anmeldung, Fehlerhäufungen bei der Registrierung (ERR-09, FR-94) |
| Erreichbarkeitstest-Fehlfälle | Als Liste exportieren — Arbeitsgrundlage für den Rückruf durch den Auftraggeber, kein Personen-Report (ERR-10, FR-72, OQ-16) |

---

## 10. Open Questions

**Aus dem PRD übernommen (vollständig in `requirements.md` §6.3):**

| Question | Decision owner | Must be answered before implementation? | Frist |
|---|---|---|---|
| **OQ-15** Verbindliche Abschaltzusage des Anbieters — **überfällig**, gesamte Terminplanung hängt daran | Auftraggeber | **Ja** — ohne Datum ist der Phasenschalter-Projektsinn offen | sofort |
| **OQ-04 / OQ-06** Hosting-Plattform und Verfügbarkeitsziel | Auftraggeber | **Ja** — vor Betriebsauslegung (ARCH-06, PERF-07) | 2026-11-15 |
| **OQ-13** Fortbestehen bestehender Sitzungen zum Stichtag | Auftraggeber | **Ja** — bestimmt BE-07/Sperrlogik | 2026-11-15 |
| **OQ-17** Änderbarkeit von Nachname/Vorname/E-Mail nach Registrierung | Auftraggeber | **Ja** — bestimmt Datenmodell (DB-01, FR-62) | vor Prototypabschluss |
| **OQ-12** Zahl ausschließlich mobiler Nutzer (Grundgesamtheit) | Auftraggeber | Nein — betrifft Kommagnenkampagne, nicht den Prototyp | 2026-10-31 |
| **OQ-08 / OQ-09** AVV und Lösch-/Aufbewahrungskonzept | Datenschutz | Nein für den Prototyp, **Ja vor Produktivgang** (DB-09) | vor Produktivgang |
| **OQ-16** Verantwortlicher für Erreichbarkeitstest und Rückruf | Auftraggeber | Nein für den Prototyp, **Ja vor 2026-11-30** (BE-12, ERR-10) | 2026-11-30 |
| **OQ-18 / BR-14** Fachliche Supportverantwortung | Auftraggeber | Nein — betrifft UX-Texte der Fehlerpfade | 2026-11-30 |

**Neu aus dieser Spezifikation:**

| Question | Decision owner | Must be answered before implementation? | Frist |
|---|---|---|---|
| **OQ-TS-1** Woher stammt die **Verifi-Kennung** exakt (Claim/Parameter) und wie ist sichergestellt, dass sie nicht erratbar ist? API-02 ist der Sicherheitsanker (R-03) | Auftraggeber/Verimi-Anbieter | **Ja** — vor dem Prototypabschluss, sonst kein sicherer Zuordnungstest | vor Prototypabschluss |
| **OQ-TS-2** Wie wird der **Phasenschalter** technisch bereitgestellt — Konfigurationsdatei, Umgebungsvariable oder zentraler Endpunkt? (ARCH-02, BE-01, API-06) | Projektteam | **Ja** — bestimmt, wie „ohne Neustart" erfüllt wird | vor Prototypabschluss |
| **OQ-TS-3** Konkretes **Verfahren des Erreichbarkeitstests** (FR-71 `[V]`): Anmeldefähigkeit nachweisen ohne Nutzermitwirkung und ohne Geheimnis? | Projektteam | **Ja** — ohne Verfahren kein AC-P9/AC-9 | 2026-11-15 |
| **OQ-TS-4** **Session-Handling der Registrierung:** Wie lange lebt die authentifizierte Session (FR-15)? Timeout? | Projektteam | **Ja** — bestimmt BE-03/API-03 | vor Prototypabschluss |
| **OQ-TS-5** **Übergabeformat der Fehlfallliste** an den Auftraggeber (Kanal, Format), da Endnutzer-Kommunikation out-of-scope ist | Auftraggeber | Nein für den Prototyp, **Ja vor dem Stichtag** (ERR-10) | 2026-11-30 |
| **OQ-TS-6** **Zielwerte PERF-03/04/05 und RTO** (`[V]`) verbindlich bestätigen — sie sind Vorschläge, keine zugesagten Werte | Auftraggeber | **Ja vor Gate B** — sie werden zu Performance-Tests | vor Gate B |

---

**Traceability-Kurzfassung:** System Overview ↔ PRD §1/§7, C-P.1..C-P.5 · Architecture ↔ FR-01/02/42, NFR-Ops-01/03, BR-13 · Frontend ↔ FR-03/11/12/13/17/35, NFR-UX, NFR-Env, AC-17 · Backend ↔ FR-10/15/30..45/70..74, NFR-Sec · Database ↔ FR-60..65, NFR-DS, NFR-Perf-01 · API ↔ FR-01/10/14/32/42/63/71, NFR-Sec-03 · Security ↔ NFR-Sec-01..08, PR-01..03 · Performance ↔ NFR-Perf, NFR-AV · Error Handling ↔ FR-35/44/45/94/95, AC-3/13.
