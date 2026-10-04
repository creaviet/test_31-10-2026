# Task Plan — Passkey-Login für das Kundenportal

Stand: 2026-10-06 · Quelle: `technical-spec.md` (2026-10-06), `intent.md`, `requirements.md`
Status: **Entwurf zur Freigabe**

> **So liest man diesen Plan:** Die Aufgaben sind in 7 Phasen **streng in Reihenfolge** nummeriert (T-01 → T-34). Jede Aufgabe ist klein genug für einen einzelnen Review-Durchgang (ein Artefakt oder ein Testset). Jede Aufgabe hat die sechs Felder: Goal, Related requirement, Expected output, Acceptance check, Do-not-change boundaries, Dependencies.
>
> **Externe Blocker (keine Entwicklungsaufgaben, aber parallel hetzen):** OQ-15 (verbindliche Abschaltzusage — **überfällig**, gesamte Terminplanung hängt daran), OQ-17 (Änderbarkeit der drei Felder — vor Prototypabschluss), OQ-04/OQ-06 (Hosting/Verfügbarkeit — 2026-11-15), OQ-13 (Sitzungen zum Stichtag), OQ-16 (Verantwortlicher Erreichbarkeitstest).
>
> **Scope-Erinnerung (PRD §7):** kein Migrationsquote-Reporting, keine manuelle Reaktivierung, kein Recovery, kein HA/Redundanz, keine Mobile-Variante, kein E-Mail-Versand, Adesso-Login bleibt unberührt.

---

## Phase 0 — Klärungen, die vor dem ersten Codeblock nötig sind

### T-01 — Verifi-Kennung spezifizieren
- **Goal:** Festlegen, woher die eindeutige, nicht erratbare Verifi-Kennung in der Verimi-Rückkehr stammt und wie sie beschützt wird — sie ist der Sicherheitsanker der Zuordnung.
- **Related requirement:** technical-spec OQ-TS-1, API-02, BE-02 · FR-10, R-03, NFR-Sec-01
- **Expected output:** 1-seitige Spezifikation: Übertragungsweg (Claim/Parameter), Format, Begründung der Nicht-Erratbarkeit, Verhalten bei Fehlen/Änderung; bestätigt durch Verimi-Anbieter/Auftraggeber.
- **Acceptance check:** Unabhängiger Leser kann den Testfall „geänderte/fehlende Kennung → keine falsche Zuordnung, kein Zugang" daraus schreiben; Nicht-Erratbarkeit ist argumentiert, nicht behauptet.
- **Do-not-change-boundaries:** Keine Implementierung in dieser Aufgabe; keine zusätzlichen Datenfelder über die drei Identitätsfelder hinaus (FR-14); keine Zuordnung über E-Mail statt Kennung.
- **Dependencies:** keine

### T-02 — Mechanik des Phasenschalters festlegen
- **Goal:** Entscheiden, **wie** der Phasenschalter technisch bereitgestellt wird (Konfigurationsdatei, Umgebungsvariable oder zentraler Endpunkt) — es hängt daran, wie „Wechsel ohne Neustart" erfüllt wird.
- **Related requirement:** technical-spec OQ-TS-2, ARCH-02, BE-01, API-06 · FR-01, FR-42, NFR-Ops-01
- **Expected output:** Entscheidungsdokument mit: Speicherort des Werts, wer setzen darf (nur R-OPS), wie Änderungen protokolliert werden, wie eine Rückstellung vor dem Stichtag ohne Datenverlust funktioniert.
- **Acceptance check:** Die Antwort auf „Wie wirke ich eine Phase-Änderung ohne Codeänderung und ohne Neustart um?" ist ein konkreter Handgriff, kein Konzept; Zugriffsregel für Setzen ist benannt.
- **Do-not-change-boundaries:** Kein hartkodiertes Datum im Code (FR-42); kein zweiter, paralleler Schaltermechanismus; kein Setzen durch Endnutzer-Rollen.
- **Dependencies:** T-01 (nicht blockierend, parallel möglich)

### T-03 — Session-Handling der Registrierung festlegen
- **Goal:** Definieren, wie lange die „authentifizierte Session" lebt, in der ein Passkey registriert werden darf.
- **Related requirement:** technical-spec OQ-TS-4, BE-03, API-03 · FR-15, NFR-Sec-01
- **Expected output:** Regel: Session-Typ, Timeout, Zuordnung zum Identitätssubjekt, Verhalten bei Ablauf (Rücksprung wohin?).
- **Acceptance check:** Zwei Testfälle sind eindeutig ableitbar: „fremde Session → 403 + Sicherheitslog" und „abgelaufene Session → 401, zurück zum Login-Einstieg".
- **Do-not-change-boundaries:** Die Session darf keine zweite Authentifizierungsform begründen; kein Token wird im Klartext gespeichert oder protokolliert (NFR-Sec-06).
- **Dependencies:** keine

---

## Phase 1 — Fundament und Datenmodell (Prototyp-Grundgerüst)

### T-04 — Prototyp-Umgebung aufsetzen
- **Goal:** Eine laufende, vom Endprodukt klar unterscheidbare Entwicklungsumgebung für den Prototyp haben.
- **Related requirement:** technical-spec §1 Assumptions · NFR-Ops-02 · intent.md C-P.1..C-P.5, CO-02 (Prototyp 2026-10-19)
- **Expected output:** Startbare Umgebung mit Platzhaltern für Portal-Mock, Verimi-Mock und Keycloak; Kennzeichnung „Prototyp" sichtbar.
- **Acceptance check:** Umgebung startet mit einem Befehl; sie ist als Prototyp erkennbar; **keine produktiven Daten** sind darin (NFR-Ops-02).
- **Do-not-change-boundaries:** Kein Deployment in eine Produktivumgebung; bestehende Portal-/Adesso-Systeme werden nicht angefasst (FR-04, CO-12); keine realen Endnutzer-Daten.
- **Dependencies:** T-02 (Phasenschalter-Entscheidung wird gebraucht, aber Platzhalter reicht initially)

