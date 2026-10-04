/**
 * Schnell-Smoke-Test für den Prototyp (nativ oder per Docker).
 * Prüft: API-01, Verimi-Login-Rückleitung (echte Mock-Signatur), API-02 in
 * beiden Modi (Browser-302 / JSON), vorbefüllte Session, R-OPS-Admin (API-05/06).
 */
import { createHmac } from 'node:crypto';

const P = 'http://localhost:8080';
const V = 'http://localhost:8081';
const KC = 'http://localhost:8082';
const REALM = 'passkey-prototyp';
const OPS = 'dev-rops-token';
// Erika-verifi_id aus shared/users.json (Test-User im Keycloak)
const ERIKA_VERIFI_ID = '4f7a2c91b6d34e8fa50c1d2e3b4a5c6d';

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) failed += 1;
};

// --- Zustands-Reset: Erika darf für den Smoke KEINEN Passkey haben ----------
// (sonst landet der Verimi-Callback im Verify-Pfad statt in der Frage — das
// wäre ein State-Artefakt aus vorherigen E2E-Läufen, keine echte Regression).
async function kcAdminToken() {
  const res = await fetch(`${KC}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: 'admin',
      password: 'admin',
    }),
  });
  if (!res.ok) throw new Error(`KC-Admin-Token: ${res.status}`);
  return (await res.json()).access_token;
}

async function resetErikaPasskeys() {
  const tok = await kcAdminToken();
  const H = { authorization: `Bearer ${tok}`, 'content-type': 'application/json' };
  const users = await (
    await fetch(`${KC}/admin/realms/${REALM}/users?username=${encodeURIComponent(ERIKA_VERIFI_ID)}&exact=true`, { headers: H })
  ).json();
  const u = users?.[0];
  if (!u) return;
  const creds = await (
    await fetch(`${KC}/admin/realms/${REALM}/users/${u.id}/credentials`, { headers: H })
  ).json();
  for (const c of creds ?? []) {
    if (String(c.type).startsWith('webauthn')) {
      await fetch(`${KC}/admin/realms/${REALM}/users/${u.id}/credentials/${c.id}`, {
        method: 'DELETE',
        headers: H,
      });
    }
  }
  const full = await (
    await fetch(`${KC}/admin/realms/${REALM}/users/${u.id}`, { headers: H })
  ).json();
  full.requiredActions = (full.requiredActions ?? []).filter(
    (a) => a !== 'webauthn-register-passwordless'
  );
  if (full.attributes) delete full.attributes.passkey_registered;
  await fetch(`${KC}/admin/realms/${REALM}/users/${u.id}`, {
    method: 'PUT',
    headers: H,
    body: JSON.stringify(full),
  });
}

await resetErikaPasskeys();

// --- API-01 ---
const start = await (await fetch(`${P}/api/auth/start`)).json();
ok('API-01 Phase 1 + Verimi-Redirect', start.phase === 'phase1' && start.redirect_url === `${V}/login`, JSON.stringify(start));

// --- Verimi-Login (Mock generiert die HMAC-Signatur; Cookie-Session wie Browser) ---
const verimiLogin = await fetch(`${V}/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ username: 'erika', password: 'test' }),
  redirect: 'manual',
});
ok('Verimi-Login erika/test OK', verimiLogin.status === 302);
const callbackUrl = verimiLogin.headers.get('location');
ok('Rückleitung vorhanden', !!callbackUrl, callbackUrl?.slice(0, 60));

// --- API-02 als Browser-Navigation (Accept text/html) → Session + Weiterleitung ---
const nav = await fetch(callbackUrl, { redirect: 'manual', headers: { accept: 'text/html' } });
const setCookie = nav.headers.get('set-cookie');
ok('API-02 (Browser): 302 + Session-Cookie', nav.status === 302 && /portal_sid=([^;]+)/.test(setCookie), `Code ${nav.status}, Cookie vorhanden`);
const sid = /portal_sid=([^;]+)/.exec(setCookie)?.[1];
const target = nav.headers.get('location');
ok('API-02 (Browser): → Registrierungsfrage (kein Passkey)', target?.includes('v=question'), target);

// --- Prefill über Session ---
const prefill = await (await fetch(`${P}/api/auth/prefill`, { headers: { cookie: `portal_sid=${sid}` } })).json();
ok('Prefill aus Session', prefill.prefill?.first_name === 'Erika', JSON.stringify(prefill.prefill));

// --- API-02 als JSON-Aufruf (zweiter Login-Look) ---
const jsonCall = await fetch(callbackUrl, {
  redirect: 'manual',
  headers: { accept: 'application/json', cookie: `portal_sid=${sid}` },
});
const jsonBody = await jsonCall.json();
ok('API-02 (JSON): passkey_exists=false + prefill', jsonCall.status === 200 && jsonBody.passkey_exists === false && jsonBody.prefill?.email === 'erika@example.de');

// --- Ungültige Signatur → generische 400 (keine Existenzauskunft) ---
const badTs = Math.floor(Date.now() / 1000);
const badSig = createHmac('sha256', 'falsches-secret').update(`${badTs}.4f7a2c91b6d34e8fa50c1d2e3b4a5c6d.Erika.Mustermann.erika@example.de`).digest('hex');
const bad = await fetch(`${P}/api/auth/verimi/callback?verifi_id=4f7a2c91b6d34e8fa50c1d2e3b4a5c6d&first_name=Erika&last_name=Mustermann&email=erika@example.de&ts=${badTs}&sig=${badSig}`, { redirect: 'manual', headers: { accept: 'application/json' } });
ok('API-02 ungültige Signatur → 400 generisch', bad.status === 400);

// --- R-OPS: API-05 ---
const phase = await (await fetch(`${P}/api/admin/phase`, { headers: { authorization: `Bearer ${OPS}` } })).json();
ok('API-05 Phase lesen', phase.phase === 'phase1', JSON.stringify(phase));

// --- R-OPS: ohne Token → 401 ---
const noAuth = await fetch(`${P}/api/admin/phase`);
ok('API-05 ohne Token → 401', noAuth.status === 401);

// --- R-OPS: API-06 gleiche Phase → 409 ---
const samePhase = await fetch(`${P}/api/admin/phase`, {
  method: 'PUT',
  headers: { authorization: `Bearer ${OPS}`, 'content-type': 'application/json' },
  body: JSON.stringify({ phase: 'phase1', reason: 'Kein Wechsel, Test' }),
});
ok('API-06 gleiche Phase → 409', samePhase.status === 409);

// --- Ereignisprotokoll enthält den initialen Login-Fail (ungültige Signatur) ---
const events = await (await fetch(`${P}/api/admin/events`, { headers: { authorization: `Bearer ${OPS}` } })).json();
const invalidLogged = events.events.some((e) => e.event_type === 'login_failed' && /^[0-9a-f]{16}$/.test(e.reference ?? ''));
ok('Ereignisprotokoll: login_failed (ungültige Signatur, pseudonymisiert)', invalidLogged);

console.log(failed === 0 ? '\nALLE SMOKE-TESTS BESTANDEN ✅' : `\n${failed} FEHLER ❌`);
process.exit(failed === 0 ? 0 : 1);