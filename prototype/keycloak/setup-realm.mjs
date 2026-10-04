/**
 * Keycloak-Setup für den Prototyp (idempotent, beliebig oft ausführbar).
 *
 * Erstellt im Realm `passkey-prototyp`:
 *  - WebAuthn-Policies (Passkey, resident/discoverable, localhost als RP)
 *  - Client `portal-mock`    (öffentlicher OIDC-Client mit PKCE, Passkey-Flow)
 *  - Client `portal-bootstrap` (öffentlicher OIDC-Client für die Ersteinrichtung
 *    des Passkeys; nutzt den Standard-browser-Flow statt browser-passkey —
 *    nur so kann die Pflicht-Aktion `webauthn-register-passwordless` bei einem
 *    Nutzer ohne jede Credential gerendert werden, KC-26.7-Verhalten)
 *  - Client `portal-admin` (Service-Account für Portal-Backend-Admin-Aufrufe;
 *    Secret wird beim Anlegen über das Feld `secret` gesetzt — KC-26.7-typisch
 *    rotiert POST .../client-secret nur noch, ein explizites Setzen gibt es nicht)
 *  - Flow `browser-passkey` (username-lose Passkey-Authentifizierung; Cookie-Execution
 *    DISABLED — jede Verifizierung läuft frisch über WebAuthn, AC-P3/FR-16)
 *  - Passkey-Registrierungs-Pflichtaktion aktiv
 *  - Test-User aus shared/users.json (username = verifi_id, C-P.4)
 *
 * Keycloak-26.7-Besonderheiten (empirisch verifiziert):
 *  - DefaultAuthenticationFlow.processFlow (Z. 297-305): Eine REQUIRED-Cookie-
 *    Execution ohne SSO-Session meldet nur "attempted" und bricht die REQUIRED-
 *    Schleife ab → nachfolgende webauthn-Execution wird nie erreicht →
 *    UNKNOWN_USER/"Invalid username or password" (WARN KC-SERVICES0013).
 *    Lösung: Cookie DISABLED, webauthn REQUIRED (nur noch ein REQUIRED-Element).
 *  - Provider-Liste: GET /authentication/authenticator-providers (statt /authenticators)
 *  - Provider-ID Passkey: `webauthn-authenticator-passwordless`
 *  - Execution-Update: PUT /authentication/flows/{alias}/executions
 *    (Body: {id, requirement, priority} — NICHT /authentication/executions/{id})
 *  - Realm-Feld residentKey (neues Enum-Feld, ersetzt requireResidentKey)
 *
 * Laufzeit: Node >= 20 (globales fetch). Keine Abhängigkeiten.
 * Umgebungsvariablen: KC_URL, KC_ADMIN_USER, KC_ADMIN_PASS, REALM,
 *                     KC_ADMIN_CLIENT_SECRET, USER_FILE
 */
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const KC_URL = process.env.KC_URL || 'http://localhost:8082';
const KC_ADMIN_USER = process.env.KC_ADMIN_USER || 'admin';
const KC_ADMIN_PASS = process.env.KC_ADMIN_PASS || 'admin';
const REALM = process.env.REALM || 'passkey-prototyp';
const CLIENT_SECRET = process.env.KC_ADMIN_CLIENT_SECRET || 'dev-portal-admin-secret';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:8080';
const USER_FILE =
  process.env.USER_FILE || fileURLToPath(new URL('../shared/users.json', import.meta.url));

const FLOW_ALIAS = 'browser-passkey';
const WEBAUTHN_PROVIDER = 'webauthn-authenticator-passwordless';