### T-05 — Keycloak mit Passkey und Identitätsmodell
- **Goal:** Keycloak on-premise läuft mit WebAuthn und dem exakten Identitätsdatenmodell der Spezifikation.
- **Related requirement:** technical-spec ARCH-03, DB-01 (Entity Identität), DB-02 · FR-60, FR-14, NFR-DS-02, CN-11, intent.md C-P.3
- **Expected output:** Keycloak-Realm mit aktiviertem Passkey-Verfahren; Felder: Nachname, Vorname, E-Mail plus Credential-Metadaten (credential_id, registered_at, status); Verschlüsselung im Ruhezustand aktiv; Test-User angelegt (C-P.4).
- **Acceptance check:** Ein Test-User registriert einen Passkey und meldet sich damit an; Schema-Inspektion zeigt **keine** Kundennummer, **keine** Ausweisdaten, **keine** Adesso-Verknüpfung, **kein** Secret-Feld (FR-14/FR-60, DB-04).
- **Do-not-change-boundaries:** Kein zweiter Credential-Typ (FR-33, BR-03); kein Recovery-Feature (FR-34, BR-04); keine weiteren Identitätsfelder (CN-8); keine Multi-Faktor-Konfiguration über Passkey hinaus.
- **Dependencies:** T-01 (Kennung muss dem Modell zugeordnet sein können)

### T-06 — Portal-Datenbank anlegen
- **Goal:** Die drei Portal-Entities der Spezifikation existieren mit Feldern, Constraints und Indexen.
- **Related requirement:** technical-spec DB-Entities Phasenkonfiguration, Ereignis-Protokoll, Erreichbarkeitstest-Ergebnis · FR-18, FR-19, FR-44, API-06
- **Expected output:** Schema für `phase_config` (phase, changed_at, changed_by, reason), `event_log` (append-only) und `reachability_result`; Index auf `event_type + occurred_at`.
- **Acceptance check:** Schema-Review gegen technical-spec §5 bestanden; Protokolleinträge enthalten keine Klartext-Identitätsfelder und keine Geheimnisse (DB-06, NFR-Sec-06); genau ein aktiver Phasensatz ist technisch erzwungen.
- **Do-not-change-boundaries:** **Keine Identitätsfelder (Name/Vorname/E-Mail) in der Portal-DB** — die leben ausschließlich in Keycloak (NFR-DS-01); keine Report-/Quotentabellen (Reporting out of scope); keine Reaktivierungs- oder Schaltertabellen (PRD §7).
- **Dependencies:** T-02, T-04

### T-07 — Portal-Mock: Login-Einstieg und geschützter Bereich
- **Goal:** Die beiden Screens des Prototyps existieren: der Login-Einstieg („Anmelden" + „Passkey Login", Entscheidung 2026-10-08) und ein geschützter Bereich, der den Namen anzeigt.
- **Related requirement:** technical-spec FE (Screens Login-Einstieg, Geschützter Bereich), FE-01, FE-08 · FR-03, FR-31, NFR-UX-03, intent.md C-P.1
- **Expected output:** Zwei Screens mit deutschen, jargonfreien Texten; Tastaturbedienbarkeit; Fehler-Banner-Platzhalter.
- **Acceptance check:** Suche im gesamten Portal nach weiteren Login-Möglichkeiten: genau die beiden dokumentierten Einstiege „Anmelden" und „Passkey Login" (FR-01/FR-03); Direktaufruf des geschützten Bereichs ohne Token → Abweisung (AC-P6-Voraussetzung); kein Wort „WebAuthn/Schlüssel/Kryptografie" im UI (NFR-UX-05).
- **Do-not-change-boundaries:** Keine weiteren Screens (kein Recovery-, kein Support-Formular, keine Schalteroberfläche); keine Mobilvariante (NFR-Env-02); keine Fachdaten im geschützten Bereich (nur Name, C-P.1); Adesso-Login unberührt.
- **Dependencies:** T-04

### T-08 — Verimi-Mock bauen
- **Goal:** Ein Mock, der das alte Verimi-Login nachstellt: vorbefüllte User-DB, Weiterleitung auf eine konfigurierbare URL.
- **Related requirement:** technical-spec Integration 1, ARCH-04 · intent.md C-P.2, C-P.5, NFR-Ops-03
- **Expected output:** Mock mit Test-User-Liste (Benutzername/Passwort), Redirect auf eine **eine** Konfigurationsvariable, die später auch das echte Verimi belegt; Rückkehr mit Verifi-Kennung gemäß T-01.
- **Acceptance check:** Login im Mock leitet auf die konfigurierte URL weiter und bringt eine gültige Kennung zurück; die Konfigurationsvariable ist dieselbe, die für das echte Verimi gesetzt würde (Voraussetzung für AC-P7/T-30).
- **Do-not-change-boundaries:** Keine echten Nutzerdaten; kein zweiter Redirect-Pfad; der Mock baut **keinen** Passkey-Fall nach (Passkey ist Keycloak-Sache); keine Registrierung im Mock (C-P.2).
- **Dependencies:** T-01, T-04

---

## Phase 2 — Ablauf Phase 1 (Migrationsphase: Verimi + Registrierungsfrage)

