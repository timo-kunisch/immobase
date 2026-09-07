/**
 * Nur der Name des Session-Cookies - bewusst in einer eigenen, extrem
 * leichten Datei ohne jegliche Node.js-/DB-Importe ausgelagert (siehe
 * src/lib/auth/session.ts für die eigentliche Session-Logik).
 *
 * Grund: middleware.ts (Edge-Runtime, siehe README.md) importiert
 * ausschließlich diese Konstante, um zu prüfen, ob überhaupt ein
 * Session-Cookie vorhanden ist (der günstige, "optimistische" Check - die
 * autoritative Prüfung erfolgt in src/lib/auth/dal.ts). Würde
 * middleware.ts stattdessen aus session.ts importieren, würde Turbopack
 * beim Bundling für die Edge-Runtime automatisch auch die dortigen
 * Node.js-spezifischen Importe (crypto, Datenbank-Client) mitziehen - das
 * schlägt beim Cloudflare-Build fehl ("A Node.js module is loaded ... which
 * is not supported in the Edge Runtime"), analog zum bereits im Projekt
 * etablierten Muster mit src/lib/auth/login-state.ts.
 */
export const SESSION_COOKIE_NAME = "session_token";
