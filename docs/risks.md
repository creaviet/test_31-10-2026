# Risikoregister

Stand: 2026-10-05 · Quelle: `idea.md` + bestaetigte Klaerungen
Einstufung: W = Wahrscheinlichkeit, A = Auswirkung (1 = gering, 5 = hoch)

---

## R-01 — Dauerhafter Verlust des Portalzugangs fuer ca. 40.000 Nicht-Migrierende

| Feld | Wert |
|---|---|
| W / A | 4 / 5 |
| Betroffen | Gruppe C (~Nicht-EU-Reisepass), bei Vollverfehlung ggf. Gruppe B |
| Ursache | Kein Credential, kein Recovery, keine Alternative nach 2027-01-01 |
| Getroffene Massnahme | bewusst akzeptiert (Entscheidung Projektträger) |
| **Offen** | Wie viele User werden die Migration verpassen? Bei 40.000 Verlorenen ist dies ein Geschaeftsschaden, kein Randproblem. |

> Festgelegtes Abnahmeziel (OQ-11): **100 %**. Siehe R-01a — dieser Wert ist mit
> der freigegebenen Loesung nicht erreichbar.

> Empfehlung: Der Projektträger haelt einen **Mindestmigrationswert** fest
> (z. B. 95 % von 80.000) und verlangt einen Massnahmenplan, falls er
> unterschritten wird. Ohne Zielwert gibt es keine Definitions of Done.

---

## R-02 — Pauschaler Ausschluss nach Nationalitaet

| Feld | Wert |
|---|---|
| W / A | 2 / 4 |
| Ursache | Gruppe C wird ueber die Kategorie Reisepass ausgeschlossen, nicht ueber eine beobachtete Sicherheitseigenschaft |
| Hinweis | Der Auftraggeber fuehrt **keine gesetzliche** Verifikationspflicht an. Damit ist die Ungleichbehandlung nicht durch Rechtszwang gedeckt. Verbraucherschutz-/Diskriminierungsfragen sind ungeprueft. |
| Empfehlung | Kurze rechtliche Pruefung der Formulierung "Nicht-EU-Reisepass" vs. "keine Identitaetspruefung moeglich" durch die Rechtsabteilung |

---

## R-03 — Account-Takeover ueber die Identitaetsverknuepfung — **ENTSCHAERFT**

| Feld | Wert |
|---|---|
| W / A | 1 / 5 |
| Ursache (urspruenglich) | Der Passkey wird an die Verifi-Aussage der ersten Anmeldung gebunden. Bei erratbarer Kennung (z. B. Name + Geburtsdatum) koennte ein Dritter den Passkey eines Kunden vorabregistrieren. |
| Status | **Geloest (OQ-01, 2026-10-05):** Verifi liefert eine interne, eindeutige und nicht erratbare ID. Eine Vorabregistrierung durch Dritte ist damit ausgeschlossen. |
| Restrisiko | Ein Nutzer kann seinen Passkey auf jedem Geraet registrieren, das er besitzt. Ohne Recovery (F-14) ist das ein dauerhafter Zustand, kein Fehler. Verbleib bei R-04. |

---

## R-04 — Kein Recovery-Weg bei Geraeteverlust

| Feld | Wert |
|---|---|
| W / A | 4 / 4 |
| Betroffen | Gruppe A (bis 80.000) |
| Ursache | Passkey ist an ein Geraet gebunden; kein alternatives Credential, kein Recovery (F-13, F-14) |
| Folge | Geraeteverlust = endgueltiger Zugangsverlust. Bei 500–1.000 Logins/Monat und niedrigerer Frequenz ist die Gesamtwirkung begrenzt, aber pro Einzelfall absolut. |
| Empfehlung | Zumindest **ein** standardmaessiger Wiederherstellungsprozess fuer Gruppe A vorbereiten, auch wenn er nicht im Endprodukt liegt (analog F-12). Sonst Support-Anfragen ohne Antwort. |

---

## R-05 — Manuelle Reaktivierung fuer Gruppe B existiert am Stichtag nicht

| Feld | Wert |
|---|---|
| W / A | 3 / 4 |
| Ursache | F-12 setzt Personal, Ort, Bereitschaft und eine authentifizierte Registrierungssession voraus — heute nicht geplant (A-03) |
| Warnung | "Ausreichend informiert per Brief und E-Mail" ist **kein** Prozess. Wer informiert 40.000 User nicht, erfasst die Rueckmeldungen und fuehrt die Schalter? |
| Massnahme | Prozessverantwortlichen benennen, bevor die Kampagne startet |

---

## R-06 — Nicht kontrollierte Geraeteumgebung

| Feld | Wert |
|---|---|
| W / A | 3 / 3 |
| Ursache | WebAuthN/Passkey-Abfrage unterstuetzt keine Browser ohne Passkey-Unterstuetzung, keine Altbetriebssysteme, kein Gast-WiFi ohne sichere Kontextbedingungen |
| Folge | Teil der Gruppe A wird trotz Registrierungsversuch nicht in der Lage sein, sich anzumelden — ein Fehler, den man erst nach der Sperrung bemerkt. |
| Empfehlung | **Vor** der Abschaltung einen Erreichbarkeitstest durchfuehren: Stichprobe ueber alle registrierten User, Passkey-Login gegenpruefen, nicht-migrierungsfaehige User aktiv zurueckrufen |

