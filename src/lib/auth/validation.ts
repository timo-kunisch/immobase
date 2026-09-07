/** Minimalistische, dependency-freie Validierung für Auth-Formulare. */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
	return EMAIL_REGEX.test(email);
}

const MIN_PASSWORD_LENGTH = 8;

/** Gibt bei ungültigem Passwort eine Fehlermeldung zurück, sonst null. */
export function validatePassword(password: string): string | null {
	if (password.length < MIN_PASSWORD_LENGTH) {
		return `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`;
	}
	return null;
}

/** Normalisiert eine E-Mail-Adresse für Vergleiche/Speicherung (lowercase, trim). */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}
