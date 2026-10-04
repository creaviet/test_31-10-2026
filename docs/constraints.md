# Randbedingungen

Quelle: `idea.md`, bestaetigte Klaerungen vom 2026-10-05.
Alles Nichtbestaetigte ist als **Annahme** markiert.

## C-01 — Zeitplan (interne Ziele, kein Vertragsdatum)

| Datum | Ereignis | Art |
|---|---|---|
| 2026-10-19 | Prototyp fertig (2 Wochen ab Projektstart) | internes Ziel |
| 2026-10-31 | Loesung fertig und getestet | internes Ziel |
| 2026-12-31 | Verimi betreibt, letzte Chance zur Migration | **extern, fix** |
| 2027-01-01 | Verimi abgeschaltet, Passkey-Login gilt | **extern, fix** |

- Der Projektträger ist Entscheider bei Verzoegerungen.
- **Rueckfallebene:** Verimi bleibt bis 2026-12-31 als Login verfuegbar. Wird
  das interne Ziel 2026-10-31 gerissen, entsteht kein Projektschaden.
- Die Fristen sind keine Compliance-Frist. Sie ergeben sich aus dem
  Abschalttermin des Providers.

## C-02 — Betrieb und Hosting

| Merkmal | Wert |
|---|---|
| Prototyp | on-premise |
| Endprodukt | on-premise (Uebernahme aus dem Prototyp, **Annahme AS-07**); Hosting-Plattform **offen (OQ-04)** |
| Betriebsverantwortung (Installation, Updates, Backup, Monitoring, Restore) | **dieses Projekt** (bestaetigt 2026-10-05, N-08) |

## C-03 — Last

| Merkmal | Wert |
|---|---|
| Logins pro Monat | 500 – 1.000 |
| Registrierungen in der Migrationsphase | ~80.000 ueber 3 Monate (~900/Tag) — Annahme, gleichmaessig verteilt |
| Verfuegbarkeitsziel | **nicht definiert (OQ-06)** |

## C-04 — Geraete und Browser

| Merkmal | Wert |
|---|---|
| Mobile Geraete | **ausgeschlossen** (Entscheidung des Auftraggebers) |
| Desktop-Browser | aktuelle Versionen von Chrome, Edge, Safari, Firefox auf Windows und macOS (Annahme) |
| Kein kontrollierter Geraetepool | vom Auftraggeber bestaetigt |
| Folgen | Geraeteverlust = endgueltiger Verlust des Accounts fuer Gruppe A |

## C-05 — Rechtliches

| Merkmal | Wert |
|---|---|
| Identitaetsnachweis ist gesetzlich vorgeschrieben | **nein** (bestaetigt) |
| Konsequenz | Ausschluss der Gruppe C und fehlender Recovery-Weg sind geschaeftliche, nicht rechtliche Entscheidungen |
| Offen | Vertrags-/Verbraucherschutzfragen bei pauschalem Ausschluss nach Nationalitaet sind nicht geprueft (siehe R-02) |

## C-06 — Datenschutz

| Merkmal | Wert |
|---|---|
| Personenbezogene Daten in Keycloak | Keycloak wird neuer Speicherort der Identitaetsdaten (Annahme, siehe OQ-07) |
| Vertragsverarbeitung (AVV) fuer den neuen Speicherort | **ungeprueft (OQ-08)** |
| Aufbewahrung nach Abschaltung | **offen (OQ-09)** |

## C-07 — Identitaetsdaten (bestaetigt 2026-10-05)

| Merkmal | Wert |
|---|---|
| Migrierte Felder | **Name, Vorname, E-Mail** |
| Nicht migriert | Kundennummer, Ausweisdaten, Adesso-Verknuepfung, Verifi-interne Metadaten |
| Speicherort nach 2027-01-01 | ausschliesslich Keycloak |
| Aenderbarkeit durch den User | **offen (OQ-17)** |
| Folge | Es existiert keine unaenderbare Verknuepfung Account <-> Portal-Stammdaten (R-11) |

## C-08 — Technologie

| Merkmal | Wert |
|---|---|
| Identity Provider | Keycloak |
| Second Factor / Credential | Passkey (WebAuthn) |
| Passkey ist der einzige Credential nach 2027-01-01 | ja |
| Recovery-Credential | **nicht vorhanden** (Entscheidung des Auftraggebers) |
| Zusaetzlicher Login via Adesso | **wird nicht ersetzt**, bleibt unveraendert (Annahme, siehe OQ-10) |
