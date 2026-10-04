/**
 * reset-demo-state.mjs — Setzt den Passkey-Zustand der Demo-User auf die
 * Baseline zurück (browserfrei, ausschließlich Keycloak-Admin-API).
 *
 * Baseline (shared/demo-baseline.json):
 *   erika → KEIN Passkey  (Registrierung/Frage-Demo)
 *   bob   → KEIN Passkey  (Frage-/Sperr-Demo)
 *   carol → MIT Passkey    (Demo "Nutzer hat bereits einen Passkey")
 *
 * Aufruf:      node scripts/reset-demo-state.mjs
 * Automatisch: stop-native.ps1 -Keycloak (vor dem Stoppen von Keycloak)
 *
 * Hintergrund / Workaround:
 *   Die Keycloak-Admin-API kann KEINE WebAuthn-Credentials anlegen
 *   (POST /users/{id}/credentials → 404). Carols Passkey wird daher über einen
 *   Partial-Import (ifResourceExists=OVERWRITE) aus dem Fixture
 *   `passkeyFixture` wiederhergestellt. Das importierte Credential ist bewusst
 *   NICHT authentifizierbar (kein privater Schlüssel hinterlegt) — es
 *   repräsentiert nur "Nutzer hat einen Passkey" und ist damit identisch zur
 *   bisherigen, manuell gesetzten Demo-Baseline.
 *
 * Env: KC_URL, KC_ADMIN_USER, KC_ADMIN_PASS, REALM, USER_FILE, BASELINE_FILE
 * Exit: 0 = Baseline hergestellt, 1 = mindestens eine Warnung (Stop läuft weiter).
 */
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const KC_URL = process.env.KC_URL || 'http://localhost:8082';
const KC_ADMIN_USER = process.env.KC_ADMIN_USER || 'admin';
const KC_ADMIN_PASS = process.env.KC_ADMIN_PASS || 'admin';
const REALM = process.env.REALM || 'passkey-prototyp';
const TIMEOUT_MS = Number(process.env.RESET_TIMEOUT_MS || 10000);
const USER_FILE =
  process.env.USER_FILE || fileURLToPath(new URL('../shared/users.json', import.meta.url));
const BASELINE_FILE =
  process.env.BASELINE_FILE || fileURLToPath(new URL('../shared/demo-baseline.json', import.meta.url));

const users = JSON.parse(readFileSync(USER_FILE, 'utf8')).list;
const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));

let problems = 0;
const log = (m) => console.log(`[reset] ${m}`);
const hasWebAuthn = (creds) =>
  Array.isArray(creds) && creds.some((c) => String(c.type || '').startsWith('webauthn'));

async function adminToken() {
  const res = await fetch(`${KC_URL}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: KC_ADMIN_USER,
      password: KC_ADMIN_PASS,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`KC-Admin-Token: HTTP ${res.status}`);
  return (await res.json()).access_token;
}

function api(token) {
  const H = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  return async (method, path, body) => {
    const res = await fetch(`${KC_URL}/admin/realms/${REALM}${path}`, {
      method,
      headers: H,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status} ${text.slice(0, 160)}`);
    return text ? JSON.parse(text) : null;
  };
}

/** Entfernt die Registrierungsmarker, damit der nächste Login wieder die Frage zeigt. */
async function clearRegistrationMarkers(call, userId) {
  const full = await call('GET', `/users/${userId}`);
  full.requiredActions = (full.requiredActions || []).filter(
    (a) => a !== 'webauthn-register-passwordless'
  );
  if (full.attributes) delete full.attributes.passkey_registered;
  await call('PUT', `/users/${userId}`, full);
}

/** Stellt carols Passkey über einen Partial-Import (OVERWRITE) wieder her. */
async function restorePasskeyFixture(call, userId) {
  if (!baseline.passkeyFixture) throw new Error('Kein passkeyFixture in demo-baseline.json');
  const rep = await call('GET', `/users/${userId}`);
  const importRep = {
    username: rep.username,
    enabled: rep.enabled,
    email: rep.email,
    firstName: rep.firstName,
    lastName: rep.lastName,
    emailVerified: rep.emailVerified,
    attributes: rep.attributes,
    requiredActions: rep.requiredActions,
    credentials: [baseline.passkeyFixture],
  };
  await call('POST', '/partialImport', { ifResourceExists: 'OVERWRITE', users: [importRep] });
}

async function main() {
  const call = api(await adminToken());

  for (const [username, shouldHave] of Object.entries(baseline.passkeys || {})) {
    const entry = users.find((u) => u.username === username);
    if (!entry) {
      log(`WARNUNG: '${username}' nicht in users.json — übersprungen.`);
      problems++;
      continue;
    }
    const found = await call('GET', `/users?username=${encodeURIComponent(entry.verifi_id)}&exact=true`);
    const user = Array.isArray(found) ? found[0] : null;
    if (!user) {
      log(`WARNUNG: '${username}' (${entry.verifi_id}) nicht in Keycloak — übersprungen.`);
      problems++;
      continue;
    }

    const creds = await call('GET', `/users/${user.id}/credentials`);
    const has = hasWebAuthn(creds);

    if (shouldHave && !has) {
      await restorePasskeyFixture(call, user.id);
      log(`${username}: Passkey wiederhergestellt.`);
    } else if (!shouldHave && has) {
      for (const c of creds) {
        if (String(c.type).startsWith('webauthn')) {
          await call('DELETE', `/users/${user.id}/credentials/${c.id}`);
        }
      }
      await clearRegistrationMarkers(call, user.id);
      log(`${username}: Passkey entfernt.`);
    } else {
      if (!shouldHave) await clearRegistrationMarkers(call, user.id);
      log(`${username}: unverändert (${shouldHave ? 'hat Passkey' : 'kein Passkey'}).`);
    }
  }

  log(problems === 0 ? 'OK — Demo-Baseline wiederhergestellt.' : `Fertig mit ${problems} Warnung(en).`);
  process.exit(problems === 0 ? 0 : 1);
}

main().catch((err) => {
  log(`FEHLER: ${err.message}`);
  process.exit(1);
});
