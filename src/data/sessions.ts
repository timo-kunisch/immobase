import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { Session } from "./types";

/**
 * Repository für Datenbank-Sessions (Tabelle `sessions`).
 *
 * Nur der Datenzugriff - das Setzen/Löschen des httpOnly-Cookies und die
 * Token-Erzeugung liegen in src/lib/auth/session.ts.
 */

const SESSION_COLUMNS = `
	id, session_token AS sessionToken, user_id AS userId, expires, created_at AS createdAt
`;

export interface CreateSessionInput {
	sessionToken: string;
	userId: string;
	/** Ablaufzeitpunkt als ISO-8601-String. */
	expires: string;
}

export function insertSession(input: CreateSessionInput): Session {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO sessions (id, session_token, user_id, expires, created_at)
			 VALUES (?, ?, ?, ?, ?)`
		)
		.run(id, input.sessionToken, input.userId, input.expires, timestamp);
	return { id, ...input, createdAt: timestamp };
}

export function getSessionByToken(sessionToken: string): Session | null {
	const row = getDb().prepare(`SELECT ${SESSION_COLUMNS} FROM sessions WHERE session_token = ?`).get(sessionToken) as
		| Session
		| undefined;
	return row ?? null;
}

export function deleteSessionById(id: string): void {
	getDb().prepare("DELETE FROM sessions WHERE id = ?").run(id);
}

export function deleteSessionByToken(sessionToken: string): void {
	getDb().prepare("DELETE FROM sessions WHERE session_token = ?").run(sessionToken);
}

/**
 * Löscht ALLE Sessions eines Nutzers (serverseitiger Widerruf, z. B. beim
 * Entzug der Freigabe oder nach einem Passwort-Reset).
 */
export function deleteAllSessionsForUser(userId: string): void {
	getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}