### T-09 — Phasenschalter implementieren
- **Goal:** Der Portal-Backend-Dienst liest die Phase zur Laufzeit und R-OPS kann sie setzen — ohne Neustart.
- **Related requirement:** technical-spec BE-01, API-05, API-06, ARCH-02 · FR-01, FR-02, FR-42, NFR-Ops-01
- **Expected output:** Lesen der Phase bei jedem Login-Anlauf; Admin-Endpoints `GET/PUT /api/admin/phase` mit Rollenprüfung und Pflichtfeld `reason`; Änderung landet in `event_log`.
- **Acceptance check:** Test T-ARCH-1: Phase umschalten → der **nächste** Login nutzt den neuen Weg, ohne Neustart; Rückstellung auf Phase 1 funktioniert ohne Datenverlust; jeder Set-Vorgang hat changed_by + reason im Protokoll.
- **Do-not-change-boundaries:** Kein hartkodiertes Datum im Code; nur R-OPS darf setzen (Permissions §4.2); kein zweiter Schalter; keine Datenmigration beim Umschalten (FR-42).
- **Dependencies:** T-02, T-06

### T-10 — Login-Redirect je Phase
- **Goal:** Der phasengesteuerte Einstieg „Anmelden" leitet je Phase auf das richtige Ziel um; zusätzlich existiert der dokumentierte Einstieg „Passkey Login" (FR-01, Entscheidung 2026-10-08).
- **Related requirement:** technical-spec API-01, FE-01 · FR-01, FR-03
- **Expected output:** Endpoint `GET /api/auth/start` liefert `{ phase, redirect_url }`; der Login-Button ruft ihn auf; alle Redirects werden protokolliert.
- **Acceptance check:** Phase 1 → Redirect zu Verimi(-Mock); Phase 2 → Redirect zu Keycloak; der Einstieg „Passkey Login" führt direkt zur Passkey-Authentifizierung; Protokoll zeigt jeden Redirect; keine weitere, undokumentierte Weiterleitung im Code (FR-03).
- **Do-not-change-boundaries:** Adesso-Login wird nicht mit in die Phasenlogik gezogen (FR-04); keine weiteren, undokumentierten Login-Einstiege (FR-01/FR-03); kein Passwortfeld im Portal.
- **Dependencies:** T-07, T-09

### T-11 — Verimi-Rückkehr-Callback
- **Goal:** Nach der Verimi-Authentifizierung prüft das Backend anhand der Verifi-Kennung, ob ein Passkey existiert, und liefert die Vorbefüll-Daten.
- **Related requirement:** technical-spec API-02, BE-02 · FR-10, FR-13 (Datenbasis), NFR-Perf-05
- **Expected output:** Endpoint `GET /api/auth/verimi/callback` mit den drei Antwortzuständen: `passkey_exists: true/false` (+ prefill bei false) oder 400 bei fehlender/ungültiger Kennung.
- **Acceptance check:** Bekannte Kennung → „vorhanden"; unbekannte → „kein Passkey" + Vorbefüllung; fehlende/ungültige Kennung → 400 mit **generischer** Meldung; die Kennung erscheint **nicht** in den Logs (DB-06/NFR-Sec-06); Prüfschritt ≤ 1 s *[V]*.
- **Do-not-change-boundaries:** Nur die Kennung als Zuordnungsmerkmal (keine Zuordnung über E-Mail, FR-61/BR-08); keine weiteren übernommenen Felder außer den drei (FR-14); keine Existenzauskunft bei ungültiger Kennung.
- **Dependencies:** T-01, T-05, T-08

### T-12 — Registrierungsfrage (Screen und Wiederholungslogik)
- **Goal:** Immer wenn in Phase 1 kein Passkey existiert, erscheint die Frage „Ja, registrieren" / „Nein" — bei **jedem** Login, bis registriert wurde.
- **Related requirement:** technical-spec FE (Screen Registrierungsfrage), FE-03, FE-06 · FR-11, FR-12, NFR-UX-04, AC-P2, US-004
- **Expected output:** Screen mit zwei gleichwertigen Aktionen, kein vorausgewähltes „Ja", Wiederholungsschleife, „Nein"-Pfad in den geschützten Bereich.
- **Acceptance check:** AC-P2: dreimal „Nein" → die Frage erscheint beim dritten Login **wieder** und der Nutzer erreicht trotzdem ohne Fehlermeldung und ohne Sperrhinweis den geschützten Bereich; nach erfolgreicher Registrierung erscheint die Frage nie wieder (SC-P3: zweiter Login direkt in den geschützten Bereich).
- **Do-not-change-boundaries:** Keine dritte Antwortmöglichkeit, kein Zwangstext (Migration bleibt freiwillig, BR-05); kein Jargon (NFR-UX-05); keine E-Mail-Bestätigung als Zwischenschritt (BR-11).
- **Dependencies:** T-11

### T-13 — Vorbefülltes Registrierungsformular (genau drei Felder)
- **Goal:** Bei „Ja" erscheint ein Formular mit Nachname, Vorname, E-Mail — vorbefüllt, nichts muss abgetippt werden.
- **Related requirement:** technical-spec FE (Screen Registrierungsformular), API-03, DB-01 · FR-13, FR-14, AC-P4, CN-8
- **Expected output:** Formular mit drei readonly vorbefüllten Feldern, Submit „Passkey anlegen", serverseitige Validierung (Pflicht, Format, Längenlimits) auf API-03.
- **Acceptance check:** AC-P4: Feldwerte stimmen mit den Verimi-Werten überein, kein Feldabtippen nötig; ein mitgeschicktes viertes Feld wird vom Server abgelehnt (400); die Payload enthält exakt drei Felder.
- **Do-not-change-boundaries:** Keine Kundennummer, keine Ausweisdaten, keine Adesso-Verknüpfung (FR-14, CO-09); **keine Felder mehr und keine weniger**; Felder bleiben vorbefüllt-readonly, bis OQ-17 entschieden ist (BR-08-Voreinstellung); keine mobilen Eingabe-Hilfen nötig (Desktop-only).
- **Dependencies:** T-11

