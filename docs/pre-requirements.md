# Anforderungen — Ersetzung des Verimi-Login durch Keycloak-Passkey

Stand: 2026-10-05 · Quelle: `idea.md` + bestaetigte Klaerungen
Status: **Entwurf zur Freigabe** — offene Punkte siehe `open-questions.md`

---

## 1. Problem

Der externe Identitaets- und Authentifizierungsanbieter **Verimi stellt seinen
Dienst Ende 2026 ein**. Das Portal der Firma ist davon abhaengig; der Login der
Endnutzer laeuft heute ueber Verimi. Es muss ein Ersatz hergestellt werden.

Ein Rechtfertigungsdruck aus Compliance oder Gesetz existiert **nicht**. Der
Zwang entsteht ausschliesslich aus dem Abschalttermin des Providers.

## 2. Zielbild

| Nr. | Ziel | Prioritaet |
|---|---|---|
| Z-1 | Der Portal-Login funktioniert am 01.01.2027 ohne Verimi. | muss |
| Z-2 | Endnutzer koennen sich bis 2026-12-31 selbst einen Passkey registrieren. | muss |
| Z-3 | Bestehende Portal-Funktionalitaet bleibt fuer migrierte User unveraendert. | muss |
| Z-4 | Der manuelle Weg fuer Gruppe B bleibt bis 2027 verfuegbar. | muss |
| Z-5 | Kein Eingriff in Portal-Datenlogik, Entitlement-Logik oder Stammdaten. | muss |

## 3. Nutzergruppen und ihr Schicksal

| Gruppe | Volumen | Status ab 2027-01-01 | Weg zurueck |
|---|---|---|---|
| **A** — migriert (Passkey) | max. 80.000 | vollstaendig nutzungsfaehig | keiner |
| **B** — nicht migriert, DE/EU-Reisepass | Teilmenge der ~40.000 | **gesperrt** | manuelle Nachregistrierung in 2027 |
| **C** — nicht migriert, Nicht-EU-Reisepass | Rest der ~40.000 | **dauerhaft gesperrt** | keiner |
| **D** — Support / Portal-Betrieb | unbekannt | siehe OQ-05 | — |

> **Zur Kenntnis genommen:** Gruppe C verliert den Portalzugang dauerhaft.
> Das ist eine bewusste geschaeftliche Entscheidung des Projektträgers
> (siehe R-01).

## 4. Funktionale Anforderungen

### 4.1 Phase 1 — Migrationsphase (bis 2026-12-31, Verimi + Keycloak parallel)

| Nr. | Anforderung | Quelle |
|---|---|---|
| **F-01** | Das Portal bietet weiterhin den Login-Button, der zu Verimi fuehrt. | idea.md Z.48 |
| **F-02** | Nach erfolgreicher Verimi-Authentifizierung prueft das Portal anhand der Verimi-Kennung, ob in Keycloak bereits ein Passkey existiert. | idea.md Z.48 |
| **F-03** | Existiert **kein** Passkey, fragt das Portal den User, ob er registrieren moechte (Antwort ja/nein, kein Zwang). | idea.md Z.48 |
| **F-04** | Bei "ja" uebernimmt das Portal die Identitaetsdaten aus Verimi vorbefuellt (Name, Vorname, E-Mail — siehe 4.4), sodass der User nichts abtippen muss. | idea.md Z.48, OQ-07 |
| **F-05** | Die Registrierung wird in Keycloak durchgefuehrt; Keycloak ist das Herzstueck und im Endprodukt kein Mock. | idea.md Z.54 |
| **F-06** | Existiert **bereits** ein Passkey, zeigt das Portal statt des Verimi-Logins direkt die Passkey-Abfrage. *(Ersetzt 2026-10-08 durch die Entscheidung zu AK-03: zweiter Verimi-Login führt direkt in den geschützten Bereich, keine Passkey-Abfrage.)* | idea.md Z.48 |
| **F-07** | Verimi bleibt bis 2026-12-31 voll funktionsfaehig; kein Zwang zur Migration. | idea.md Z.22 |
| **F-08** | Verbleibt der User bis 31.12.2026 ohne Passkey, erfolgt die Sperrung **stufenweise**: Gruppe B kann ueber den manuellen Weg (F-12) reagieren, Gruppe C nicht. | idea.md Z.22/Z.27 |
| **F-09** | Alle Endnutzer werden vor dem 31.12.2026 per **Brief und E-Mail** informiert. | Klaerung 2026-10-05 |

