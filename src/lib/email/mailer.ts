import "server-only";
import fs from "node:fs";
import path from "node:path";

import nodemailer from "nodemailer";

import { getSettingWithEnvFallback } from "@/data/app-settings";
import { getLogsDir } from "@/data/paths";

/**
 * E-Mail-Versand für Transaktionsmails (Verifizierung, Passwort-Reset,
 * Kontaktanfragen, Freigabe-Benachrichtigung):
 *
 * - Wenn SMTP konfiguriert ist (App-Einstellungen `smtp.*`, siehe
 *   src/data/app-settings.ts; Fallback: Umgebungsvariablen SMTP_HOST etc.),
 *   wird über nodemailer versendet.
 * - OHNE SMTP-Konfiguration wird die E-Mail NICHT verschickt, sondern in
 *   `<APP_DATA_DIR>/logs/outbox.log` und auf der Konsole protokolliert - so
 *   bleibt der komplette Auth-Flow auch komplett offline (Kernanforderung
 *   der Desktop-App) test- und benutzbar. Der Inhalt enthält alle Links
 *   (z. B. Verifizierungs-/Reset-Links) und kann von dort übernommen
 *   werden.
 *
 * Diese Datei ist die einzige Stelle im Projekt mit Mailversand-Logik -
 * alle Aufrufer nutzen ausschließlich die hier exportierten, fachlichen
 * Funktionen (sendVerificationEmail etc.).
 */

function getAppUrl(): string {
	// Bewusst eine feste, konfigurierte Basis-URL statt des Host-Headers der
	// eingehenden Anfrage: Andernfalls könnten manipulierte Host-Header in
	// Passwort-Reset-/Verifizierungs-Mails zu Links auf fremde Domains
	// führen ("Host Header Injection"). In der Desktop-App setzt der
	// Electron-Main-Prozess APP_URL nach dem Binden des Servers
	// (http://127.0.0.1:<port>).
	return getSettingWithEnvFallback("app.url", "APP_URL", "http://localhost:3000").replace(/\/$/, "");
}

function getEmailFrom(): string {
	return getSettingWithEnvFallback("smtp.from", "EMAIL_FROM", "no-reply@example.com");
}

interface SmtpConfig {
	host: string;
	port: number;
	secure: boolean;
	user: string;
	pass: string;
}

/** Liest die SMTP-Konfiguration (App-Einstellungen, Fallback Umgebungsvariablen). */
function getSmtpConfig(): SmtpConfig | null {
	const host = getSettingWithEnvFallback("smtp.host", "SMTP_HOST");
	if (!host) return null;
	const portRaw = getSettingWithEnvFallback("smtp.port", "SMTP_PORT", "587");
	const port = Number.parseInt(portRaw, 10);
	const secure = getSettingWithEnvFallback("smtp.secure", "SMTP_SECURE", port === 465 ? "true" : "false") === "true";
	const user = getSettingWithEnvFallback("smtp.user", "SMTP_USER");
	const pass = getSettingWithEnvFallback("smtp.pass", "SMTP_PASS");
	return { host, port: Number.isFinite(port) ? port : 587, secure, user, pass };
}

type SendMailOptions = {
	to: string;
	subject: string;
	html: string;
	text: string;
	replyTo?: string;
};

/** Schreibt eine nicht versendete E-Mail in die Outbox-Logdatei (Offline-Fallback). */
function logToOutbox(options: SendMailOptions & { from: string }, reason: string): void {
	const line = [
		"=".repeat(72),
		`Zeit: ${new Date().toISOString()}`,
		`Grund: ${reason}`,
		`Von: ${options.from}`,
		`An: ${options.to}`,
		`Betreff: ${options.subject}`,
		"",
		options.text,
		"",
	].join("\n");
	try {
		fs.appendFileSync(path.join(getLogsDir(), "outbox.log"), line + "\n", "utf8");
	} catch (error) {
		console.error("[email] Outbox-Log konnte nicht geschrieben werden", error);
	}
	console.warn(`[email] Kein SMTP-Versand (${reason}) - E-Mail in logs/outbox.log protokolliert.\n  An: ${options.to}\n  Betreff: ${options.subject}`);
}

