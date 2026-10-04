# Offene Fragen

Stand: 2026-10-05 · Jede Frage mit Owner und "benoetigt bis".
Faelle mit hardem Datum sind im Projektplan blockierend.

| Nr. | Frage | Warum wichtig | Owner | Benoetigt bis |
|---|---|---|---|---|
| **OQ-01** | **Liefert Verifi pro User eine eindeutige, nicht erratbare interne ID? Was exakt liefert der Endpoint zurueck?** | Bestimmt, ob ein Dritter den Passkey eines Kunden vorabregistrieren kann (R-03) | Auftraggeber / Verifi-Schnittstelle | **vor Prototypabschluss** |
| **OQ-02** | Wieviele der ca. 40.000 Nicht-Migrierenden haben einen **EU**-Reisepass (= Groesse Gruppe B)? | Bestimmt Kapazitaet des manuellen Prozesses | Auftraggeber | 2026-11-30 |
| **OQ-03** | Wie wird fuer die manuelle Reaktivierung (F-12) eine authentifizierte Session erzeugt? Am Schalterterminal, mit Einmalcode, oder durch Vertrauen in die Reisepasspruefung? | Ohne authentifizierte Session ist keine Passkey-Registrierung moeglich | zusammen mit OQ-09 | 2026-12-15 |
| **OQ-04** | **Endprodukt-Hosting:** on-premise, gemietet oder als Dienst? | Betriebsverantwortung, Kosten, Verfuegbarkeit | Auftraggeber | 2026-11-15 |
| ~~OQ-05~~ | ~~Wer betreibt Keycloak im Regelbetrieb?~~ | **GELOEST 2026-10-05: dieses Projekt uebernimmt den Betrieb** (N-08). Neue Anforderungen: Restore-Nachweis (AK-11), Verantwortlicher benannt. | — | erledigt |
| **OQ-06** | **Verfuegbarkeitsziel** fuer den Portal-Login. Genuegt eine Instanz? | Bestimmt, ob Redundanz gebaut werden muss | Auftraggeber | mit OQ-04 |
| ~~OQ-07~~ | ~~fuehrt Keycloak nach der Migration die Identitaetsdaten?~~ | **GELOEST 2026-10-05: Name, Vorname, E-Mail.** Keine Kundennummer, keine weiteren Attribute. Neue Folgerungen: F-15…F-18, R-11. | — | erledigt |
| **OQ-17** | **Darf der User Name, Vorname und E-Mail im Keycloak-Account nach der Registrierung aendern?** Wenn ja: wie bleibt die Zuordnung zu den Portal-Stammdaten erhalten? | Ohne unaenderbare Kennung (keine Kundennummer) erzeugt jede E-Mail-Aenderung einen moeglicherweise falschen Datenbezug (R-11, F-16) | Auftraggeber | **vor Prototypabschluss** |
| **OQ-18** | **Wer bearbeitet Passkey-Supportfaelle fachlich?** (falscher Browser, Geraeteverlust, gescheiterte Registrierung) | Alle 120.000 landen irgendwann dort; derzeit ist niemand benannt (R-12) | Auftraggeber | 2026-11-30 |
| **OQ-08** | AVV / Datenschutzpruefung fuer den neuen Speicherort der Identitaetsdaten | Personenbezogene Daten wandern von Verifi in die eigene Loesung | Datenschutz | **vor Produktivgang** |
| **OQ-09** | Aufbewahrungsfrist und Loeschkonzept fuer Identitaetsdaten nach 31.12.2026 | Datenschutz | Datenschutz | 2026-12-31 |
| **OQ-10** | Bleibt der **Adesso-Login** parallel bestehen? Wer betreibt und dokumentiert ihn? | Betrifft nur das Onboarding neuer Portalnutzer | Auftraggeber | 2026-11-30 |
| **OQ-11** | ~~Wie viel Prozent Migrationsquote gelten als Erfolg?~~ | **TEILWEISE GELOEST 2026-10-05: 100 % gefordert.** **Konflikt:** 100 % aller 120.000 sind unerreichbar (max. 67 %). Zu klaeren ist, ob 100 % der Gruppe A gemeint ist (AS-08). Siehe R-01a — **blockierend** | Auftraggeber (Entscheider) | **2026-10-31** |
| **OQ-12** | Verfuegen 120.000 Endnutzer ueber Desktop-Browser? Wie viele nutzen das Portal ausschliesslich mobil? | "Mobil ausgeschlossen" schliesst diese User vollstaendig aus (R-06) | Auftraggeber | 2026-10-31 |
| **OQ-13** | Bestehen **Sessions** am 31.12.2026 weiter, oder ist eine erneute Anmeldung akzeptabel? | Bestimmt, ob Keycloak und Verimi parallel betrieben werden muessen | Auftraggeber | 2026-11-15 |
| **OQ-14** | Muss der manuelle Prozess (F-12) zeitlich befristet sein, und bis wann? | Sonst existiert er unbegrenzt ohne Vertrag | Auftraggeber | 2026-12-15 |
| **OQ-15** | Gibt es verbindliche Zusage der Verkuenferin ueber den Abschalttermin bzw. ein Rueckfallrecht? | Verlaesst sich die ganze Planung auf einen externen Termin | Auftraggeber | sofort |
| **OQ-16** | Wer kontaktiert aktiv User, deren registrierter Passkey nicht funktioniert (Erreichbarkeitstest)? | Verringert das Ausfallrisiko (R-06) | Auftraggeber | 2026-11-30 |

---

## Blockierende Fragen (Antwort fehlt fuer die weitere Arbeit)

| Nr. | Blockiert | Stand |
|---|---|---|
| **OQ-17** | Aenderbarkeit der migrierten Felder — bestimmt das Identitaetsdatenmodell | **neu, blockierend** |
| **OQ-11** | Abnahmekriterien des Projekts (100 % vs. 67 % max.) | **blockierend** |
| **OQ-03** | Machbarkeit des manuellen Reaktivierungsprozesses (F-12) | blockierend fuer F-12 |
| **OQ-04 / OQ-06** | Hosting-Plattform und Verfuegbarkeitsziel des Regelbetriebs | blockierend fuer AK-11 |

## Geloest

| Nr. | Ergebnis | Datum |
|---|---|---|
| OQ-01 | Verifi liefert eindeutige, nicht erratbare interne ID | 2026-10-05 |
| OQ-05 | Betrieb uebernimmt dieses Projekt | 2026-10-05 |
| OQ-07 | Migrierte Felder: Name, Vorname, E-Mail | 2026-10-05 |
| OQ-11 | Zielwert 100 % — als Konflikt dokumentiert, nicht geglaettet | 2026-10-05 |
