# PRD — Passkey-Login für das Kundenportal (Verimi-Ablösung)

Stand: 2026-10-06 · Quelle: `requirements.md` (Stand 2026-10-05), `intent.md`, `users.md`
Status: **Entwurf zur Freigabe**
Scope-Änderung 2026-10-06: **Kein Migrationsquote-Reporting** (die zugehörige User Story sowie FR-80..FR-83, AC-11/AC-12, OQ-11 entfallen im PRD). Komplexität wird bis zum internen Ziel 2026-10-31 so weit wie möglich reduziert.

Scope-Änderung 2026-10-06: **Manuelle Reaktivierung Gruppe B (FR-50..FR-56) ist out-of-scope** — der Prozess existiert, wird aber als manueller Prozess des Auftraggebers geführt und in dieser Software nicht abgebildet (Flow „Reaktivierung", Persona Schalterpersonal, die zugehörigen User Stories und Open Questions sind entfallen).

**Fokus bis 2026-10-31:** Umsetzung des Prototyps gemäß `intent.md` §Prototyp (C-P.1..C-P.5): Portal-Mock, Verimi-Mock, Keycloak mit Passkey (nah am Endprodukt), Test-User, Nachweis der Ersetzbarkeit — fertig und getestet.

---

**Product name:**
Passkey-Login für das Kundenportal — Ablösung des externen Identitätsanbieters Verimi durch ein Passkey-basiertes Login (Keycloak, WebAuthn)

## 1. Product summary

Der externe Identitätsanbieter Verimi stellt seinen Dienst zum 31.12.2026 ein — der Kundenportal-Login bricht damit ohne Alternativen zusammen. Dieses Produkt ersetzt den Verimi-Login schrittweise durch ein Passkey-Login: Vor dem Stichtag läuft beides parallel, Endnutzer können sich **freiwillig** einen Passkey registrieren (die Identitätsdaten werden aus Verimi vorbefüllt übernommen). Ab dem 01.01.2027 ist das Passkey das **einzige** Credential; nicht migrierte Endnutzer werden gesperrt. Für Personen mit deutschem oder EU-Reisepass existiert 2027 ein manueller Nachregistrierungsprozess — dieser wird organisatorisch vom Auftraggeber geführt und ist **nicht Teil dieser Software**. Das Projekt betreibt das Identitätsdatensystem selbst (Installation, Backup, Monitoring, Restore). Umfasst sind ca. 120.000 Endnutzer mit geringer technischer Affinität auf nicht kontrollierten Desktop-Geräten.

## 2. Problem statement

Verimi wird zum 31.12.2026 abgeschaltet; das Kundenportal ist der einzige Konsument dieses Endpunkts. Ohne Maßnahme hat **kein** Endnutzer ab 01.01.2027 Zugang zum Portal. Der Handlungsdruck entsteht ausschließlich aus dem Provider-Abschalttermin (kein Compliance- oder Gesetzszwang), aber er ist absolut und irreversibel. Das eigentliche Problem ist nicht der technische Login, sondern die **Migration von bis zu 120.000 Endnutzern mit geringer technischer Affinität, ohne kontrollierte Geräteumgebung, in ein Credential-Modell ohne Alternative und ohne Recovery-Weg** — bei gleichzeitig bewusst dauerhaft ausgeschlossenen ca. 40.000 Nutzern ohne Nachweismöglichkeit. wenn diese 40.000 Nutzer sich nicht vor dem 31.12.2026 auf Keycloakk ihren Passkey registriert haben.

## 3. Product goal

**This product helps** Endnutzer des Kundenportals **achieve** ab 2027-01-01 weiterhin Zugang zum Portal — durch ein Passkey, das sie bis zum Stichtag selbst registrieren.

## 4. Success metrics

- **Prototyp bis 2026-10-31:** Umsetzung gemäß `intent.md` (C-P.1..C-P.5): Portal-Mock, Verimi-Mock, Keycloak mit Passkey, Test-User, Nachweis der Ersetzbarkeit; besteht Gate A (AC-P1..AC-P11) — ohne zusätzlichen Funktionsumfang über das hinaus, was der Nachweis verlangt.
- **Erreichbarkeit:** 100 % der registrierten Passkeys haben vor dem Stichtag (Ziel: 2026-11-30) einen nachgewiesenen, funktionierenden Passkey-Login; Fehlfälle werden aktiv zurückgerufen `[FR-70..FR-74]`.
- **Verfügbarkeit am Stichtag:** Am 2027-01-01 ist der Portal-Login für migrierte Endnutzer ohne jeden Verimi-Abruf funktionsfähig (Antwortzeit ≤ 3 s `[V]`), nachgewiesen durch Restore-Protokoll und Produktivtest.

## 5. Primary users

**Persona 1: Endnutzer Gruppe A — „Der migrierte Vielnutzer"**
- Role: Endnutzer des Kundenportals (max. 80.000), geringe technischer Affinität, Desktop Windows/macOS
- Goal: Nach der Registrierung unbemerkt weiter wie gewohnt ins Portal einloggen
- Frustration: Technische Begriffe, zweite Anmeldung, kein Support-Fall bei Geräteverlust (kein Recovery)
- Main use cases: Einmalige freiwillige Passkey-Registrierung in der Migrationsphase; Passkey-Login ab 2027
- Success condition: Login ohne Eingabe von Zugangsdaten, ≤ 3 s, ohne Fehlermeldung, ohne Fachbegriffe

**Persona 2: Endnutzer Gruppe B — „Der Nicht-Migrierte mit EU-Pass"**
- Role: Endnutzer ohne Passkey, aber mit deutschem/EU-Reisepass (Teil der ca. 80.000)
- Goal: Nach der Sperrung am Stichtag den Zugang wiedererlangen
- Frustration: Sperrung ohne Vorwarnung, kein Support-Fall
- Main use cases: Vor dem Stichtag: Registrierungsfrage bei jedem Login; ab 2027: Sperrmeldung im Portal. *Die Nachregistrierung erfolgt organisatorisch über den manuellen Prozess des Auftraggebers (außerhalb dieser Software)*
- Success condition: Sperrung greift korrekt; Meldung ist verständlich formuliert

**Persona 3: Endnutzer Gruppe C — „Der dauerhaft Ausgeschlossene"**
- Role: Endnutzer mit Nicht-EU-Reisepass (Teil der ca. 40.000), Ausschluss ist eine geschäftliche Entscheidung
- Goal: Zugang zum Portal (nicht erfüllbar)
- Frustration: Kein Weg zurück, Meldung ohne klare Handlungsanweisung
- Main use cases: Vor dem Stichtag: Weiterleitung auf den manuellen Weg für berechtigte Personen, ohne aktive Abweisung
- Success condition: Kein unberechtigter Zugang; Meldung ist verständlich formuliert `[BR-06]`

**Persona 4: Technischer Betrieb (R-OPS)**
- Role: Dieses Projekt — Installation, Update, Backup, Monitoring, Wiederherstellung, Phasenschalter
- Goal: Ausfallfreies System, gemessener Restore-Nachweis, auswertbare Protokolle
- Frustration: Ungeübte Notfallpläne, fehlende Verfügbarkeitsvorgabe, unklare Verantwortung
- Main use cases: Konfiguration des Stichtags ohne Neustart; Restore-Übung
- Success condition: Runbook geübt, Restore-Zeit gemessen, keine Restzugriffe auf den Altanbieter

*(Persona „Schalterpersonal (R-SWITCH)" entfällt 2026-10-06: Der manuelle Reaktivierungsprozess wird in dieser Software nicht abgebildet und ist hier kein Nutzer.)*

## 6. Feature scope

In scope for this version:

- **Phasengesteuerter Login-Einstieg (FR-01..FR-04):** genau ein Einstieg, von außen steuerbar (Verimi vor dem Stichtag, Passkey danach), jederzeit ohne Datenverlust zurückstellbar — *weil der Fallback bis 31.12.2026 das einzige Absicherung gegen interne Verzögerung ist*.
- **Freiwillige Passkey-Registrierung in der Migrationsphase (FR-10..FR-19):** Prüfung anhand der nicht erratbaren Verimi-Kennung, ja/nein-Frage, Vorbefüllung von Nachname/Vorname/E-Mail, Registrierung nur in gültiger Session — *weil dies der einzige selbstständige Migrationspfad für 80.000 Nutzer mit geringer Affinität ist*.
- **Passkey-Login ab Stichtag (FR-30..FR-35):** ausschließlich gültiges Token, ein Credential, kein Selbst-Recovery, verständliche Fehler ohne Existenzauskunft — *weil Passkey ab 2027 das einzige Credential ist (BR-03/BR-04)*.
- **Sperr- und Übergangslogik (FR-40..FR-45):** Ausschluss Nicht-Migrierter zum Stichtag, protokolliert als „mangels Passkey", konfigurierbarer Zeitpunkt ohne Neubau — *weil der Stichtag irreversibel ist und eine nicht nachvollziehbare Sperrung rechtlich und fachlich nicht vertretbar ist*.
- **Identitätsdatenbestand (FR-60..FR-65):** genau drei Felder, nach dem Stichtag einziger Speicherort, Zweckbindung — *weil die Datenminimierung das akzeptierte Datenschutzmodell ist (CN-8/CN-9)*.
- **Erreichbarkeitstest (FR-70..FR-74):** vorzeitiger Test aller registrierten Passkeys ohne Mitwirkung des Nutzers, aktiver Rückruf — *weil nicht nutzbare Passkeys erst nach der Abschaltung auffallen würden (R-06/R-12)*.
- **Betrieb und Wiederherstellung (FR-90..FR-95):** Runbook, einmal vollständiger Restore mit gemessener Zeit, Monitoring, Notbetrieb — *weil der Betrieb ausdrücklich in diesem Projekt liegt (BR-12) und Ausfall = Login-Ausfall für alle 120.000 (NFR-AV-02)*.

## 7. Out of scope

Not included in this version:

- **Manuelle Reaktivierung Gruppe B (FR-50..FR-56)** — der Prozess existiert, wird aber als manueller Prozess des Auftraggebers geführt (Reisepassprüfung am Schalter, organisatorisch). Diese Software bildet ihn nicht ab; es gibt keinen Software-Flow, keine Schalteroberfläche und kein R-SWITCH-Feature (Entscheidung 2026-10-06).
- **Migrationsquote-Reporting (FR-80..FR-83, AC-11/AC-12, BR-01)** — Entscheidung 2026-10-06, bis 31.10. `kann`, kein Wochentreporting, kein Eskalationsprozess.
- **Hochverfügbarkeit / Redundanz / Failover** — bewusste Entscheidung, ein gemessener Restore-Nachweis genügt (BR-13, NFR-AV-03).
- **Recovery-Weg für Gruppe A** — Geräteverlust bedeutet endgültigen Zugangsverlust; Entscheidung des Auftraggebers (BR-04). Empfehlung R-04 bleibt offen.
- **Mobile Passkeys / Mobilgeräte** — ausgeschlossen durch Entscheidung; betroffene Nutzer werden in der Kampagne adressiert (CO-03, NFR-Env-02).
- **Adesso-Login** — bleibt unverändert und wird nicht in den Phasenwechsel einbezogen (FR-04, OQ-10).
- **Endnutzer-Kommunikation (Brief/E-Mail)** — manuell beim Auftraggeber (BR-11).
- **Neue Portal-Funktionalität, Entitlements, Stammdatenmigration** — kein Eingriff in die Portal-Datenlogik (CO-12, PR-06).
- **Fachlicher Endnutzer-Support (Hotline, Passkey-Hilfe)** — derzeit niemandem zugewiesen, offene Abhängigkeit (BR-14, OQ-18).
- **Geräteverwaltung / MDM / kontrollierte Browser** — Endgeräte stehen nicht unter Projektkontrolle (NFR-Env-03).
- **E-Mail-/SMS-Wiederherstellung, Einmalcode als Credential, Support-Backdoor** — technisch nicht vorgesehen (BR-03, PR-01/PR-03).
- **Rechtliche Identitätsverifikation** — nicht vorgeschrieben (CO-11).

## 8. User stories

- **US-001:** As a Endnutzer (Gruppe A), I want mich mit einem Klick und meinem Passkey anmelden, so that ich ohne Passwörter und ohne technisches Wissen ins Portal komme.
- **US-002:** As a Endnutzer (Gruppe A), I want vor dem Stichtag gefragt werde, ob ich einen Passkey registrieren möchte, so dass ich mich rechtzeitig vorbereite, ohne zu einem Zeitpunkt unter Druck gesetzt zu werden.
- **US-003:** As a Endnutzer (Gruppe A), I want meine Daten aus Verimi vorbefüllt übernehme, so dass ich nichts abtippen und keine Zugangsdaten eingeben muss.
- **US-004:** As a Endnutzer (Gruppe A), I want die Registrierung ablehnen können, ohne Nachteil oder Fehlermeldung — werde aber bei jedem weiteren Login erneut gefragt, so dass ich die Entscheidung jederzeit überdenken kann, ohne am laufenden Login gehindert zu werden.
- **US-005:** As a Technischer Betrieb (R-OPS), I want den Stichtag und den Phasenschalter konfigurieren zu können, so dass eine Verschiebung ohne Softwarewechsel und ohne Neustart möglich ist.
- **US-006:** As a Technischer Betrieb (R-OPS), I want Backup und Wiederherstellung vor Produktivgang vollständig durchgespielt und die Restore-Zeit gemessen haben, so dass ein Ausfall beherrschbar ist.
- **US-007:** As a Endnutzer (Gruppe C), I want vor dem Stichtag eine Meldung, die zum manuellen Weg für berechtigte Personen führt, so dass die Gruppe nicht unnötig aktiv abgewiesen wird, aber kein unberechtigter Zugang entsteht.
- **US-008:** As a Datenschutzverantwortlicher, I want dass nur Nachname, Vorname und E-Mail migriert und ausschließlich für Authentifizierung genutzt werden, so dass der Datenbestand minimiert und zweckgebunden bleibt.

## 9. User flows

**Flow 1: Freiwillige Passkey-Registrierung (Phase 1, bis 2026-12-31)**
- Start: Endnutzer klickt den Login-Einstieg des Portals.
- Action: Weiterleitung zu Verimi; nach erfolgreicher Authentifizierung prüft das Portal anhand der eindeutigen Verimi-Kennung, ob ein Passkey existiert.
- System response: Kein Passkey → Registrierungsfrage mit „Ja/Nein"; bei „Ja" ist das Formular mit Nachname, Vorname, E-Mail vorbefüllt; Passkey-Registrierung nur in gültiger Session; Ereignis mit Zeitpunkt und Ergebnis protokolliert.
- Success path: Passkey registriert → User ist in derselben Sitzung im geschützten Bereich und kann sich beim nächsten Login mit Passkey anmelden.
- Failure path: „Nein" → ohne Fehlermeldung und ohne Sperrhinweis in den geschützten Bereich, alter Login bleibt; die Registrierungsfrage wird **bei jedem weiteren Login erneut gestellt**, bis der Nutzer sich registriert (NFR-UX-04). Technischer Fehler → verständliche Meldung ohne Existenzauskunft, Log-Eintrag.

**Flow 2: Passkey-Login (Phase 2, ab 2027-01-01; Einstieg „Passkey Login" bereits ab Phase 1, Entscheidung 2026-10-08)**
- Start: Endnutzer klickt den Login-Einstieg („Anmelden" ab Stichtag bzw. „Passkey Login", der bereits vor dem Stichtag direkt zur Passkey-Authentifizierung führt — FR-01).
- Action: Weiterleitung zum Identitätsanbieter, Passkey-Abfrage des Browsers.
- System response: Gültiges, nicht abgelaufenes Token → Zugang zum geschützten Bereich.
- Success path: Geschützter Bereich in ≤ 3 s `[V]` sichtbar; Portal-Funktionalität unverändert.
- Failure path: Fehlgeschlagene Authentifizierung → verständliche Meldung ohne Auskunft über die Existenz des Identitätssubjekts, auswertbarer Log-Eintrag; manipuliertes/abgelaufenes Token → Abweisung.

**Flow 3: Sperrung am Stichtag (nicht migrierte Endnutzer)**
- Start: Endnutzer ohne registrierten Passkey klickt nach dem konfigurierten Phasenwechsel den Login-Einstieg.
- Action: Phasenschalter führt zur Passkey-Authentifizierung; kein Passkey vorhanden.
- System response: Zugang zum geschützten Bereich wird ausgeschlossen; Sperrung wird protokolliert und ist als „mangels Passkey" erkennbar.
- Success path: Bestätigungsfälle — migrierte Nutzer werden **nicht** gesperrt (Gegenprobe AC-4); bestehende Sitzungen gemäß Festlegung `[OQ-13]`.
- Failure path: Fehlentscheid/technischer Fehler → Nachvollziehbarkeit über Protokoll; kein stiller Zugang; Notbetrieb nach Runbook-Entscheidung (kein Rückfallweg nach 01.01.2027).

**Flow 4: Erreichbarkeitstest (vor dem Stichtag)**
- Start: Betrieb führt für alle registrierten Passkeys den Test durch (ohne Mitwirkung des Nutzers, ohne Passkey-Geheimnis).
- System response: Ergebnis und Quote werden dokumentiert; nicht nachweisbar funktionierende Fälle werden aktiv zurückgerufen und auf Migration oder den manuellen Weg verwiesen.
- Success path: Abschluss bis 2026-11-30 `[V]`, Rücklauf mit Zeit für erneute Migration.
- Failure path: Fehlfälle nicht erreichbar → aktiver Rückruf; Verantwortung für Rückruf offen `[OQ-16]`.

## 10. Feature priorities

Must-have:
- Phasengesteuerter Login-Einstieg mit jederzeit rückstellbarem Verimi-Fallback (FR-01..FR-03)
- Freiwillige Passkey-Registrierung mit Vorbefüllung und Session-Pflicht (FR-10..FR-17)
- Passkey-Login mit Token-Prüfung ab Stichtag (FR-30..FR-35)
- Sperrlogik zum Stichtag mit protokollierter Sperrursache (FR-40, FR-42, FR-44)
- Betrieb: Runbook, gemessener Restore, Monitoring (FR-90..FR-95)
- Sicherheitsgrundlagen: kein Enumerieren, Rate-Limiting, Protokolle ohne Geheimnisse (NFR-Sec-01..08)
- Barrierefreiheit: WCAG-Prüfung der betroffenen Abläufe (NFR-UX-06)

Should-have:
- Erreichbarkeitstest über alle registrierten Passkeys inkl. aktivem Rückruf (FR-70..FR-74)

Could-have:
- Erweiterte Monitoring-Alarmierung jenseits der Mindestanforderungen (FR-94)

Later:
- Recovery-Prozess für Gruppe A (Empfehlung R-04, bewusst nicht enthalten)
- Mobile Unterstützung (CO-03)
- Fachlicher Endnutzer-Support-Prozess (OQ-18)
- Hochverfügbarkeit/Redundanz (BR-13)

## 11. Open questions

*(Vollständige Liste und Owner in `requirements.md` §6.3 — hier die für das Produktdesign kritischsten:)*

- **OQ-12:** Zahl ausschließlich mobiler Nutzer — bestimmt die Grundgesamtheit der betroffenen Endnutzer. *Bis 2026-10-31.*
- **OQ-17:** Änderbarkeit der drei Identitätsfelder nach Registrierung (BR-08) — bestimmt Datenmodell und R-11. *Vor Prototypabschluss.*
- **OQ-04 / OQ-06:** Hosting-Plattform und Verfügbarkeitsziel. *Bis 2026-11-15, blockiert Betriebsauslegung.*
- **OQ-18 / BR-14:** Fachliche Supportverantwortung — derzeit niemandem zugewiesen. *Bis 2026-11-30.*
- **OQ-13:** Fortbestehen bestehender Sitzungen zum Stichtag. *Bis 2026-11-15.*
- **OQ-15:** Verbindliche Abschaltzusage des Anbieters — hängt die gesamte Terminplanung dran. *Sofort.*
- **OQ-08 / OQ-09:** AVV und Lösch-/Aufbewahrungskonzept. *Vor Produktivgang.*
- **OQ-16:** Verantwortlicher für den Erreichbarkeitstest. *Bis 2026-11-30.*

*(Entfallen am 2026-10-06, weil die manuelle Reaktivierung out-of-scope ist: OQ-03, OQ-02, OQ-14, A-03/BR-15. OQ-12 bleibt relevant für die Grundgesamtheit.)*

## 12. Links to requirements

- Supports **FR-01** (phasengesteuerter Login-Einstieg) — Format REQ-F-001
- Supports **FR-10..FR-19** (Migrationsphase/Registrierung) — Format REQ-F-002
- Supports **FR-30..FR-35** (Passkey-Login) — Format REQ-F-003
- Supports **FR-40..FR-45** (Sperr- und Übergangslogik) — Format REQ-F-004
- ~~Supports **FR-50..FR-56** (manuelle Reaktivierung)~~ — **out-of-scope seit 2026-10-06:** manueller Prozess des Auftraggebers, nicht Teil dieser Software (siehe §7).
- Supports **FR-70..FR-74** (Erreichbarkeitstest) — Format REQ-F-006
- Supports **NFR-Sec-01 / NFR-Sec-04** (kein Account-Takeover, kein Enumerieren) — Format REQ-NF-001
- Supports **NFR-DS-01 / NFR-DS-02** (Zweckbindung, Verschlüsselung im Ruhezustand) — Format REQ-NF-002
- Supports **NFR-Perf-01..03** (120.000 Datensätze, Antwortzeiten) — Format REQ-NF-003
- Supports **NFR-Env-01 / NFR-Env-02** (Desktop-Browser, Mobil ausgeschlossen) — Format REQ-NF-004
- Supports **NFR-UX-06** (Barrierefreiheit WCAG 2.1 AA, `muss` seit 2026-10-06, AC-17) — Format REQ-NF-005
- ~~Supports **BR-01** (Migrationsquote/Eskalation)~~ — **entfallen:** Migrationsquote-Reporting ist bis 2026-10-31 out-of-scope; in `requirements.md` sind FR-80..FR-83, AC-11/AC-12, BR-01 und OQ-11 entsprechend auf `kann` herabgestuft (Abgleich erfolgt 2026-10-06).
- Supports **BR-03 / BR-04** (einziges Credential, kein Recovery) — Format BR-001
- Supports **BR-06 / BR-07** (manuelle Nachregistrierung reaktiviert Bestand) — Format BR-002
- Supports **BR-09** (Stichtag 2027-01-01 extern fix und irreversibel) — Format BR-003