async function sendMail(options: SendMailOptions): Promise<void> {
	const from = getEmailFrom();
	const smtp = getSmtpConfig();

	if (!smtp) {
		logToOutbox({ ...options, from }, "SMTP nicht konfiguriert");
		return;
	}

	try {
		const transporter = nodemailer.createTransport({
			host: smtp.host,
			port: smtp.port,
			secure: smtp.secure,
			auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
		});
		await transporter.sendMail({
			from,
			to: options.to,
			subject: options.subject,
			html: options.html,
			text: options.text,
			...(options.replyTo ? { replyTo: options.replyTo } : {}),
		});
	} catch (error) {
		// Ein fehlgeschlagener Mailversand darf den aufrufenden Flow (z. B.
		// Registrierung, bei der der Nutzer bereits in der DB angelegt wurde)
		// nicht mit einem 500 abbrechen - nur protokollieren.
		logToOutbox({ ...options, from }, `Versand fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/** Escaped Nutzereingaben, bevor sie in HTML-E-Mails eingebettet werden. */
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function layout(title: string, bodyHtml: string): string {
	return `<!doctype html>
<html lang="de">
  <body style="font-family: sans-serif; color: #1a1a1a; line-height: 1.5;">
    <h2>${title}</h2>
    ${bodyHtml}
    <p style="margin-top: 32px; font-size: 12px; color: #666;">
      ImmoBase – diese E-Mail wurde automatisch generiert.
    </p>
  </body>
</html>`;
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
	const url = `${getAppUrl()}/verify-email?token=${token}`;
	await sendMail({
		to: email,
		subject: "Bitte bestätigen Sie Ihre E-Mail-Adresse",
		html: layout(
			"E-Mail-Adresse bestätigen",
			`<p>Vielen Dank für Ihre Registrierung bei ImmoBase.</p>
       <p><a href="${url}">Klicken Sie hier, um Ihre E-Mail-Adresse zu bestätigen.</a></p>
       <p>Oder öffnen Sie diesen Link: ${url}</p>
       <p>Der Link ist 24 Stunden gültig.</p>`
		),
		text: `Bitte bestätigen Sie Ihre E-Mail-Adresse: ${url} (24 Stunden gültig)`,
	});
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
	const url = `${getAppUrl()}/reset-password?token=${token}`;
	await sendMail({
		to: email,
		subject: "Passwort zurücksetzen",
		html: layout(
			"Passwort zurücksetzen",
			`<p>Sie haben ein neues Passwort für Ihr ImmoBase-Konto angefordert.</p>
       <p><a href="${url}">Klicken Sie hier, um ein neues Passwort zu vergeben.</a></p>
       <p>Oder öffnen Sie diesen Link: ${url}</p>
       <p>Der Link ist 1 Stunde gültig. Falls Sie diese Anfrage nicht gestellt haben,
       können Sie diese E-Mail ignorieren.</p>`
		),
		text: `Passwort zurücksetzen: ${url} (1 Stunde gültig)`,
	});
}

/**
 * Kontaktanfrage eines angemeldeten Nutzers an den Administrator.
 * `replyTo` wird auf die E-Mail-Adresse des anfragenden Nutzers gesetzt,
 * damit der Admin direkt per "Antworten" reagieren kann.
 */
export async function sendContactAdminEmail(adminEmail: string, fromUserEmail: string, message: string): Promise<void> {
	const safeMessage = escapeHtml(message);
	await sendMail({
		to: adminEmail,
		subject: `Kontaktanfrage von ${fromUserEmail}`,
		html: layout(
			"Neue Kontaktanfrage",
			`<p><strong>Von:</strong> ${escapeHtml(fromUserEmail)}</p>
       <p style="white-space: pre-wrap;">${safeMessage}</p>`
		),
		text: `Von: ${fromUserEmail}\n\n${message}`,
		replyTo: fromUserEmail,
	});
}

/** Optionale Benachrichtigung, sobald ein Admin einen Account freigeschaltet hat. */
export async function sendAccountApprovedEmail(email: string): Promise<void> {
	const url = `${getAppUrl()}/login`;
	await sendMail({
		to: email,
		subject: "Ihr Konto wurde freigeschaltet",
		html: layout(
			"Konto freigeschaltet",
			`<p>Ihr Konto für ImmoBase wurde soeben von einem Administrator freigeschaltet.</p>
       <p><a href="${url}">Jetzt anmelden</a></p>`
		),
		text: `Ihr Konto wurde freigeschaltet. Jetzt anmelden: ${url}`,
	});
}
