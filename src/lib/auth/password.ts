import bcrypt from "bcryptjs";

// 12 Runden ist ein gängiger, sicherer Standardwert (Kompromiss aus
// Sicherheit vs. Server-Last) für bcrypt/bcryptjs.
const SALT_ROUNDS = 12;

/** Hasht ein Klartext-Passwort für die Speicherung in der Datenbank. */
export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, SALT_ROUNDS);
}

// Fixer Dummy-Hash (Passwort "not-a-real-password"), gegen den wir auch
// dann vergleichen, wenn kein Nutzer mit der eingegebenen E-Mail existiert.
// So dauert eine Login-Anfrage für "unbekannte E-Mail" und "falsches
// Passwort" ungefähr gleich lang (Schutz gegen Timing-Angriffe, die sonst
// verraten könnten, ob eine E-Mail-Adresse registriert ist).
const DUMMY_HASH = "$2a$12$K8n0X9j3z1q1c1c1c1c1cO7z8y9x0w1v2u3t4s5r6q7p8o9n0m1k2";

export async function verifyPasswordTimingSafe(password: string, hash: string | null | undefined): Promise<boolean> {
	return bcrypt.compare(password, hash ?? DUMMY_HASH);
}
