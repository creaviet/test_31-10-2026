/**
 * Session-Verwaltung (T-03): Server-seitige Sessions im Speicher.
 *
 * Regel (T-03-Entscheidung): Die authentifizierte Session ist **15 Minuten gültig**
 * (absolute Laufzeit ab Erstellung). Danach: 401 und zurück zum Login-Einstieg.
 * Die Session ist fest an die Verifi-Kennung gebunden (kein Identitätswechsel).
 *
 * Prototyp-Hinweis: In-Memory-Speicher (keine Portal-DB-Entity laut Spec).
 * Bei Neustart des Portal-Mock verlieren alle Nutzer ihre Session — im Prototyp
 * akzeptiert, im Produktivbetrieb durch eine echte Session-Komponente zu ersetzen.
 */
import { randomBytes } from 'node:crypto';
import { cfg } from './config.js';

const sessions = new Map();

function newSession(verifiId, prefill) {
  const now = Date.now();
  return {
    sid: randomBytes(32).toString('hex'),
    verifiId,
    prefill, // { first_name, last_name, email } — nur transient, nie in der DB
    createdAt: now,
    expiresAt: now + cfg.sessionTtlMs,
    decision: null, // 'no' | 'yes'
    passkeyAuth: false, // Token-/Passkey-nachgewiesen
    kcAuth: null, // laufender Keycloak-Vorgang { context, verifier, kcUserId, registrationId }
    blockedLogged: false,
  };
}

export function createSession(verifiId, prefill) {
  const s = newSession(verifiId, prefill);
  sessions.set(s.sid, s);
  return s;
}

export function getSession(sid) {
  if (!sid) return null;
  const s = sessions.get(sid);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    sessions.delete(sid);
    return null;
  }
  return s;
}

export function deleteSession(sid) {
  if (sid) sessions.delete(sid);
}

export function sessionCount() {
  return sessions.size;
}

// Aufräumen abgelaufener Sessions (kein Timer-Leak).
setInterval(() => {
  const now = Date.now();
  for (const [sid, s] of sessions) {
    if (now > s.expiresAt) sessions.delete(sid);
  }
}, 60_000).unref();