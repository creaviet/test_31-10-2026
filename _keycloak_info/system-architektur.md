# System-Architektur

## Datenquellen

- **SAP** (Stammdaten) (vgv) → täglich gesynct → **SQL(vgv)**

## Backup & Cloud-Infrastruktur

- **Backup** (Kreis)
- **AWS von "just relate"** (Container)
  - **EC2**
  - **API**

## Backend

- **BE** (AWS+ASP.NET+REST.API+SQL)

## Frontend

- **FE** (scrivito)

## Login-Systeme

- **verimi** (einloggen) – *Verimi soll ersetzt werden*
- **Adesso** (einloggen)

## Zielgruppe

- **Browser** (Client) – 500-1000 User/Monat

## Datenfluss

1. SAP (Stammdaten) wird täglich nach SQL(vgv) gesynct
2. SQL(vgv) → Backup
3. Backup → AWS (EC2 + API)
4. AWS API → BE (Backend)
5. BE → FE (Frontend)
6. FE → verimi / Adesso (Login)
7. verimi / Adesso → Browser (Client)
