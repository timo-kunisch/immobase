import { getDb } from "./db";
import { boolToInt, intToBool, newId, now } from "./helpers";
import { userDisplayName } from "@/lib/user-name";
import type { Role, User } from "./types";

/**
 * Repository für Benutzerkonten (Tabelle `users`).
 *
 * Besonderheit: `is_approved` ist in SQLite ein integer 0/1 - das Mapping
 * auf den boolean-Typ `User.isApproved` erfolgt ausschließlich hier (siehe
 * Konventions-Kommentar in src/data/types.ts).
 */

const USER_COLUMNS = `
	id, email, first_name AS firstName, last_name AS lastName, password_hash AS passwordHash,
	role, is_approved AS isApproved, email_verified AS emailVerified,
	created_at AS createdAt, updated_at AS updatedAt
`;

/** Zeilenform, wie better-sqlite3 sie liefert (isApproved noch als 0/1). */
type UserRow = Omit<User, "isApproved"> & { isApproved: number };

function mapUserRow(row: UserRow): User {
	return { ...row, isApproved: intToBool(row.isApproved) };
}

export function getUserByEmail(email: string): User | null {
	const row = getDb().prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`).get(email) as UserRow | undefined;
	return row ? mapUserRow(row) : null;
}

export function getUserById(id: string): User | null {
	const row = getDb().prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id) as UserRow | undefined;
	return row ? mapUserRow(row) : null;
}

/** Alle Nutzer, älteste zuerst (Anzeige-Reihenfolge der Admin-Nutzerverwaltung). */
export function listUsers(): User[] {
	const rows = getDb().prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY created_at ASC`).all() as UserRow[];
	return rows.map(mapUserRow);
}

export interface CreateUserInput {
	email: string;
	passwordHash: string;
	role: Role;
	isApproved: boolean;
	/** Optional (NULL = kein Name hinterlegt); Aufrufer normalisieren selbst. */
	firstName?: string | null;
	lastName?: string | null;
}

export function createUser(input: CreateUserInput): User {
	const id = newId();
	const timestamp = now();
	const firstName = input.firstName ?? null;
	const lastName = input.lastName ?? null;
	getDb()
		.prepare(
			`INSERT INTO users (id, email, first_name, last_name, password_hash, role, is_approved, email_verified, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
		)
		.run(id, input.email, firstName, lastName, input.passwordHash, input.role, boolToInt(input.isApproved), timestamp, timestamp);
	return { id, ...input, firstName, lastName, emailVerified: null, createdAt: timestamp, updatedAt: timestamp };
}

/** Setzt/entzieht die Freigabe (isApproved) eines Nutzers. */
export function updateUserApproval(id: string, isApproved: boolean): void {
	getDb()
		.prepare("UPDATE users SET is_approved = ?, updated_at = ? WHERE id = ?")
		.run(boolToInt(isApproved), now(), id);
}

/** Ändert Vor- und Nachname eines Nutzers (NULL/leer = Name entfernen). */
export function updateUserName(id: string, firstName: string | null, lastName: string | null): void {
	getDb()
		.prepare("UPDATE users SET first_name = ?, last_name = ?, updated_at = ? WHERE id = ?")
		.run(firstName, lastName, now(), id);
}

export function updateUserPassword(id: string, passwordHash: string): void {
	getDb().prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(passwordHash, now(), id);
}

/**
 * Markiert die E-Mail-Adresse als bestätigt (email_verified = jetzt).
 * Adressiert über die E-Mail statt der ID, weil der Verifizierungs-Token
 * fachlich an die E-Mail-Adresse gebunden ist (siehe verification_tokens).
 */
export function markEmailVerified(email: string): void {
	const timestamp = now();
	getDb().prepare("UPDATE users SET email_verified = ?, updated_at = ? WHERE email = ?").run(timestamp, timestamp, email);
}

export function countUsers(): number {
	const row = getDb().prepare("SELECT COUNT(*) AS value FROM users").get() as { value: number };
	return row.value;
}

/** E-Mail-Adressen aller Administratoren. */
export function listAdminEmails(): string[] {
	const rows = getDb().prepare("SELECT email FROM users WHERE role = 'ADMIN'").all() as { email: string }[];
	return rows.map((row) => row.email);
}

/**
 * Anzeigenamen je E-Mail-Adresse (z. B. „Max Mustermann"). Dient der
 * Auflösung denormalisierter E-Mail-Snapshots in Anzeige-Tabellen
 * (Aktivitätsprotokoll, Ticket-Verlauf); gelöschte oder umbenannte
 * Konten fehlen hier und fallen in der Anzeige auf die E-Mail zurück.
 */
export function listUserDisplayNameByEmail(): Map<string, string> {
	const rows = getDb()
		.prepare(`SELECT email, first_name AS firstName, last_name AS lastName FROM users`)
		.all() as { email: string; firstName: string | null; lastName: string | null }[];
	return new Map(rows.map((row) => [row.email, userDisplayName(row)]));
}
