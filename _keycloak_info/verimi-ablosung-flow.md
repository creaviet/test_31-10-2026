# Konzept Ablösung von Verimi

## Gültig bis zum 31.12.2026

## Ablauf

1. **Verimi** (einloggen)
2. **email**
3. **Passwort**
4. **Zweige:**
   - **Email**
   - **SMS**
5. **Verifizierung verimi**
6. **Keycloak**
7. **Ist schon in der KeyCloak DB?**
   - **Ja** → **Portal** (bei erfolgreicher Verifizierung weitergeleitet)
   - **Nein** → **Registrieren in der KeyCloak DB** → **Portal**

## Wichtige Hinweise

- Nach einer frischen Verimi-Anmeldung wird die Einrichtung angeboten
- Der bestehende Mitgliedsbezug wird übernommen
- Ein Abbruch verändert den bisherigen Zugang nicht

## Komponenten

- **Verimi**: Bisheriges Login-System
- **Keycloak**: Neue Authentifizierungs-Plattform
- **KeyCloak DB**: Benutzerdatenbank
- **Portal**: Ziel-Anwendung