### T-14 — Registrierung nur in eigener Session
- **Goal:** Ein Passkey lässt sich ausschließlich für das eigene, authentifizierte Konto registrieren.
- **Related requirement:** technical-spec BE-03, API-03, SEC-01 · FR-15, NFR-Sec-01, PR-02, AC-P8
- **Expected output:** Serverseitige Session-Prüfung vor jeder Registrierung, inklusive Ablauf- und Zuordnungsregel aus T-03.
- **Acceptance check:** AC-P8 (Negativtest): keine Session → 401; Session eines anderen Nutzers → 403 + Sicherheitsereignis im Protokoll; abgelaufene Session → 401; der eigene Positivefall funktioniert weiterhin.
- **Do-not-change-boundaries:** Kein Weg, ein Passkey für ein fremdes Konto zu registrieren — **auch nicht für eine Betriebsrolle** (PR-02, kein R-SWITCH-Feature in dieser Software, PRD §7); keine „Test-Registrierungs"-Umgehung in der Produktion.
- **Dependencies:** T-03, T-13

### T-15 — Registrierung abschließen und Sitzung fortsetzen
- **Goal:** Nach der WebAuthn-Registrierung landet der Nutzer **in derselben Sitzung** im geschützten Bereich, und das Ereignis wird protokolliert.
- **Related requirement:** technical-spec BE-09, ERR-02 · FR-17, FR-18, FR-19, AC-P1, NFR-Perf-04
- **Expected output:** Registrierungsablauf an Keycloak angebunden, Weiterleitung ohne erneuten Login, Eintrag in `event_log` (Zeitpunkt + Ergebnis).
- **Acceptance check:** AC-P1: nach der Registrierung ist **kein** zweiter Login nötig; Protokolleintrag existiert für Erfolg **und** Fehlerfall; Dauer unter der Abbruchschwelle *[V: ≤ 30 s]*; bei Technikfehler: verständliche Meldung ohne Existenzauskunft, Eingaben bleiben sichtbar (ERR-02).
- **Do-not-change-boundaries:** Kein Sitzungsreset nach der Registrierung; keine E-Mail-Bestätigung, kein zweites Credential (FR-33); keine Zusatzabfrage oder Marketing-Opt-in (Reporting/Kommunikation out of scope).
- **Dependencies:** T-12, T-14

---

## Phase 3 — Ablauf Phase 2 (Passkey-Login und Sperrung)

### T-16 — Passkey-Login (Phase 2 / Einstieg „Passkey Login")
- **Goal:** In Phase 2 führt „Anmelden" direkt zur Passkey-Authentifizierung bei Keycloak; derselbe Keycloak-Flow wird vor dem Stichtag über den Einstieg „Passkey Login" erreicht (FR-01, Entscheidung 2026-10-08).
- **Related requirement:** technical-spec FE (Login-Einstieg), API-01 · FR-01, FR-30, FR-31, intent.md C-1.8, C-2.1
- **Expected output:** Redirect zu Keycloak, WebAuthn-Abfrage, Rückkehr, Anzeige des geschützten Bereichs; UI-Text „Anmelden mit Ihrem Passkey".
- **Acceptance check:** Kein Benutzer-/Passwort-Feld im gesamten Ablauf; Test-User meldet sich nach T-15 mit dem neuen Passkey an (SC-P1) — über den Einstieg „Passkey Login" (FR-01) bzw. den Phase-2-Login; im Verimi-Weg (Phase 1) führt der zweite Login **direkt** in den geschützten Bereich, ohne Passkey-Abfrage (SC-P3, Entscheidung 2026-10-08).
- **Do-not-change-boundaries:** Kein zweites Credential, keine Passwort-Option, kein Recoverypfad (FR-33/FR-34, BR-03/BR-04); kein Jargon im UI (NFR-UX-05).
- **Dependencies:** T-09, T-10, T-15

### T-17 — Token-Prüfung serverseitig
- **Goal:** Der geschützter Bereich wird nur mit einem gültigen, nicht abgelaufenen, korrekt signierten Token betreten.
- **Related requirement:** technical-spec API-04, BE-08, SEC (Authentication) · FR-32, AC-P6, AC-2
- **Expected output:** Prüfung von Aussteller, Signatur und Laufzeit im Backend; 401-Verhalten für die drei Fehlerfälle.
- **Acceptance check:** AC-P6: manipuliertes, abgelaufenes und fehlendes Token werden jeweils abgewiesen und protokolliert; gültiges Token → 200; die Prüfung findet **serverseitig** statt (im Code sichtbar, Review).
- **Do-not-change-boundaries:** Keine rein clientseitige Prüfung; keine „nur im Test"-Umgehung in Produktion; keine Whitelist für bestimmte Token-Typen; kein Zugang ohne Token, auch nicht für Betriebsrollen (PR-03).
- **Dependencies:** T-16

### T-18 — Sperrlogik mit unterscheidbarem Protokoll
- **Goal:** Ab dem konfigurierten Phasenwechsel haben Nutzer ohne Passkey keinen Zugang — und die Sperrung ist als „mangels Passkey" erkennbar.
- **Related requirement:** technical-spec BE-07, ERR-06 · FR-40, FR-42, FR-44, AC-3, AC-4
- **Expected output:** Sperrprüfung im Zugangspfad, Protokolleintrag mit Ursache `blocked / mangels Passkey`, konfigurierbarer Zeitpunkt aus T-09.
- **Acceptance check:** AC-3: nicht migrierter Testnutzer wird gesperrt **und** die Ursache ist aus dem Protokoll eindeutig lesbar; AC-4: Nutzer mit funktionierendem Passkey wird **nicht** gesperrt; Vorzeiten-Test: vor dem konfigurierten Zeitpunkt gesperrt niemand (FR-02).
- **Do-not-change-boundaries:** Die Sperrung wirkt **nicht** auf den Adesso-Login (FR-41); keine Sperrung aus anderem Grund mit derselben Ursachenkennung; kein Sonderzugang/Backdoor (PR-03, PR-08); keine Sperrmail durch die Software (BR-11).
- **Dependencies:** T-09, T-16

