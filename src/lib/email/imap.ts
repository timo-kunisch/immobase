import "server-only";

import { getSettingWithEnvFallback } from "@/data/app-settings";

/**
 * IMAP-Konfiguration für den E-Mail-Empfang (Ticket-Postfach, siehe
 * src/lib/email/imap-sync.ts). Optionale Online-Funktion: Ohne
 * Konfiguration (App-Einstellungen `imap.*`; Fallback Umgebungsvariablen
 * IMAP_HOST etc.) sind Postfach und E-Mail-Import deaktiviert - das
 * Ticket-System funktioniert dann weiterhin mit den Basis-Funktionen
 * (manuell angelegte Tickets + interne Notizen).
 *
 * Im Gegensatz zu SMTP (Versand) ist für IMAP zwingend eine Anmeldung
 * nötig: Ohne Benutzername/Passwort gilt die Konfiguration als
 * unvollständig und damit als nicht konfiguriert.
 */

export interface ImapConfig {
	host: string;
	port: number;
	secure: boolean;
	user: string;
	pass: string;
	/** IMAP-Ordner, aus dem gelesen wird (Standard: INBOX). */
	mailbox: string;
}

export function getImapConfig(): ImapConfig | null {
	const host = getSettingWithEnvFallback("imap.host", "IMAP_HOST");
	const user = getSettingWithEnvFallback("imap.user", "IMAP_USER");
	const pass = getSettingWithEnvFallback("imap.pass", "IMAP_PASS");
	if (!host || !user || !pass) return null;
	const portRaw = getSettingWithEnvFallback("imap.port", "IMAP_PORT", "993");
	const port = Number.parseInt(portRaw, 10);
	const secure = getSettingWithEnvFallback("imap.secure", "IMAP_SECURE", "true") === "true";
	const mailbox = getSettingWithEnvFallback("imap.mailbox", "IMAP_MAILBOX", "INBOX") || "INBOX";
	return { host, port: Number.isFinite(port) ? port : 993, secure, user, pass, mailbox };
}

export function isImapConfigured(): boolean {
	return getImapConfig() !== null;
}
