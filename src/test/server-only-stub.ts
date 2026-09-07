// Stub für die "server-only"-Markerdatei (siehe src/lib/letterxpress.ts,
// src/lib/email/mailer.ts) - im echten Next.js-Build wird "server-only"
// intern durch Next.js selbst aufgelöst (kein eigenes npm-Package
// installiert, siehe package.json). Für Vitest (das außerhalb des
// Next.js-Bundlers läuft) wird der Import hier auf ein leeres Modul
// umgeleitet (siehe vitest.config.ts, resolve.alias), damit
// Testdateien Module importieren können, die "server-only" nutzen.
export {};
