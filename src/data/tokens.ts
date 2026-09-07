import { getDb } from "./db";
import { now } from "./helpers";
import type { PasswordResetToken, VerificationToken } from "./types";

/**
 * Repository für die beiden Einmal-Token-Tabellen `verification_tokens`
 * (E-Mail-Bestätigung) und `password_reset_tokens` (Passwort-Reset).
 *
 * Beide Tabellen haben identische Spalten (identifier/token/expires/
 * created_at) und keinen eigenen Primärschlüssel - adressiert wird über
 * `token` bzw. `identifier`. Die Ablauf-/Verbrauchslogik (TTL, Löschen nach
 * Einlösung) liegt in src/lib/auth/tokens.ts; hier nur der Datenzugriff.
 */

const TOKEN_COLUMNS = `
	identifier, token, expires, created_at AS createdAt
`;

export interface CreateTokenInput {
	identifier: string;
	token: string;
	/** Ablaufzeitpunkt als ISO-8601-String. */
	expires: string;
}

// ============================================================
// E-Mail-Verifizierung
// ============================================================

export function insertVerificationToken(input: CreateTokenInput): VerificationToken {
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO verification_tokens (identifier, token, expires, created_at)
			 VALUES (?, ?, ?, ?)`
		)
		.run(input.identifier, input.token, input.expires, timestamp);
	return { ...input, createdAt: timestamp };
}

export function getVerificationTokenByToken(token: string): VerificationToken | null {
	const row = getDb().prepare(`SELECT ${TOKEN_COLUMNS} FROM verification_tokens WHERE token = ?`).get(token) as
		| VerificationToken
		| undefined;
	return row ?? null;
}

/** Entfernt alle noch nicht eingelösten Verifizierungs-Tokens einer E-Mail-Adresse. */
export function deleteVerificationTokensForIdentifier(identifier: string): void {
	getDb().prepare("DELETE FROM verification_tokens WHERE identifier = ?").run(identifier);
}

export function deleteVerificationTokenByToken(token: string): void {
	getDb().prepare("DELETE FROM verification_tokens WHERE token = ?").run(token);
}

// ============================================================
// Passwort zurücksetzen
// ============================================================

export function insertPasswordResetToken(input: CreateTokenInput): PasswordResetToken {
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO password_reset_tokens (identifier, token, expires, created_at)
			 VALUES (?, ?, ?, ?)`
		)
		.run(input.identifier, input.token, input.expires, timestamp);
	return { ...input, createdAt: timestamp };
}

export function getPasswordResetTokenByToken(token: string): PasswordResetToken | null {
	const row = getDb().prepare(`SELECT ${TOKEN_COLUMNS} FROM password_reset_tokens WHERE token = ?`).get(token) as
		| PasswordResetToken
		| undefined;
	return row ?? null;
}

/** Entfernt alle noch nicht eingelösten Reset-Tokens einer E-Mail-Adresse. */
export function deletePasswordResetTokensForIdentifier(identifier: string): void {
	getDb().prepare("DELETE FROM password_reset_tokens WHERE identifier = ?").run(identifier);
}

export function deletePasswordResetTokenByToken(token: string): void {
	getDb().prepare("DELETE FROM password_reset_tokens WHERE token = ?").run(token);
}