### T-19 — Sperr- und Fehlermeldungen
- **Goal:** Jeder Fehlerfall hat eine verständliche, deutsche, handlungsanweisende Meldung ohne Existenzauskunft.
- **Related requirement:** technical-spec FE (Fehler-Banner), ERR-01, ERR-04, ERR-05 · FR-35, FR-45, NFR-UX-01/05, NFR-Env-04, BR-06
- **Expected output:** Textbausteine für: fehlgeschlagene Anmeldung, Technikfehler bei der Registrierung, nicht unterstützter Browser, Sperrung zum Stichtag.
- **Acceptance check:** Jeder in technical-spec §9 gelistete Endnutzer-Fall hat einen deutschen Text ohne Fehlercode, ohne Stacktrace, ohne „Verimi/Keycloak/WebAuthn"; identischer Text ob die Identität existiert oder nicht (AC-13-Voraussetzung); die Sperrmeldung führt berechtigte Personen (Gruppe B) zum manuellen Weg, **ohne** pauschal abzuweisen (FR-45/BR-06-Textprüfung).
- **Do-not-change-boundaries:** Keine technischen Fehlercodes für Endnutzer; keine Auskunft über Existenz von Konten; keine Kommunikationspflicht (Brief/E-Mail bleibt beim Auftraggeber, BR-11); kein Support-Kontaktformular (OQ-18 offen, PRD §7).
- **Dependencies:** T-15, T-18

---

## Phase 4 — Sicherheit und Protokollierung

### T-20 — Rate-Limiting
- **Goal:** Authentifizierungs- und Registrierungsversuche sind gegen automatisierte Missbräuche geschützt.
- **Related requirement:** technical-spec BE-10, SEC (Rate limiting) · NFR-Sec-05 `[V]`
- **Expected output:** Limits je Identität und je Quelle für Login- und Registrierungsversuche; bei Überschreitung generische Meldung + Log-Eintrag.
- **Acceptance check:** Hammer-Test: Versuche werden begrenzt; die Antwort ist **dieselbe** generische Meldung wie bei anderen Fehlern (kein Hinweis auf Sperrung/Existenz); legitimer Nutzer ist nach Ablauf des Fensters nicht dauerhaft blockiert.
- **Do-not-change-boundaries:** Kein sichtbares „Konto gesperrt"-Signal (Enumerationsschutz geht vor); keine Ausnahmen für IP-Bereiche in der Produktion; kein Limit, das den Erreichbarkeitstest blockiert (läuft als eigener Job, ARCH-07).
- **Dependencies:** T-11, T-14

### T-21 — Kein Enumerieren (Meldung und Antwortzeit)
- **Goal:** Weder Text noch Timing verraten, ob eine Identität existiert oder ein Passkey hinterlegt ist.
- **Related requirement:** technical-spec BE-11, SEC (No enumeration) · NFR-Sec-04, AC-13
- **Expected output:** Einheitlicher Fehlerpfad für „unbekannte Kennung" und „bekannte Kennung ohne Passkey-Fehler"; Zeitmessung der negativen Fälle als Test.
- **Acceptance check:** AC-13: Antwortzeiten beider negativer Fälle innerhalb einer vereinbarten Toleranz *[V: ±X ms, in T-33 festlegen]*; Meldungen identisch; Messprotokoll liegt vor.
- **Do-not-change-boundaries:** Keine Sonderbehandlung „Konto existiert nicht"; keine zusätzlichen Log-Details mit Identitätsfeldern im Klartext (NFR-Sec-06); Timing-Ausgleich darf keine echten Fehler verschleiern (Logs bleiben auswertbar).
- **Dependencies:** T-11, T-19

### T-22 — Ereignis- und Audit-Protokollierung
- **Goal:** Alle sicherheitsrelevanten Ereignisse sind nachvollziehbar protokolliert — ohne Geheimnisse, ohne Klartext-Identität.
- **Related requirement:** technical-spec DB-Entity Ereignis-Protokoll, SEC (Logging) · FR-18, FR-19, FR-44, NFR-Sec-06, NFR-Sec-08, PR-07, AC-14
- **Expected output:** Schreibpfade für `registration`, `login_success`, `login_failed`, `blocked`, `phase_change`, `ops_action`; append-only; pseudonymisierte Referenz statt Name/E-Mail.
- **Acceptance check:** AC-14 (Stichprobe): kein Protolleintrag enthält Nachname/Vorname/E-Mail im Klartext oder ein Passkey-Geheimnis; jeder Set-Vorgang des Phasenschalters ist einer R-OPS-Kennung zuordenbar (PR-07); Ereignisse aus T-15/T-18 sind vorhanden.
- **Do-not-change-boundaries:** Kein Personen-Report aus den Protokollen (Reporting out of scope); keine Löschfunktion für Protokolle (append-only); keine Identitätsfelder als Klartext, auch nicht „für Debugging"; Aufbewahrung nach NFR-Sec-08, Dauer mit OQ-08/OQ-09 abstimmen.
- **Dependencies:** T-06, T-15, T-18