### 4.2 Phase 2 — Passkey-Login (ab 2027-01-01)

| Nr. | Anforderung | Quelle |
|---|---|---|
| **F-10** | Der Login-Button fuehrt zu Keycloak. Der User authentifiziert sich mit Passkey. | idea.md Z.27 |
| **F-11** | Nach erfolgreicher Authentifizierung gelangt der User in den geschuetzten Portalbereich. | idea.md Z.46 |
| **F-12** | **Manuelle Nachregistrierung fuer Gruppe B (2027):** Der User wendet sich an einen manuellen Schalter, weist sich mit deutschem oder EU-Reisepass aus, und der **bestehende Account wird reaktiviert** (kein neuer Account). Anschliessend wird ein Passkey registriert. | Klaerung 2026-10-05 |
| **F-13** | Passkey ist der **einzige** Credential ab 2027-01-01. Ein alternatives Credential wird nicht angeboten. | Klaerung 2026-10-05 |
| **F-14** | Es gibt **keinen** Recovery-Weg fuer Nutzer, die ihr Geraet verlieren oder wechseln. | Klaerung 2026-10-05 |

### 4.4 Identitaetsdaten (OQ-07, bestaetigt 2026-10-05)

Verifi liefert **Name, Vorname und E-Mail-Adresse**. Diese drei Felder sind der
gesamte migrierte Datenbestand.

| Nr. | Anforderung | Begruendung |
|---|---|---|
| **F-15** | Keycloak uebernimmt genau diese drei Felder aus Verifi vorbefuellt fuer die Registrierung. Weitere Felder werden nicht migriert. | OQ-07 |
| **F-16** | Die **E-Mail-Adresse** ist nach der Migration das einzige stabile, vom User selbst aenderbare Identitaetsmerkmal. Es ist festzulegen, ob und wie der User sie in Keycloak aendern darf (OQ-17). | Folge aus F-15 |
| **F-17** | Eine **Kundennummer wird nicht migriert**. Damit existiert nach 2027-01-01 keine eindeutige, vom User nicht aenderbare Verknuepfung zwischen Keycloak-Account und Portal-Stammdaten. | Folge aus F-15, siehe R-11 |
| **F-18** | Keycloak ist der **einzige** Speicherort dieser Identitaetsdaten nach 2027-01-01. Verimi-Daten sind danach nicht mehr verfuegbar. | F-15 |

### 4.3 Prototyp (2 Wochen)

| Nr. | Anforderung |
|---|---|
| **P-01** | Portal-Mock: Login-Button, geschuetzter Bereich, der den Namen des Users anzeigt. |
| **P-02** | Verimi-Mock: vorab befuellte Datenbank mit Username/Passwort, keine Vorregistrierung noetig, Weiterleitung auf eine konfigurierbare URL. |
| **P-03** | Keycloak mit Passkey, on-premise, nahe am Endprodukt. |
| **P-04** | Test-User, mit denen der Migrations- und der Passkey-Login durchgespielt wird. |
| **P-05** | Der Prototyp belegt: Verimi-Mock **und** Verimi muessen durch denselben Keycloak-Login ersetzbar sein. |

## 5. Nicht-funktionale Anforderungen

