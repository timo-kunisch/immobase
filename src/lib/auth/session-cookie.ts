/**
 * Nur der Name des Session-Cookies - bewusst in einer eigenen, extrem
 * leichten Datei ohne jegliche Node.js-/DB-Importe ausgelagert (siehe
 * src/lib/auth/session.ts für die eigentliche Session-Logik).
 *
 * Grund: src/proxy.ts importiert ausschließlich diese Konstante, um zu
 * prüfen, ob überhaupt ein Session-Cookie vorhanden ist (der günstige,
 * "optimistische" Check - die autoritative Prüfung erfolgt in
 * src/lib/auth/dal.ts). Der Proxy läuft auf JEDER Route (inkl. Prefetches)
 * und soll deshalb bewusst leichtgewichtig bleiben: Würde er stattdessen
 * aus session.ts importieren, würde der Bundler automatisch auch die
 * dortigen Node.js-spezifischen Importe (crypto, Datenbank-Client)
 * mitziehen - analog zum bereits im Projekt etablierten Muster mit
 * src/lib/auth/login-state.ts.
 */
export const SESSION_COOKIE_NAME = "session_token";