### T-23 — Berechtigungsnegativtests (Rollenmatrix)
- **Goal:** Die Berechtigungsmatrix aus requirements.md §4 ist für jede Rolle durch Tests belegt.
- **Related requirement:** technical-spec SEC (Authorization), BE-14 · Abschnitt 4, PR-01..PR-05, AC-P11
- **Expected output:** Testset je Rolle (R-END, R-OPS, R-SYS, plus Diagnose-Rolle) mit Positiv- und Negativfällen; Ergebnisprotokoll.
- **Acceptance check:** AC-P11: jede Matrixzeile mit Software-Bezug ist belegt; die Zelle „Passkey-Geheimnis einsehen/exportieren/wiederherstellen" ist für **alle** Rollen negativ (unbesetzbar, PR-01); nur R-OPS darf `PUT /api/admin/phase` aufrufen; jede Betriebshandlung ist protokolliert (PR-07).
- **Do-not-change-boundaries:** Keine neuen Rollen oder Rollenrechte erfinden; die R-SWITCH-Zeilen (Reisepassprüfung, Reaktivierung) werden **nicht** implementiert — geprüft wird nur, dass solche Funktionen in dieser Software **nicht existieren** (PRD §7); keine Backdoor auch nicht „temporär für Tests" (PR-03).
- **Dependencies:** T-09, T-14, T-17, T-22

---

## Phase 5 — Betrieb

### T-24 — Erreichbarkeitstest-Funktion
- **Goal:** Ein Betriebsjob prüft für alle registrierten Passkeys, ob eine Anmeldung nachweisbar möglich ist — ohne Nutzermitwirkung und ohne Geheimnis.
- **Related requirement:** technical-spec BE-12, API-07, API-08, DB-Entity Erreichbarkeitstest-Ergebnis · FR-70..FR-73, AC-P9, OQ-TS-3
- **Expected output:** Job + Admin-Endpoints (Starten, Ergebnis abfragen, Fehlfallliste exportieren); Ergebnis-Entity mit `checked_count` und `failed_credentials`.
- **Acceptance check:** AC-P9: Testlauf auf der Test-Population (C-P.4) liefert ein Ergebnis und eine exportierbare Fehlfallliste; nachgewiesen, dass weder Nutzermitwirkung noch Geheimniswissen nötig sind; laufender zweiter Start → 409.
- **Do-not-change-boundaries:** Kein Zugriff auf Passkey-Geheimnisse (PR-01); **kein Personen-Report** — die Liste ist Arbeitsgrundlage für den Rückruf des Auftraggebers (ERR-10); kein Versand von E-Mails durch die Software (BR-11); **keine Migrationsquote- oder Wochentreporting-Funktion** (out of scope); Verfahrensdetail erst nach OQ-TS-3 finale Freigabe.
- **Dependencies:** T-15, OQ-TS-3 (Klärung, siehe T-Plan-Hinweis), T-22

### T-25 — Backup und Restore mit gemessener Zeit
- **Goal:** Backup und Wiederherstellung der Identity-Daten sind einmal vollständig durchgespielt, die Wiederherstellungszeit ist gemessen.
- **Related requirement:** technical-spec DB (Retention/Backup), PERF-07 · FR-91, FR-92, NFR-AV-04, AC-6, intent.md C-3.3, SC-5
- **Expected output:** Restore-Protokoll mit Zeitmessung: Start → Daten wieder da → **Anmeldung mit Passkey funktioniert wieder**; dokumentierte RTO-Zahl.
- **Acceptance check:** AC-6: vollständiger Durchlauf nachweisbar; RTO als Zahl dokumentiert *[V: ≤ 4 h — Bestätigung aus OQ-TS-6]*; Wiederanlauf bis zur Anmeldefähigkeit ist geprüft, nicht nur die Datenspiegelung (FR-92).
- **Do-not-change-boundaries:** Kein Versprechen auf Hochverfügbarkeit/Redundanz/Failover (BR-13, NFR-AV-03) — es wird **gemessen**, nicht zugesagt; keine zweite Instanz als „Lösung"; Restore-Übung nur mit Testdaten.
- **Dependencies:** T-05, T-06, OQ-04/OQ-06 (Hosting-Frage)

### T-26 — Monitoring und Alarme
- **Goal:** Drei Alarmfälle werden gemeldet: Ausfall des Identitätsdatensystems, Nichterreichen der Anmeldung, Fehlerhäufungen bei der Registrierung.
- **Related requirement:** technical-spec ERR-09, PERF-06 · FR-94, NFR-AV-02
- **Expected output:** Monitoring-Konfiguration mit drei Alarmregeln und benachrichtigtem R-OPS-Kanal; Alarmeintrag im Runbook verlinkt.
- **Acceptance check:** Jeder der drei Fälle wird im Test künstlich ausgelöst und erzeugt genau einen Alarm; Keycloak-Ausfall alarmiert **sofort** (bewusster Gesamtausfall, NFR-AV-02).
- **Do-not-change-boundaries:** Keine Alarme auf Migrationsquoten (Reporting out of scope); kein Auto-Scaling/Redundanz als Reaktion (PRD §7); keine Endnutzer-Benachrichtigung durch die Software.
- **Dependencies:** T-15, T-22

### T-27 — Betriebs-Runbook und Notbetrieb
- **Goal:** Geübte Anleitungen für Installation, Update, Backup, Monitoring, Wiederherstellung und Notbetrieb liegen vor.
- **Related requirement:** technical-spec ERR-08 · FR-90, FR-93, FR-95, NFR-Ops-04, AC-10, intent.md C-3.4, SC-10
- **Expected output:** Runbook mit den sechs Kapiteln; Notbetriebs-Kapitel nennt: wer entscheidet, wer informiert, Reihenfolge — mit Hinweis auf die Irreversibilität ab 01.01.2027; mindestens ein geübter Durchlauf.
- **Acceptance check:** AC-10: Runbook vorhanden **und** geübt (ungeübter Plan gilt als nicht vorhanden, NFR-Ops-04); Restore-Kapitel verweist auf das Protokoll aus T-25; Irreversibilität ab 01.01.2027 ist explizit formuliert (NFR-AV-06).
- **Do-not-change-boundaries:** Kein Rückfallweg nach dem 01.01.2027 beschreiben, der nicht existiert (FR-95 `[V]`); keine benannten Personen eintragen, solange OQ-18 (Supportverantwortung) offen ist — offen als Lücke markieren; keine Zugriffswege, die PR-03/PR-08 verletzen.
- **Dependencies:** T-25, T-26