| Nr. | Anforderung | Wert |
|---|---|---|
| **N-01** | Unterstuetzte Geraete | Desktop-Browser (Windows, macOS); **mobil ausgeschlossen** |
| **N-02** | Unterstuetzte Browser | aktuelle Chrome, Edge, Safari, Firefox (Annahme) |
| **N-03** | Last | 500–1.000 Logins/Monat; ~80.000 Registrierungen in 3 Monaten |
| **N-04** | Verfuegbarkeit | **nicht definiert — offener Punkt OQ-06** |
| **N-05** | Hosting | Prototyp on-premise; Endprodukt **offen (OQ-04)** |
| **N-06** | Datenhaltung | Keycloak wird neuer Speicherort der Identitaetsdaten (Annahme OQ-07) |
| **N-07** | Localisierung | Betrieb fuer Deutschland, EU-Reisepass wird anerkannt |
| **N-08** | **Betrieb in eigener Verantwortung (OQ-05, bestaetigt 2026-10-05):** Installation, Updates, Backup, Monitoring und Wiederherstellung der Keycloak-Instanz sind Teil dieses Projekts, nicht mehr extern. | OQ-05 |
| **N-09** | Backup und Restore der Identity-Daten muessen vor Produktivgang **einmal getestet** nachgewiesen sein, inkl. gemessener Wiederherstellungszeit. | R-07 |
| **N-10** | Identitaetsdaten in Keycloak (Name, Vorname, E-Mail, Passkey-Metadaten) werden nach Zugriff auf den geschuetzten Bereich nur zur Authentifizierung verwendet; keine weitere Verwendung. | N-06 |

## 6. Scope-Grenzen

### Im Scope
- Betrieb und Konfiguration von Keycloak mit Passkey-Unterstuetzung
- Integration Keycloak <-> Verimi fuer die Migrationsphase
- Portal-Aenderungen: Login-Button, Redirects, Registrierungsfrage, Passkey-Formular (Anpassungen sind geringfuegig)
- Entschluesselung der Tokenstruktur (Mapping des geschuetzten Bereichs)
- Reaktivierungsprozess fuer Gruppe B (F-12) als Prozessdefinition
- Betriebsfaehigkeit bis 2026-12-31 (Verfügbarkeit)
- **Betrieb der Keycloak-Instanz** (Installation, Updates, Backup, Monitoring, Restore) — durch dieses Projekt (N-08)

### Ausserhalb des Scope
| Ausgeschlossen | Wer verantwortet |
|---|---|
| Adesso-Login | bleibt unveraendert bestehen (OQ-10) |
| Kommunikation an Endnutzer (Brief/E-Mail) | Auftraggeber, manuell |
| Neue Portal-Funktionalitaet, neue Entitelements, Portal-Datenmigration | niemand |
| Geraete-Verwaltung, MDM, kontrollierte Browser fuer Endnutzer | niemand |
| Fachliche Betreuung der Endnutzer (Support-Hotline, Hilfestellung bei Passkey-Problemen) | niemand (OQ-18) |
| Vollstaendiger Ausbau einer mobilen Passkey-Loesung | spaeter |
| Recovery-Pfad fuer Gruppe A | bewusst nicht |
| Betrieb/Updates/Backups der Endproduktions-Instanz | **ungeplant (OQ-05)** |

## 7. Abhaengigkeiten von Dritten

| Nr. | Abhaengigkeit | Owner | Status |
|---|---|---|---|
| **A-01** | Verifi-Verfuegbarkeit bis 2026-12-31 | Verifi | zugesagt |
| **A-02** | Brief- und E-Mail-Kampagne fuer alle Endnutzer | **Auftraggeber** | manuell, zusage |
| **A-03** | Manueller Schalter in 2027 (Person, Ort, Schichten) | **Auftraggeber** | **ungeplant** |
| **A-04** | ~~IT-Betrieb der Keycloak-Instanz~~ | **dieses Projekt** | uebernommen (N-08) |
| **A-05** | Zusagen der Verkuenferin zum Abschalttermin / Rueckfallrecht | offen | zu klaeren |
| **A-06** | Genuegender Speicherplatz und Backup-Kapazitaet fuer Keycloak auf der Ziel-Plattform | Betrieb | offen (OQ-04) |