---

## R-07 — Betrieb ohne definiertes Ziel

| Feld | Wert |
|---|---|
| W / A | 3 / 4 |
| Ursache | On-Premise-Keycloak ohne definiertes Verfuegbarkeitsziel (OQ-06) und ohne definierte Hosting-Plattform (OQ-04) |
| Aenderung | Der Betrieb ist jetzt **in diesem Projekt** (N-08, OQ-05 bestaetigt). Das beseitigt die Verantwortungsluecke, nicht die fehlenden Zielwerte. |
| Folge | Ausfall = Login-Ausfall fuer alle 120.000. Bei 500–1.000 Logins/Monat ist die Reserve fuer Wiederherstellung hoch — sofern getestet. |
| Massnahme | AK-11: Backup/Restore vor Produktivgang nachweisen. OQ-04 und OQ-06 bis 2026-11-15 klaeren. |

---

## R-08 — Zu geringe Migrationsquote

| Feld | Wert |
|---|---|
| W / A | 3 / 4 |
| Ursache | 120.000 User, geringe technische Affinitaet, kein Kontrollgeraet; mehrfacher Kontakt ueber Brief und E-Mail bei 30 % Auslandsanteil |
| Empfehlung | Mindestwert definieren (siehe R-01), Fortschritt messbar machen (Registrierungsquote je Woche), Eskalationsschwelle setzen |

---

## R-09 — Zeitplan trotz Rueckfallgedanken realistisch bewerten

| Feld | Wert |
|---|---|
| W / A | 2 / 3 |
| Einordnung | Der 2026-10-31 Termin ist ein internes Ziel, Verimi bleibt bis 31.12.2026 Rueckfall. Ein Verzug bis Dezember ist verkraftbar. |
| Gegenmassnahme | Phasen als "sperrreif" kennzeichnen: welche Funktion muss bis wann stehen, damit ein Umlagern in den Dezember ohne Neustart moeglich ist |

---

## R-10 — Unbekannte Ausdehnung der Gruppe B

| Feld | Wert |
|---|---|
| W / A | 3 / 3 |
| Ursache | Der Anteil EU-Reisepass an den 40.000 ist unbekannt (OQ-02). Damit ist auch die Menge fuer den manuellen Prozess unbekannt. |
| Folgewirkung | Kapazitaetsplanung des Schalters (R-05) beruht auf einer unbekannten Zahl |


---

## R-11 — Keine stabile Verknuepfung zwischen Keycloak-Account und Portal-Stammdaten

| Feld | Wert |
|---|---|
| W / A | 3 / 4 |
| Ursache | Migriert werden nur **Name, Vorname, E-Mail** (F-15). Es gibt **keine Kundennummer** im Keycloak-Account (F-17) und damit kein vom User nicht aenderbares Schluesselmerkmal. |
| Folge | Wird die E-Mail-Adresse im Keycloak-Account geaendert, ist der Account nicht mehr zweifelsfrei einem Portal-Stammdatensatz zuzuordnen. Bei 120.000 Usern und hoher E-Mail-Aenderung (Umzug, Firmenwechsel, Tippfehler) ist das ein realistischer, schleichender Datenfehler. |
| Empfehlung | Festlegen, ob Name/Vorname/E-Mail nach der Registrierung ueberhaupt noch editierbar sind (OQ-17). Empfehlung: E-Mail aendern nur mit erneuter Verifi-Bestaetigung oder gar nicht. |

---

## R-12 — Supportbelastung durch nicht funktionierende Passkeys

| Feld | Wert |
|---|---|
| W / A | 4 / 3 |
| Ursache | Passkeys setzt unterstuetzte Browser, sichere Kontexte und ungestoerte Geraete voraus. Ein Teil der Registrierungen wird technisch erfolgreich, aber praktisch unbenutzbar sein (R-06). |
| Folge | Diese Faelle fallen erst **nach** dem 31.12.2026 auf, wenn die Sperrung greift — dann ist Verifi bereits weg und Gruppe A hat keinen Recovery-Weg. |
| Empfehlung | Erreichbarkeitstest vor der Abschaltung (OQ-16) ist die einzige wirksame Massnahme. Fachliche Supportverantwortung ist derzeit niemandem zugewiesen (OQ-18). |

---

## R-13 — Kein Verfuegbarkeits- und Wiederherstellungsziel

| Feld | Wert |
|---|---|
| W / A | 3 / 3 |
| Ursache | Weder Hostingform (OQ-04) noch Verfuegbarkeitsziel (OQ-06) noch Wiederherstellungszeit sind definiert. Bei uebernommenem Betrieb (N-08) ist damit auch die Priorisierung des Betriebs unbestimmt. |
| Empfehlung | Bei 500–1.000 Logins/Monat reicht bewusst eine einfache Konfiguration. **Ein** gemessener Restore-Nachweis (AK-11) ist ausreichend; Hochverfuegbarkeit ist vorerst nicht erforderlich. Das sollte explizit als Entscheidung festgehalten werden, damit HA nicht spaeter als ungeplanter Umfang auftaucht. |


Mögliche IT Security risks:
- bfcache zeigt geschützte Bereich, wenn man in die Historie zurück geht
- SSO-Relogin ohne Credentials
- OIDC logout 