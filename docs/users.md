# Nutzergruppen

Quelle: `idea.md`, bestaetigte Klaerungen vom 2026-10-05.

## Gruppen

| Gruppe | Beschreibung | Volumen | Leben ab 2027-01-01 |
|---|---|---|---|
| **A — Migriert** | Endnutzer, die bis 2026-12-31 einen Passkey registriert haben | max. 80.000 | Login mit Passkey. Kein Recovery-Weg. |
| **B — Nicht migriert, DE/EU-Reisepass** | Endnutzer mit deutschem oder EU-Reisepass, die nicht migriert haben | Teil der ca. 80.000 | Zugriff gesperrt ab 2027-01-01. Koennen 2027 ueber den manuellen Weg neu registrieren (Reaktivierung des bestehenden Accounts, kein neuer Account). |
| **C — Nicht migriert, Nicht-EU-Reisepass** | Endnutzer mit Nicht-EU-Reisepass, die nicht migriert haben | Teil der ca. 40.000 | Dauerhaft gesperrt. Kein Weg zurueck. |
| **D — Portal-Betreiber / Support** | Interne Mitarbeitende, die Support-Anfragen zu Passkey-Fehlern bearbeiten | unbekannt | Fachliche Supportverantwortung ist ungeplant (OQ-18, R-12). Der technische Betrieb liegt bei diesem Projekt (N-08). |

## Eckdaten

| Merkmal | Wert |
|---|---|
| Endnutzer gesamt | >= 120.000 |
| davon auslaendischer Reisepass | ca. 40.000 (30 %) |
| davon EU-Reisepass | unbekannt — bestimmt Groesse von Gruppe B (OQ-02) |
| Firmen-Account | nein |
| Technische Affinitaet | gering |
| Geraeteumgebung | nicht kontrolliert |
| Migrierte Identitaetsfelder | Name, Vorname, E-Mail (keine Kundennummer — R-11) |
| Unterstuetzte Geraete (Annahme) | Desktop-Browser |
| Mobilgeraete | ausgeschlossen (siehe `constraints.md`, C-04) |

## Journeys

### Journey A — Migrations-Login (vor dem 31.12.2026)
1. User oeffnet Portal, klickt Login-Button.
2. Weiterleitung zu Verimi (bzw. Verimi-Mock im Prototyp).
3. Verimi authentifiziert den User, leitet zurueck.
4. **Erstmals / noch nicht in Keycloak:** Portal fragt, ob der User einen Passkey registrieren will.
   - Ja → Daten aus Verimi werden uebernommen, Keycloak registriert den Passkey.
   - Nein → User wird ins Portal weitergeleitet, alter Login bleibt.
5. **Bereits in Keycloak:** Portal leitet nach der Verimi-Authentifizierung direkt in den geschuetzten Bereich (keine erneute Passkey-Abfrage — Entscheidung 2026-10-08). Mit Passkey anmelden kann sich der User vor dem Stichtag ueber den Einstieg „Passkey Login", ab dem 01.01.2027 ueber den regulären Login (Journey B).

### Journey B — Passkey-Login (ab dem 01.01.2027)
1. User oeffnet Portal, klickt Login-Button.
2. Weiterleitung zu Keycloak.
3. Passkey-Abfrage, User authentifiziert mit Passkey.
4. Bei Erfolg: User landet im geschuetzten Bereich.

### Journey C — Manuelle Nachregistrierung (2027, nur Gruppe B)
1. User informiert sich per Brief/E-Mail ueber die Sperrung.
2. User meldet sich beim manuellen Schalter.
3. Schalter prueft Identitaet gegen Reisepass (DE/EU).
4. Vorhandener Account wird reaktiviert und ein Passkey registriert.
5. User kann sich ab sofort mit Passkey anmelden.

> Hinweis: Journey C erfordert eine authentifizierte Session fuer die
> Passkey-Registrierung. Wie diese erzeugt wird, ist offen (OQ-03).
