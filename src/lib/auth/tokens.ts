import "server-only";

import type { MessageKey } from "@/lib/i18n/translator";

import {
	deletePasswordResetTokenByToken,
	deletePasswordResetTokensForIdentifier,
	deleteVerificationTokenByToken,
	deleteVerificationTokensForIdentifier,
	getPasswordResetTokenByToken,
	getVerificationTokenByToken,
	insertPasswordResetToken,
	insertVerificationToken,
} from "@/data/tokens";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 Stunden
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 Stunde

function generateToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

// ============================================================
// E-Mail-Verifizierung
// ============================================================

/**
 * Erstellt einen neuen Verifizierungs-Token für eine E-Mail-Adresse.
 * Alte, noch nicht eingelöste Tokens für dieselbe E-Mail werden zuerst
 * entfernt (z. B. wenn ein Nutzer die Verifizierungs-Mail mehrfach anfordert).
 */
export async function createVerificationToken(identifier: string): Promise<string> {
	deleteVerificationTokensForIdentifier(identifier);

	const token = generateToken();
	const expires = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
	insertVerificationToken({ identifier, token, expires: expires.toISOString() });

	return token;
}

// Fehler werden als Übersetzungsschlüssel (errorKey) zurückgegeben und erst
// an der Aufrufstelle in die gewählte Sprache übersetzt.
type ConsumeResult = { success: true; identifier: string } | { success: false; errorKey: MessageKey };

/**
 * Löst einen Verifizierungs-Token ein (einmalig – wird danach gelöscht).
 * Gibt bei Erfolg die zugehörige E-Mail-Adresse zurück.
 */
export async function consumeVerificationToken(token: string): Promise<ConsumeResult> {
	const record = getVerificationTokenByToken(token);

	if (!record) {
		return { success: false, errorKey: "auth.errors.verificationInvalid" };
	}

	deleteVerificationTokenByToken(token);

	if (new Date(record.expires) < new Date()) {
		return {
			success: false,
			errorKey: "auth.errors.verificationExpired",
		};
	}

	return { success: true, identifier: record.identifier };
}

// ============================================================
// Passwort zurücksetzen
// ============================================================

export async function createPasswordResetToken(identifier: string): Promise<string> {
	deletePasswordResetTokensForIdentifier(identifier);

	const token = generateToken();
	const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
	insertPasswordResetToken({ identifier, token, expires: expires.toISOString() });

	return token;
}

export async function consumePasswordResetToken(token: string): Promise<ConsumeResult> {
	const record = getPasswordResetTokenByToken(token);

	if (!record) {
		return { success: false, errorKey: "auth.errors.linkInvalid" };
	}

	deletePasswordResetTokenByToken(token);

	if (new Date(record.expires) < new Date()) {
		return {
			success: false,
			errorKey: "auth.errors.linkExpired",
		};
	}

	return { success: true, identifier: record.identifier };
}

/**
 * Prüft (ohne den Token einzulösen), ob ein Passwort-Reset-Token gültig
 * ist – für die Anzeige des Reset-Formulars, bevor der Nutzer überhaupt
 * ein neues Passwort abschickt.
 */
export async function isValidPasswordResetToken(token: string): Promise<boolean> {
	const record = getPasswordResetTokenByToken(token);
	return Boolean(record && new Date(record.expires) >= new Date());
}