---

## Phase 6 — Abnahme (Gate A und Gate B)

### T-28 — Gate-A-End-zu-End-Test (Prototyp)
- **Goal:** Alle Akzeptanzkriterien des Prototyps sind als Testprotokoll belegt.
- **Related requirement:** requirements.md AC-P1..AC-P4 · intent.md SC-P1..SC-P4
- **Expected output:** Testprotokoll mit den Fällen: Migration + Passkey-Login (AC-P1), Ablehnung ohne Nachteil (AC-P2), zweiter Verimi-Login ohne Passkey-Abfrage, direkt in den geschützten Bereich (AC-P3, Entscheidung 2026-10-08), Vorbefüllung der drei Felder (AC-P4).
- **Acceptance check:** Vier Fälle mit Datum, Tester, Ergebnis dokumentiert; jeder Failed-Fall hat einen Ticket-Verweis; keine Akzeptanz ohne Protokoll.
- **Do-not-change-boundaries:** Nur Test-User, keine produktiven Daten (NFR-Ops-02); keine Scope-Erweiterung, um einen Test „grüner" zu machen; Fehler werden behoben, nicht umdefiniert.
- **Dependencies:** T-10..T-19

### T-29 — Browsermatrix testen, Mobil-Lücke dokumentieren
- **Goal:** Passkey funktioniert auf allen unterstützten Desktop-Browsern; die Nicht-Testung von Mobil ist dokumentiert.
- **Related requirement:** technical-spec FE (Accessibility/Browser), NFR-Env-01, NFR-Env-02 · AC-P5, AC-P10
- **Expected output:** Testmatrix Chrome/Edge/Safari/Firefox × Windows/macOS mit Ergebnissen; separates Lücken-Dokument „Mobil nicht getestet".
- **Acceptance check:** AC-P5: alle 8 Kombinationen mit Ergebnis belegt; AC-P10: Mobil-Lücke ist schriftlich als Lücke festgehalten, nicht als „bestanden".
- **Do-not-change-boundaries:** Keine Mobile-Optimierung als Treibstoff für „grün" (CO-03); nicht unterstützte Kontexte bekommen die Handlungsanweisung aus T-19, keinen Fehlercode (NFR-Env-04); keine Browser-Versionen hinzunehmen, die außerhalb der Matrix liegen.
- **Dependencies:** T-16, T-19

### T-30 — Ersetzbarkeitsnachweis (Mock ↔ echt)
- **Goal:** Nachweisen, dass derselbe nachgelagerte Ablauf mit Mock und echtem Anbieter identisch funktioniert — nur über die Konfiguration.
- **Related requirement:** technical-spec ARCH-04, Integration 1 · NFR-Ops-03, AC-P7, intent.md C-P.5, Test T-ARCH-2
- **Expected output:** Testprotokoll des Konfigurations-Tauschs: Ausführung Ablauf mit Mock, Umschalten der Variable, Ausführung mit echtem Anbieter, Ergebnisvergleich.
- **Acceptance check:** AC-P7: Ablauf funktioniert **unverändert**; im Code ist keine `if (mock)`-Verzweigung im Ablauf sichtbar (Code-Review); die Variable ist im Protokoll dieselbe wie in T-08.
- **Do-not-change-boundaries:** Kein Parallelbetrieb zweier Codepfade; keine zweite Konfigurationsvariable für „echt"; der Nachweis ersetzt nicht die Klärung von OQ-15 (echte Abschaltzusage bleibt extern).
- **Dependencies:** T-08, T-11..T-16

### T-31 — WCAG-2.1-AA-Prüfung der vier Abläufe
- **Goal:** Prüfbericht für Login-Einstieg, Registrierungsfrage, Passkey-Bestätigung und Fehlermeldungen.
- **Related requirement:** technical-spec FE (Accessibility basics) · NFR-UX-06 (`muss`), AC-17
- **Expected output:** Prüfbericht mit Prüfmethode, Befundliste und Status je Ablauf; behobene Befunde mit Re-Test.
- **Acceptance check:** AC-17: Bericht existiert und deckt die **vier** benannten Abläufe ab; Tastaturbedienbarkeit, Kontrast und Screenreader-Texte sind geprüft; offene Befunde sind entweder behoben oder als Abweichung mit Entscheidung dokumentiert.
- **Do-not-change-boundaries:** Prüfumfang bleibt auf die vier Abläufe (kein Umfangsaufbau auf ganzes Portal); WCAG ist `muss` — nicht herunterstufen (Entscheidung 2026-10-06); keine Lösung, die Jargon-Ersatztexte aus T-19 verschlechtert.
- **Dependencies:** T-12, T-13, T-16, T-19