const api = async (method, path, token, body) => {
  const res = await fetch(`${KC_URL}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* leer */ }
  return { status: res.status, json, text };
};

async function main() {
  // --- 0. Admin-Token (master, direct grant) ---
  const token = (await fetch(`${KC_URL}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: KC_ADMIN_USER,
      password: KC_ADMIN_PASS,
    }),
  }).then((r) => r.json())).access_token;
  if (!token) throw new Error('Admin-Token konnte nicht geholt werden — Keycloak läuft?');

  const users = JSON.parse(readFileSync(USER_FILE, 'utf8')).list;

  // --- 1. Realm anlegen bzw. aktualisieren ---
  const realmProbe = await api('GET', `/admin/realms/${REALM}`, token);
  let realm = realmProbe.status === 200 ? realmProbe.json : null;
  let realmCreated = false;
  if (!realm) {
    const created = await api('POST', `/admin/realms`, token, {
      realm: REALM,
      enabled: true,
      displayName: 'Kundenportal Passkey-Prototyp (Prototyp)',
      registrationAllowed: false,
    });
    if (![201, 200, 204].includes(created.status)) {
      throw new Error(`Realm anlegen fehlgeschlagen: ${created.status} ${created.text}`);
    }
    const probe2 = await api('GET', `/admin/realms/${REALM}`, token);
    realm = probe2.status === 200 ? probe2.json : null;
    if (!realm) throw new Error('Realm nach dem Anlegen nicht abrufbar');
    realmCreated = true;
  }
  console.log(`[realm] ${REALM} ${realmCreated ? 'angelegt' : 'vorhanden'}`);

  // --- 2. WebAuthn-Policies (Passkey: resident/discoverable für username-loses Login) ---
  Object.assign(realm, {
    webAuthnPolicyRpEntityName: 'Kundenportal Passkey-Prototyp',
    webAuthnPolicyRpId: 'localhost',
    webAuthnPolicySignatureAlgorithms: ['ES256', 'RS256'],
    webAuthnPolicyAttestationConveyancePreference: 'none',
    webAuthnPolicyAuthenticatorAttachment: 'not specified',
    webAuthnPolicyRequireResidentKey: true,
    webAuthnPolicyResidentKey: 'required',
    webAuthnPolicyUserVerificationRequirement: 'required',

    webAuthnPolicyPasswordlessRpEntityName: 'Kundenportal Passkey-Prototyp',
    webAuthnPolicyPasswordlessRpId: 'localhost',
    webAuthnPolicyPasswordlessSignatureAlgorithms: ['ES256', 'RS256'],
    webAuthnPolicyPasswordlessAttestationConveyancePreference: 'none',
    webAuthnPolicyPasswordlessAuthenticatorAttachment: 'not specified',
    webAuthnPolicyPasswordlessRequireResidentKey: true,
    webAuthnPolicyPasswordlessResidentKey: 'required',
    webAuthnPolicyPasswordlessUserVerificationRequirement: 'required',
  });
  const realmUp = await api('PUT', `/admin/realms/${REALM}`, token, realm);
  if (![200, 204].includes(realmUp.status)) {
    throw new Error(`Realm-Update fehlgeschlagen: ${realmUp.status} ${realmUp.text}`);
  }
  console.log('[realm] WebAuthn-Policies gesetzt (RP localhost, resident/discoverable, passwordless)');

  // --- 3. Flow "browser-passkey" (VOR den Clients, da Client-Flow-Bindings
  // die Flow-IDs brauchen) ---
  const allFlowsBefore = (await api('GET', `/admin/realms/${REALM}/authentication/flows`, token)).json;
  const flowExists = Array.isArray(allFlowsBefore) && allFlowsBefore.some((f) => f.alias === FLOW_ALIAS);
  if (!flowExists) {
    const f = await api('POST', `/admin/realms/${REALM}/authentication/flows`, token, {
      alias: FLOW_ALIAS,
      description: 'Passkey-only-Login (Prototyp): username-lose WebAuthn-Passkey-Prüfung, Cookie deaktiviert',
      providerId: 'basic-flow',
      topLevel: true,
      builtIn: false,
    });
    if (![201, 200, 204].includes(f.status)) {
      throw new Error(`Flow anlegen fehlgeschlagen: ${f.status} ${f.text}`);
    }
    console.log(`[flow] ${FLOW_ALIAS} angelegt`);
  } else {
    console.log(`[flow] ${FLOW_ALIAS} vorhanden`);
  }

  // Passkey-Authenticator-Pflicht: webauthn REQUIRED; Cookie DISABLED.
  // WARUM (KC 26.7, empirisch belegt): Eine REQUIRED-Cookie-Execution, die bei
  // fehlender SSO-Session nur "attempted" meldet, bricht in
  // DefaultAuthenticationFlow.processFlow (Z. 297-305) die Schleife der REQUIRED-
  // Executions ab (requiredElementsSuccessful=false → break) → die webauthn-
  // Execution wird NIE erreicht → AuthenticationProcessor.authenticateOnly (Z.
  // 1130) wirft UNKNOWN_USER → 400 "Invalid username or password".
  // Mit Cookie=DISABLED ist die webauthn-Execution alleiniges REQUIRED-Element:
  // Jede Verifizierung läuft frisch als username-lose WebAuthn-Prüfung (AC-P3,
  // FR-16) — ohne den SSO-Abkürzungspfad.
  const executionsRes = await api('GET', `/admin/realms/${REALM}/authentication/flows/${FLOW_ALIAS}/executions`, token);
  const executions = executionsRes.json;
  if (!Array.isArray(executions)) {
    throw new Error(`Executions-Liste unerwartet: ${executionsRes.status} ${executionsRes.text}`);
  }

  for (const [providerId, requirement, idx] of [
    ['auth-cookie', 'DISABLED', 0],
    [WEBAUTHN_PROVIDER, 'REQUIRED', 1],
  ]) {
    let exec = executions.find((e) => e.providerId === providerId);
    if (!exec) {
      const r = await api(
        'POST', `/admin/realms/${REALM}/authentication/flows/${FLOW_ALIAS}/executions/execution`,
        token, { provider: providerId }
      );
      if (![201, 200, 204].includes(r.status)) {
        throw new Error(`Execution ${providerId} fehlgeschlagen: ${r.status} ${r.text}`);
      }
      const updated = (await api('GET', `/admin/realms/${REALM}/authentication/flows/${FLOW_ALIAS}/executions`, token)).json;
      exec = updated.find((e) => e.providerId === providerId);
    }
    if (!exec) throw new Error(`Execution ${providerId} nicht gefunden`);
    await api(
      'PUT', `/admin/realms/${REALM}/authentication/flows/${FLOW_ALIAS}/executions`,
      token, { id: exec.id, requirement, priority: idx }
    );
    console.log(`[flow] ${providerId} → ${requirement}`);
  }

  // Realm-Default = Standard-browser-Flow (sicher für Konsolen/Clients OHNE
  // explizites Binding); portal-mock bindet sich per authenticationFlowBinding-
  // Overrides explizit an browser-passkey → nur der Portal-Login ist passkey-only.
  realm.browserFlow = 'browser';
  await api('PUT', `/admin/realms/${REALM}`, token, realm);
  const final = (await api('GET', `/admin/realms/${REALM}/authentication/flows/${FLOW_ALIAS}/executions`, token)).json;
  console.log('[flow] Reihenfolge: ' + final.map((e) => `${e.displayName}[${e.requirement}]`).join(' → ') + `  (Realm-Default browserFlow=browser, portal-mock → ${FLOW_ALIAS})`);

  // --- 4. Clients ---
  // Hinweis (KC 26.7): Das Secret wird beim ANLEGEN über das Feld `secret`
  // gesetzt. POST .../client-secret rotiert in 26.7 nur (Body wird ignoriert),
  // ein explizites Setzen existiert nicht mehr → bei abweichendem Secret wird
  // der Client neu angelegt (idempotent, Determinismus fürs Prototyping).
  // Flow-Bindings: Feld `flowBinding` (alias→Flow-Alias) wird auf
  // `authenticationFlowBindingOverrides` (browser→Flow-ID) übersetzt — das
  // direkte PUT-Feld `browserFlow` ist in 26.7 nicht mehr schreibbar.
  const allFlows = (await api('GET', `/admin/realms/${REALM}/authentication/flows`, token)).json;
  const flowIdByAlias = new Map(Array.isArray(allFlows) ? allFlows.map((f) => [f.alias, f.id]) : []);
  if (!flowIdByAlias.has('browser')) {
    throw new Error('Standard-Flow "browser" nicht im Realm gefunden');
  }

  const ensureClient = async (rep) => {
    const { flowBinding } = rep;
    const repJson = { ...rep };
    delete repJson.flowBinding;
    if (flowBinding) {
      const overrides = {};
      for (const [binding, alias] of Object.entries(flowBinding)) {
        const flowId = flowIdByAlias.get(alias);
        if (!flowId) throw new Error(`Flow "${alias}" für Binding "${binding}" nicht gefunden`);
        overrides[binding] = flowId;
      }
      repJson.authenticationFlowBindingOverrides = overrides;
    }
    const existing = await api('GET', `/admin/realms/${REALM}/clients?clientId=${rep.clientId}`, token);
    if (existing.status === 200 && existing.json?.length) {
      const cur = existing.json[0];
      if (rep.secret !== undefined) {
        const sec = await api('GET', `/admin/realms/${REALM}/clients/${cur.id}/client-secret`, token);
        if (sec.status !== 200 || sec.json?.value !== rep.secret) {
          const del = await api('DELETE', `/admin/realms/${REALM}/clients/${cur.id}`, token);
          if (![200, 204].includes(del.status)) {
            throw new Error(`Client ${rep.clientId} löschen fehlgeschlagen: ${del.status} ${del.text}`);
          }
          const created = await api('POST', `/admin/realms/${REALM}/clients`, token, repJson);
          if (![201, 200, 204].includes(created.status)) {
            throw new Error(`Client ${rep.clientId} neu anlegen fehlgeschlagen: ${created.status} ${created.text}`);
          }
          const got = await api('GET', `/admin/realms/${REALM}/clients?clientId=${rep.clientId}`, token);
          console.log(`[client] ${rep.clientId} neu angelegt (Secret wich ab)`);
          return got.json[0];
        }
      }
      // Selbstheilend: Flow-Binding UND Redirect-URIs (Login/Logout) nachziehen,
      // wenn sie vom gewünschten Zustand abweichen. Vollständige Repräsentation
      // laden (KC-PUT ist ein Voll-Update) und gezielt mergen.
      const fullRes = await api('GET', `/admin/realms/${REALM}/clients/${cur.id}`, token);
      const curFull = fullRes.status === 200 ? fullRes.json : cur;
      const sameArr = (a = [], b = []) => [...a].sort().join('\n') === [...b].sort().join('\n');
      const curBindings = curFull.authenticationFlowBindingOverrides ?? {};
      const desiredBindings = repJson.authenticationFlowBindingOverrides ?? {};
      const bindingDiff = Object.keys(desiredBindings).some(
        (b) => curBindings[b] !== desiredBindings[b]
      );
      const redirectDiff =
        repJson.redirectUris !== undefined && !sameArr(curFull.redirectUris, repJson.redirectUris);
      // Attribute umfassen u. a. `post.logout.redirect.uris` (Post-Logout-URIs
      // liegen NICHT als Top-Level-Feld vor, sondern als Client-Attribut).
      const curAttrs = curFull.attributes ?? {};
      const desiredAttrs = repJson.attributes ?? {};
      const attrDiff = Object.keys(desiredAttrs).some((k) => curAttrs[k] !== desiredAttrs[k]);

      if (bindingDiff || redirectDiff || attrDiff) {
        const merged = { ...curFull };
        if (bindingDiff) {
          merged.authenticationFlowBindingOverrides = { ...curBindings, ...desiredBindings };
        }
        if (redirectDiff) merged.redirectUris = repJson.redirectUris;
        if (attrDiff) merged.attributes = { ...curAttrs, ...desiredAttrs };

        const upd = await api('PUT', `/admin/realms/${REALM}/clients/${cur.id}`, token, merged);
        if (![200, 204].includes(upd.status)) {
          throw new Error(`Client ${rep.clientId} update fehlgeschlagen: ${upd.status} ${upd.text}`);
        }
        const changed = [
          bindingDiff ? 'Flow-Binding' : null,
          redirectDiff ? 'redirectUris' : null,
          attrDiff ? 'attributes' : null,
        ]
          .filter(Boolean)
          .join(', ');
        console.log(`[client] ${rep.clientId} nachgezogen: ${changed}`);
      }
      console.log(`[client] ${rep.clientId} vorhanden`);
      return curFull;
    }
    const created = await api('POST', `/admin/realms/${REALM}/clients`, token, repJson);
    if (![201, 200, 204].includes(created.status)) {
      throw new Error(`Client ${rep.clientId} anlegen fehlgeschlagen: ${created.status} ${created.text}`);
    }
    const got = await api('GET', `/admin/realms/${REALM}/clients?clientId=${rep.clientId}`, token);
    return got.json[0];
  };

  const portalClient = await ensureClient({
    clientId: 'portal-mock',
    name: 'Kundenportal (Prototyp)',
    protocol: 'openid-connect',
    publicClient: true,
    standardFlowEnabled: true,
    directAccessGrantsEnabled: false,
    enabled: true,
    redirectUris: [`${PUBLIC_BASE_URL}/*`],
    webOrigins: ['+'],
    // Passkey-only-Flow (Phase 2 + Login-Verify, FR-16)
    flowBinding: { browser: FLOW_ALIAS },
    attributes: {
      'pkce.code.challenge.method': 'S256',
      // OIDC-Logout: gültige Post-Logout-Redirect-URI (exakter Treffpunkt, kein
      // Wildcard). KC kennt dafür KEIN Top-Level-Feld, sondern das Client-Attribut
      // `post.logout.redirect.uris` (Mehrfachwerte mit `##` getrennt).
      'post.logout.redirect.uris': `${PUBLIC_BASE_URL}/logout/verimi`,
    },
  });
  console.log(
    `[client] portal-mock redirectUris: ${portalClient.redirectUris.join(', ')} | postLogout: ${portalClient.attributes?.['post.logout.redirect.uris'] ?? '(keine)'}`
  );

  // Bootstrap-Client für die ERSTE Registrierung (Variante A): Standard-
  // browser-Flow (Cookie → Forms alternativ). Beim SSO-Resume wird die
  // Passwort-Form übersprungen und die Pflicht-Aktion kann rendern; der reine
  // Passkey-Flow bräche hier mit CREDENTIAL_SETUP_REQUIRED ab (KC 26.7).
  const bootstrapClient = await ensureClient({
    clientId: 'portal-bootstrap',
    name: 'Kundenportal — Ersteinrichtung Passkey (Prototyp)',
    protocol: 'openid-connect',
    publicClient: true,
    standardFlowEnabled: true,
    directAccessGrantsEnabled: false,
    enabled: true,
    redirectUris: [`${PUBLIC_BASE_URL}/*`],
    webOrigins: ['+'],
    // WICHTIG: nicht den Realm-Flow (browser-passkey) erben, sondern den
    // Standard-browser-Flow für die bootstrap-fähige Pflicht-Aktion.
    flowBinding: { browser: 'browser' },
    attributes: {
      'pkce.code.challenge.method': 'S256',
      // Siehe portal-mock: Post-Logout-URI als Client-Attribut.
      'post.logout.redirect.uris': `${PUBLIC_BASE_URL}/logout/verimi`,
    },
  });
  console.log('[client] portal-bootstrap vorhanden (Flow: browser/Standard)');

  const adminClient = await ensureClient({
    clientId: 'portal-admin',
    name: 'Portal-Backend (Admin-API, Prototyp)',
    protocol: 'openid-connect',
    publicClient: false,
    serviceAccountsEnabled: true,
    standardFlowEnabled: false,
    directAccessGrantsEnabled: false,
    enabled: true,
    secret: CLIENT_SECRET,
  });
  console.log(`[client] portal-admin Secret: ${CLIENT_SECRET.length} Zeichen (beim Anlegen gesetzt)`);

  // Service-Account-Rollen
  const sa = await api('GET', `/admin/realms/${REALM}/clients/${adminClient.id}/service-account-user`, token);
  const saUser = sa.status === 200 ? sa.json : null;
  if (!saUser?.id) throw new Error('Service-Account-User von portal-admin nicht abrufbar');
  const rmClients = (await api('GET', `/admin/realms/${REALM}/clients?clientId=realm-management`, token)).json;
  const rmClient = rmClients[0];
  const roles = (await api('GET', `/admin/realms/${REALM}/clients/${rmClient.id}/roles`, token)).json;
  const wanted = ['manage-users', 'view-users', 'query-users', 'view-clients', 'manage-clients', 'view-realm', 'impersonation', 'view-events', 'manage-events'];
  const toAssign = roles.filter((r) => wanted.includes(r.name));
  await api('POST', `/admin/realms/${REALM}/users/${saUser.id}/role-mappings/clients/${rmClient.id}`, token, toAssign);
  console.log(`[client] portal-admin Rollen: ${toAssign.map((r) => r.name).join(', ')}`);

  // --- 6. Passkey-Registrierungs-Pflichtaktion aktivieren ---
  const reqActions = (await api('GET', `/admin/realms/${REALM}/authentication/required-actions`, token)).json;
  const reg = reqActions.find((a) => a.alias === 'webauthn-register-passwordless');
  if (!reg) throw new Error('Required-Action webauthn-register-passwordless nicht gefunden');
  if (!reg.enabled) {
    await api('PUT', `/admin/realms/${REALM}/authentication/required-actions/${reg.alias}`, token, { ...reg, enabled: true });
    console.log('[required-action] webauthn-register-passwordless aktiviert');
  } else {
    console.log('[required-action] webauthn-register-passwordless bereits aktiv');
  }

  // --- 7. Test-User (C-P.4) ---
  for (const u of users) {
    const existing = await api('GET', `/admin/realms/${REALM}/users?username=${encodeURIComponent(u.verifi_id)}&exact=true`, token);
    if (existing.status === 200 && existing.json?.length) {
      const cur = existing.json[0];
      // Kurz-Darstellung der Users-Liste enthält keine attributes — deshalb wird
      // verifi_id hier IMMER nachgetragen. Zusätzlich Name/E-Mail aus
      // users.json synchronisieren: users.json bleibt die einzige Quelle für
      // Stamm-Daten (z. B. Umbenennung fan → frank), sonst zeigt die
      // Account-Console während der Passkey-Registrierung noch alte Namen.
      const stale =
        cur.firstName !== u.first_name ||
        cur.lastName !== u.last_name ||
        cur.email !== u.email;
      if (stale || !cur.attributes?.verifi_id) {
        await api('PUT', `/admin/realms/${REALM}/users/${cur.id}`, token, {
          ...cur,
          firstName: u.first_name,
          lastName: u.last_name,
          email: u.email,
          attributes: { verifi_id: [u.verifi_id] },
        });
        console.log(`[user] ${u.username} synchronisiert (Name/Mail/verifi_id)`);
      } else {
        console.log(`[user] ${u.username} vorhanden`);
      }
      continue;
    }
    await api('POST', `/admin/realms/${REALM}/users`, token, {
      username: u.verifi_id,
      enabled: true,
      emailVerified: true,
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email,
      attributes: { verifi_id: [u.verifi_id] },
    });
    console.log(`[user] ${u.username} angelegt (verifi_id=${u.verifi_id})`);
  }

  console.log('---');
  console.log('Setup abgeschlossen.');
  console.log(`  Admin-Konsole: ${KC_URL}/admin (admin / admin)`);
  console.log(`  Account/Passkeys: ${KC_URL}/realms/${REALM}/account`);
}

main().catch((err) => {
  console.error('Setup fehlgeschlagen:', err.message);
  process.exit(1);
});