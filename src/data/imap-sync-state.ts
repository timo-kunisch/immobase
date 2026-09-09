import { getDb } from "./db";
import { now } from "./helpers";
import type { ImapSyncState } from "./types";

/**
 * Repository für den IMAP-Abgleichstand (Tabelle `imap_sync_state`, ein
 * Datensatz pro Ordner): UIDVALIDITY + zuletzt importierte UID für den
 * inkrementellen Abruf sowie der letzte Sync-Status (Zeitpunkt, Fehler,
 * Anzahl neuer Nachrichten) für die Anzeige im Postfach.
 */

const SYNC_STATE_COLUMNS = `
	folder, uid_validity AS uidValidity, last_uid AS lastUid,
	last_sync_at AS lastSyncAt, last_error AS lastError, last_new_count AS lastNewCount
`;

export function getImapSyncState(folder: string): ImapSyncState | null {
	const row = getDb().prepare(`SELECT ${SYNC_STATE_COLUMNS} FROM imap_sync_state WHERE folder = ?`).get(folder) as ImapSyncState | undefined;
	return row ?? null;
}

export function listImapSyncStates(): ImapSyncState[] {
	return getDb().prepare(`SELECT ${SYNC_STATE_COLUMNS} FROM imap_sync_state ORDER BY folder ASC`).all() as ImapSyncState[];
}

/** Merkt sich den Abgleichstand nach einem (erfolgreichen oder fehlgeschlagenen) Abruf. */
export function upsertImapSyncState(input: {
	folder: string;
	uidValidity: number;
	lastUid: number;
	lastError: string | null;
	lastNewCount: number | null;
}): void {
	getDb()
		.prepare(
			`INSERT INTO imap_sync_state (folder, uid_validity, last_uid, last_sync_at, last_error, last_new_count)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT(folder) DO UPDATE SET
				uid_validity = excluded.uid_validity,
				last_uid = excluded.last_uid,
				last_sync_at = excluded.last_sync_at,
				last_error = excluded.last_error,
				last_new_count = excluded.last_new_count`
		)
		.run(input.folder, input.uidValidity, input.lastUid, now(), input.lastError, input.lastNewCount);
}

/**
 * Setzt den Abgleichstand zurück, wenn der Server die UIDs neu vergeben
 * hat (UIDVALIDITY-Wechsel) - der nächste Abruf importiert den Ordner
 * dann vollständig neu (Dedup über den Unique-Index greift trotzdem).
 */
export function resetImapSyncState(folder: string, uidValidity: number): void {
	getDb()
		.prepare(
			`INSERT INTO imap_sync_state (folder, uid_validity, last_uid, last_sync_at, last_error, last_new_count)
			 VALUES (?, ?, 0, NULL, NULL, NULL)
			 ON CONFLICT(folder) DO UPDATE SET uid_validity = excluded.uid_validity, last_uid = 0`
		)
		.run(folder, uidValidity);
}
