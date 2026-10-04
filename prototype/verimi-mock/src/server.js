/**
 * Verimi-Mock — nachgestellte Anmeldung nach dem "alten Weg" (Phase 1).
 *
 * Prototyp-Komponente (intent.md C-P.2): Es gibt genau EINE Konfigurationsvariable,
 * über die spätestens das echte Verimi eingesetzt wird:
 *   PORTAL_CALLBACK_URL  = Ziel der Rückleitung ans Portal.
 *
 * Verhalten:
 *  - GET /login          → Anmeldeformular (Benutzername/Passwort der Test-User)
 *  - POST /login         → Prüfung und Rückleitung an PORTAL_CALLBACK_URL
 *  - GET /               → wenn im Mock bereits angemeldet: sofortige Rückleitung
 *                          (wie SSO — zweiter Login "fragt nicht erneut ab", AC-P3)
 *
 * Die Rückleitung enthält die eindeutige, nicht erratbare Verifi-Kennung
 * (T-01-Entscheidung: 128-Bit-Zufallswert) und die drei Identitätsfelder.
 * Die Parameter sind HMAC-signiert, damit die Kennung "gut geschützt"
 * transportiert wird (T-01-Antwort). Das ist die Mock-Entsprechung zum
 * Signatur-/Claims-Mechanismus des echten Verimi.
 *
 * Keine echten Nutzerdaten, keine Passkeys, keine Registrierung (C-P.2).
 */
import http from 'node:http';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
/** Die EINE variable für Mock ↔ echt (T-08/AC-P7, T-30). */
const PORTAL_CALLBACK_URL =
  process.env.PORTAL_CALLBACK_URL || 'http://localhost:8080/api/auth/verimi/callback';
/** Erlaubter Rückleitungs-Origin für den Logout (kein offener Redirect). */
const PORTAL_ORIGIN = new URL(PORTAL_CALLBACK_URL).origin;
const HMAC_SECRET = process.env.HMAC_SECRET || 'verimi-mock-dev-secret';
const USER_FILE =
  process.env.USER_FILE || path.join(__dirname, '..', '..', 'shared', 'users.json');
const COOKIE = 'verimi_sid';
const SESSION_MAX_AGE = 3600; // Mock-Session 1 h, nur für den "SSO"-Eindruck

const users = JSON.parse(readFileSync(USER_FILE, 'utf8')).list;
const usersByUsername = new Map(users.map((u) => [u.username, u]));

/** Signatur über alle Rückkehr-Parameter (feste Reihenfolge, vgl. Portal). */
function buildSig(ts, verifiId, first, last, email) {
  const data = [ts, verifiId, first, last, email].join('.');
  return createHmac('sha256', HMAC_SECRET).update(data).digest('hex');
}

function callbackUrl(user) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const u = new URL(PORTAL_CALLBACK_URL);
  u.searchParams.set('verifi_id', user.verifi_id);
  u.searchParams.set('first_name', user.first_name);
  u.searchParams.set('last_name', user.last_name);
  u.searchParams.set('email', user.email);
  u.searchParams.set('ts', ts);
  u.searchParams.set(
    'sig',
    buildSig(ts, user.verifi_id, user.first_name, user.last_name, user.email)
  );
  return u.toString();
}

function esc(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const LOGIN_PAGE = (error) => `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Anmeldung — Verimi-Mock</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;color:#1a1a1a}
    h1{font-size:1.4rem}
    label{display:block;margin-top:1rem;font-weight:600}
    input{width:100%;padding:.5rem;margin-top:.25rem;border:1px solid #666;border-radius:4px}
    button{margin-top:1.5rem;padding:.6rem 1.4rem;border:0;border-radius:4px;background:#0b57d0;color:#fff;font-size:1rem}
    .err{color:#a11515;border:1px solid #a11515;padding:.6rem;border-radius:4px}
    .badge{margin-top:.5rem;font-size:.8rem;color:#555}
  </style>
</head>
<body>
  <h1>Anmeldung (Verimi-Mock)</h1>
  ${error ? '<p class="err" role="alert">Die Anmeldung war nicht erfolgreich. Bitte versuchen Sie es erneut.</p>' : ''}
  <form method="post" action="/login">
    <label for="username">Benutzername</label>
    <input id="username" name="username" autocomplete="username" required autofocus>
    <label for="password">Passwort</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <button type="submit">Anmelden</button>
  </form>
  <p class="badge">Prototyp: Test-User aus shared/users.json (z.&nbsp;B. erika / test).</p>
</body>
</html>`;

function readCookies(req) {
  const out = {};
  const h = req.headers.cookie;
  if (!h) return out;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
}

function redirect(res, location) {
  send(res, 302, '', { location });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      const params = new URLSearchParams(data);
      resolve({ username: params.get('username') ?? '', password: params.get('password') ?? '' });
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, PUBLIC_BASE_URL);
  const cookies = readCookies(req);
  const current = usersByUsername.get(cookies[COOKIE]);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/login')) {
    // Bereits im Mock angemeldet → sofortige Rückleitung (SSO-Effekt, AC-P3).
    if (current) return redirect(res, callbackUrl(current));
    return send(res, 200, LOGIN_PAGE(url.pathname === '/login' ? url.searchParams.get('e') === '1' : false));
  }

  if (req.method === 'POST' && url.pathname === '/login') {
    const { username, password } = await parseBody(req);
    const user = usersByUsername.get(username);
    // Mock-Anmeldung: Klartext-Passwortvergleich reicht (Prototyp, keine realen Daten).
    const valid = !!user && password === user.password;
    if (!valid) return redirect(res, '/login?e=1');
    send(res, 302, '', {
      location: callbackUrl(user),
      'set-cookie': `${COOKIE}=${encodeURIComponent(user.username)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`,
    });
    return;
  }

  // Logout: SSO-Session des Mocks beenden (Portal-Logout, Issue 2). Rückleitung
  // NUR an den Portal-Origin (kein offener Redirect via `redirect`-Parameter).
  if (req.method === 'GET' && url.pathname === '/logout') {
    const requested = url.searchParams.get('redirect');
    let location = `${PORTAL_ORIGIN}/`;
    if (requested) {
      try {
        const u = new URL(requested);
        if (u.origin === PORTAL_ORIGIN) location = u.toString();
      } catch {
        /* ungültiges Ziel ignorieren → Standard-Rückleitung */
      }
    }
    send(res, 302, '', {
      location,
      'set-cookie': `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    });
    return;
  }

  send(res, 404, '<h1>404</h1><p>Gibt es hier nicht — Verimi-Mock (Prototyp).</p>');
});

server.listen(PORT, () => {
  console.log(`[verimi-mock] läuft auf ${PUBLIC_BASE_URL}`);
  console.log(`[verimi-mock] Rückleitung an: ${PORTAL_CALLBACK_URL}`);
  console.log(`[verimi-mock] Test-User: ${users.map((u) => u.username).join(', ')}`);
});