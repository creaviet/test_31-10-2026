/**
 * Portal-Datenbank (T-06).
 *
 * Entities: Ereignis-Protokoll (append-only), Erreichbarkeitstest-Ergebnis und
 * — seit ADR-001 (2026-10-09) — die Portal-Identität (Anzeigename). Die
 * Phasenkonfiguration liegt per T-02-Entscheidung in einer Konfigurationsdatei,
 * NICHT in der DB.
 *
 * Regeln:
 *  - Identitätsfelder (Nachname/Vorname/E-Mail) liegen seit ADR-001 zusätzlich
 *    in `portal_identity`. Das ist eine bewusste Abweichung von der früheren
 *    Regel "keine Identitätsfelder in der Portal-DB" (technical-spec §5 / DB-01 /
 *    NFR-DS-01). Grund: Der Anzeigename muss unabhängig vom Login-Weg sein und
 *    nicht am Verimi-Prefill hängen. Key bleibt pseudonymisiert (`reference`).
 *  - KEINE Geheimnisse, KEINE Token im Klartext.
 *  - reference = pseudonymisiert (SHA-256-Präfix der Verifi-Kennung).
 */
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Pseudonymisierte Referenz: 16 Hex-Zeichen = SHA-256-Präfix der Kennung. */
export function refOf(verifiId) {
  return createHash('sha256').update(String(verifiId)).digest('hex').slice(0, 16);
}

export function openDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS event_log (
      event_id    TEXT PRIMARY KEY,
      event_type  TEXT NOT NULL CHECK (event_type IN
        ('registration','login_success','login_failed','blocked','phase_change','ops_action')),
      occurred_at TEXT NOT NULL,
      result      TEXT NOT NULL CHECK (result IN ('success','failure')),
      reference   TEXT,
      detail      TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_event_log_type_time ON event_log (event_type, occurred_at);

    CREATE TABLE IF NOT EXISTS reachability_result (
      run_id         TEXT PRIMARY KEY,
      started_at     TEXT NOT NULL,
      finished_at    TEXT,
      checked_count  INTEGER,
      failed_json    TEXT
    );

    /* Portal-Identität (ADR-001): Anzeigename unabhängig vom Login-Weg.
       Key = pseudonymisierte Referenz (kein Klartext-Identifikator). */
    CREATE TABLE IF NOT EXISTS portal_identity (
      reference   TEXT PRIMARY KEY,
      first_name  TEXT NOT NULL,
      last_name   TEXT NOT NULL,
      email       TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
  `);
  return db;
}

/**
 * Portal-Identität schreiben/aktualisieren (ADR-001).
 * Wird bei erfolgreichem Login aufgerufen — sowohl aus dem Verimi-Weg (Name aus
 * der Verimi-Rückkehr) als auch aus dem Passkey-Weg (Name aus dem Keycloak-Profil).
 * Idempotenter Upsert => kein Identitätswechsel, nur Aktualisierung.
 */
export function upsertIdentity(db, { verifiId, firstName, lastName, email }) {
  db.prepare(
    `INSERT INTO portal_identity (reference, first_name, last_name, email, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(reference) DO UPDATE SET
       first_name = excluded.first_name,
       last_name  = excluded.last_name,
       email      = excluded.email,
       updated_at = excluded.updated_at`
  ).run(refOf(verifiId), firstName ?? '', lastName ?? '', email ?? '', new Date().toISOString());
}

/** Portal-Identität lesen (ADR-001). Liefert null, wenn kein Datensatz existiert. */
export function getIdentity(db, verifiId) {
  if (!verifiId) return null;
  return (
    db
      .prepare(`SELECT first_name, last_name, email FROM portal_identity WHERE reference = ?`)
      .get(refOf(verifiId)) ?? null
  );
}

export function logEvent(db, { eventType, result, reference = null, detail = null }) {
  const stmt = db.prepare(
    `INSERT INTO event_log (event_id, event_type, occurred_at, result, reference, detail)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  stmt.run(randomUUID(), eventType, new Date().toISOString(), result, reference, detail ?? null);
}

export function listEvents(db, { limit = 200 } = {}) {
  return db
    .prepare(`SELECT * FROM event_log ORDER BY occurred_at DESC LIMIT ?`)
    .all(limit);
}