/**
 * Portal-Mock Konfiguration — alles über Umgebungsvariablen, keine Geheimnisse im Code.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

export const cfg = {
  port: Number(process.env.PORT ?? 3000),

  /** Basis-URL, unter der der Browser das Portal erreicht (für Redirects/Callback). */
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:8080',

  // --- Keycloak -----------------------------------------------------------
  keycloakUrl: process.env.KEYCLOAK_URL || 'http://localhost:8082',
  /**
   * Browser-erreichbare Keycloak-Basis (Docker: `http://localhost:8082`, da der
   * Browser den Container-DNS-Namen nicht auflösen kann). Nur für URLs, die an
   * den Browser gehen (z. B. Auth-Redirect); Server-zu-Server nutzt keycloakUrl.
   */
  keycloakPublicUrl: process.env.KEYCLOAK_PUBLIC_URL || process.env.KEYCLOAK_URL || 'http://localhost:8082',
  realm: process.env.KEYCLOAK_REALM || 'passkey-prototyp',
  clientId: process.env.KEYCLOAK_CLIENT_ID || 'portal-mock',
  /**
   * Client für die ERSTE Passkey-Registrierung (Variante A): nutzt den
   * Standard-`browser`-Flow (Cookie → Forms alternativ). Beim SSO-Resume wird
   * die Passwort-Form übersprungen und die Pflicht-Aktion
   * `webauthn-register-passwordless` kann rendern — der reine Passkey-Flow
   * (browser-passkey) würde hier mit CREDENTIAL_SETUP_REQUIRED abbrechen,
   * weil ein Nutzer ohne jede Credential den WebAuthn-Schritt nicht passieren
   * kann (KC-26.7-Verhalten, requiresUser()==false).
   */
  bootstrapClientId: process.env.KC_BOOTSTRAP_CLIENT_ID || 'portal-bootstrap',
  adminClientId: process.env.KC_ADMIN_CLIENT_ID || 'portal-admin',
  adminClientSecret: process.env.KC_ADMIN_CLIENT_SECRET || 'dev-portal-admin-secret',

  // --- Betrieb (R-OPS) ----------------------------------------------------
  /** Einfacher statischer R-OPS-Token für den Prototyp (Austausch vor Produktivgang nötig). */
  ropsToken: process.env.R_OPS_TOKEN || 'dev-rops-token',

  // --- Phasenschalter (T-02: Konfigurationsdatei) --------------------------
  phaseConfigFile:
    process.env.PHASE_CONFIG_FILE || path.join(repoRoot, 'config', 'phase-config.json'),

  // --- Portal-Datenbank ---------------------------------------------------
  dbPath: process.env.PORTAL_DB_PATH || path.join(repoRoot, 'data', 'portal.db'),

  // --- Session (T-03: 15 Minuten gültig) ----------------------------------
  sessionTtlMs: Number(process.env.SESSION_TTL_SECONDS ?? 900) * 1000,
  /** Kurzlebigkeit des laufenden Keycloak-Authentifizierungs-Vorgangs (State/Code-Sharing). */
  authTtlMs: Number(process.env.AUTH_TTL_SECONDS ?? 600) * 1000,

  // --- Verimi(-Mock) ------------------------------------------------------
  verimiLoginUrl: process.env.VERIMI_LOGIN_URL || 'http://localhost:8081/login',
  /**
   * Server-seitig erreichbare Verimi-Basis-URL für die Erreichbarkeits-Vorprüfung
   * in API-01. Bewusst GETRENNT von verimiLoginUrl: In Docker ist `localhost:8081`
   * aus dem Portal-Container heraus NICHT erreichbar (der Browser nutzt
   * `localhost`, der Container muss den Compose-DNS-Namen `verimi-mock:3000`
   * verwenden). Nativ (ohne Docker) fällt der Wert auf verimiLoginUrl zurück.
   */
  verimiInternalUrl:
    process.env.VERIMI_INTERNAL_URL || process.env.VERIMI_LOGIN_URL || 'http://localhost:8081/login',
  /**
   * Logout-Endpunkt des Verimi(-Mocks). Wird beim Portal-Logout als Redirect
   * angesteuert, damit die Verimi-SSO-Session serverseitig beendet wird —
   * sonst würde ein erneuter Login über die bestehende SSO ohne Zugangsdaten
   * direkt in den geschützten Bereich führen (Auth-Bypass, Issue 2).
   */
  verimiLogoutUrl: process.env.VERIMI_LOGOUT_URL || 'http://localhost:8081/logout',
  /** Wenn gesetzt, wird die HMAC-Signatur der Mock-Rückkehr geprüft (Mock-Schutz, T-01). */
  verimiHmacSecret: process.env.VERIMI_HMAC_SECRET || 'verimi-mock-dev-secret',
};