## 8. Annahmen (nicht bestaetigt, korrigierbar)

| Nr. | Annahme |
|---|---|
| **AS-01** | ~~Verifi liefert eine eindeutige, nicht erratbare interne ID~~ → **BESTAETIGT (OQ-01, 2026-10-05).** Die Vorabregistrierung eines Passkeys durch einen Dritten ist damit ausgeschlossen. |
| **AS-02** | Keycloak uebernimmt die Identitaetsdaten (Username, Name, ggf. E-Mail, Kundennummer) als neuen führenden Speicher. |
| **AS-03** | Das Portal hat **keine eigene User-Datenbank**; Verimi wird nur als "Tuerwächter" genutzt. |
| **AS-04** | Adesso-Login bleibt parallel bestehen und wird nicht angefasst. |
| **AS-05** | Registrierungen verteilen sich gleichmaessig ueber die Migrationsphase. |
| **AS-06** | Der Browser muss WebAuthn unterstuetzen; keine Alt- oder Verwaltungsumgebungen. |
| **AS-07** | Das Endprodukt laeuft ebenfalls on-premise (Uebernahme aus dem Prototyp). Hostingform und Verfuegbarkeitsziel sind noch offen (OQ-04, OQ-06). |
| **AS-08** | 100 % Migrationsquote bezieht sich auf die **registrierungsfaehige** Gruppe A (max. 80.000), nicht auf alle 120.000 Endnutzer. Siehe R-01. |

## 9. Annahmekriterien

### Prototyp
| Nr. | Kriterium | Nachweis |
|---|---|---|
| **AK-01** | Ein Test-User durchlaeuft Migration und kann sich danach mit Passkey anmelden. | Testprotokoll |
| **AK-02** | Ein Test-User lehnt die Registrierung ab und erreicht trotzdem den geschuetzten Bereich. | Testprotokoll |
| **AK-03** | Ein Test-User registriert sich zweimal; der zweite Login über Verimi führt direkt in den geschützten Bereich (keine erneute Passkey-Abfrage). Die Anmeldung mit dem registrierten Passkey wird über den Einstieg „Passkey Login“ bzw. in Phase 2 nachgewiesen. *(Änderung 2026-10-08.)* | Testprotokoll |
| **AK-04** | Identitaetsdaten werden aus dem Verimi-Mock vorbefuellt uebernommen. | Testprotokoll |
| **AK-05** | Passkey funktioniert auf Desktop-Browsern; Mobil ist nicht getestet (dokumentierte Luecke). | Testprotokoll |

### Endprodukt
| Nr. | Kriterium | Nachweis |
|---|---|---|
| **AK-06** | Am 2027-01-01 ist kein Login mehr ueber Verimi erforderlich. | Produktivtest |
| **AK-07** | Der geschuetzte Portalbereich wird nur mit gueltigem Keycloak-Token betreten. | Code-Review + Test |
| **AK-08** | Ein nicht migrierter User wird am 2027-01-01 korrekt gesperrt. | Produktivtest |
| **AK-09** | Fuer Gruppe B existiert am 2027-01-01 ein dokumentierter, einsatzbereiter Reaktivierungsprozess. | Prozessdokument |
| **AK-10** | Rueckfall auf Verimi ist bis 2026-12-31 jederzeit moeglich. | Testprotokoll |
| **AK-11** | Backup und Restore der Keycloak-Identitaetsdaten wurden erfolgreich getestet; Wiederherstellungszeit gemessen. | Restore-Protokoll (N-09) |
| **AK-12** | Alle drei migrierten Felder (Name, Vorname, E-Mail) werden korrekt und ohne Nacharbeit uebernommen. | Datenabgleich Stichprobe |
| **AK-13** | Keycloak ist der einzige Speicherort der Identitaetsdaten; kein verbleibender Verifi-Abruf im Regelbetrieb. | Code-Review + Netzwerzanalyse |
| **AK-14** | Migrationsquote ist messbar erhoben und wird woechentlich berichtet. | Report (OQ-11) |