### T-32 — Security-Review vor Produktivgang
- **Goal:** Code-Review und Netzwerkanalyse belegen die produktionskritischen Sicherheitsaussagen.
- **Related requirement:** technical-spec SEC (gesamt) · AC-2, AC-7, AC-8, FR-63, NFR-Ops-05, PR-01..PR-05
- **Expected output:** Review-Checkliste mit Ergebnis zu: Token-Prüfung (AC-2), Stichprobenabgleich der drei Felder (AC-7), kein Abruf beim Altanbieter im Regelbetrieb (AC-8), keine Geheimnis-Einsicht (PR-01), keine Backdoor (PR-03).
- **Acceptance check:** AC-8: Netzwerkanalyse zeigt **keinen** Regelabruf bei Verimi; AC-7: Stichprobe übernommener Felder stimmt ohne Nacharbeit; jedes Review-Item ist ✓/✗ mit Fundstelle, nicht „aus reviewed".
- **Do-not-change-boundaries:** Kein neuer Funktionsumfang aus dem Review heraus (Defekte gehen in Tasks zurück in die Phasen 2–4); keine Alt-Schnittstelle stillschweigend aktiv lassen (FR-63/NFR-Ops-05: als entfernbar markieren und abschalten); keine Daten ohne Rechtsgrundlage ins Ausland (NFR-DS-05).
- **Dependencies:** T-17, T-21, T-22, T-23

### T-33 — Performance-Messung und Zielwertbestätigung
- **Goal:** Die als `[V]` markierten Zielwerte bestätigen lassen und die Antwortzeiten tatsächlich messen.
- **Related requirement:** technical-spec PERF-01..PERF-07, Search/Limits · NFR-Perf-01..05, NFR-AV-04, OQ-TS-6
- **Expected output:** Bestätigungsliste der Zielwerte durch den Auftraggeber (Login ≤ 3 s, Registrierung ≤ 30 s, Prüfschritt ≤ 1 s, RTO ≤ 4 h, Toleranzband für AC-13) **plus** Messprotokoll mit Werten auf Testdatenmengen (120.000 / 80.000).
- **Acceptance check:** Alle `[V]` in technical-spec §8 sind entwehr bestätigt oder durch neue Werte ersetzt; gemessene Werte liegen vor und erfüllen die bestätigten Ziele; AC-13-Toleranzband aus T-21 ist hier festgelegt.
- **Do-not-change-boundaries:** Kein Overengineering jenseits der bestätigten Ziele (CO-05 — die Last ist niedrig); keine Auto-Scaling-/HA-Arbeiten (PRD §7); keine Zielaufweichung, ohne dass der Auftraggeber schriftlich bestätigt.
- **Dependencies:** T-20, T-21, T-25, OQ-TS-6

### T-34 — Gate-B-Abnahmecheckliste
- **Goal:** Alle Abnahmekriterien des Produktivgangs sind entweder erfüllt oder als offen/blockiert benannt — mit Owner und Frist.
- **Related requirement:** requirements.md §6.2 (AC-1..AC-17), §6.3 (offene Punkte) · intent.md SC-1..SC-10, Blocker OQ-15 u. a.
- **Expected output:** Abnahmecheckliste: je AC = Status (✓ / ✗ / blockiert), Nachweis-Link, und für jedes „blockiert" der Owner + Frist; sowie die Liste der externen Blocker mit Aktualstatus (OQ-15, OQ-17, OQ-04/06, OQ-13, OQ-16, OQ-08/09, OQ-18, OQ-12).
- **Acceptance check:** Kein AC steht auf „unklar"; AC-11/AC-12 sind als `kann`/out-of-scope gekennzeichnet (Entscheidung 2026-10-06); AC-5/AC-15 sind als abhängig vom **manuellen Prozess des Auftraggebers** markiert (in dieser Software nicht abbildbar); OQ-15 ist mit Status „eingeholt oder eskaliert" belegt.
- **Do-not-change-boundaries:** Kein AC wird für die Checkliste umformuliert oder gestrichen; kein Akzeptieren mit „läuft noch" ohne Owner und Frist; keine stillen Scope-Zusätze (kein Reporting, keine Reaktivierung, kein Recovery, kein HA — PRD §7).
- **Dependencies:** T-28..T-33, externe Blocker

---

## Reihenfolge und Kritischer Pfad — Kurzfassung

| Reihenfolge | Phase | Tasks | Warum diese Reihenfolge |
|---|---|---|---|
| 1 | Klärungen | T-01..T-03 | Kennung, Schalter-Mechanik und Session-Regel sind Eingaben für fast jeden Folgetask |
| 2 | Fundament | T-04..T-08 | Keycloak, Portal-DB und die beiden Mocks sind die Bausteine, an denen alles hängt |
| 3 | Ablauf Phase 1 | T-09..T-15 | Der Migrationsablauf ist der Kern des Prototyps (Gate A, 2026-10-19) |
| 4 | Ablauf Phase 2 | T-16..T-19 | Passkey-Login und Sperrlogik folgen auf demselben Pfad |
| 5 | Sicherheit | T-20..T-23 | Querschnitt, aber vor der Betriebsphase, weil sie die Protokollgrundlage liefert |
| 6 | Betrieb | T-24..T-27 | Erreichbarkeitstest, Restore, Monitoring, Runbook — alles vor Gate B |
| 7 | Abnahme | T-28..T-34 | Nur was zuvor lief, kann abgenommen werden; T-34 ist der letzte Task |

**Kritischer Pfad:** T-01 → T-11 → T-12/T-13 → T-15 → T-16/T-18 → T-24 → T-25 → T-34.
**Größte Terminrisiken:** (1) OQ-15 ist überfällig und blockiert die Sinnhaftigkeit aller Phasentermine; (2) OQ-TS-3 (Verfahren Erreichbarkeitstest) blockiert T-24, und damit AC-P9/AC-9; (3) interne Ziele Prototyp 2026-10-19 / fertig 2026-10-31 (CN-2) lassen bei 34 kleinen Tasks nur wenig Puffer — bei Verzug ist die Reihenfolge die Rangliste, was zuerst nach Dezember wandert (R-09).
