/** Minimalistische, dependency-freie Validierung für Auth-Formulare. */

import type { MessageKey } from "@/lib/i18n/translator";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
	return EMAIL_REGEX.test(email);
}

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Gibt bei ungültigem Passwort den Übersetzungsschlüssel der Fehlermeldung
 * zurück, sonst null. Aufrufer übersetzen mit t(key, { min: MIN_PASSWORD_LENGTH }).
 */
export function validatePassword(password: string): MessageKey | null {
	if (password.length < MIN_PASSWORD_LENGTH) {
		return "auth.errors.passwordTooShort";
	}
	return null;
}

/** Normalisiert eine E-Mail-Adresse für Vergleiche/Speicherung (lowercase, trim). */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}
