import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { AuditAction, AuditCategory, AuditLogEntry } from "./types";

/**
 * Repository für das Aktivitätsprotokoll (Tabelle `audit_log_entries`).
 *
 * Append-only: Es gibt bewusst keine Update-/Delete-Funktionen - das Log
 * soll eine lückenlose Historie abbilden. Geschrieben wird über den
 * Helfer `logActivity()` (src/lib/audit.ts) aus den Server Actions heraus;
 * gelesen nur von der Admin-Seite /admin/logs.
 */

const AUDIT_LOG_COLUMNS = `
	id, user_id AS userId, user_email AS userEmail, action, category,
	description, entity_id AS entityId, created_at AS createdAt
`;

export interface CreateAuditLogEntryInput {
	userId: string | null;
	userEmail: string;
	action: AuditAction;
	category: AuditCategory;
	description: string;
	entityId?: string | null;
}

export function createAuditLogEntry(input: CreateAuditLogEntryInput): AuditLogEntry {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO audit_log_entries (id, user_id, user_email, action, category, description, entity_id, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.userId, input.userEmail, input.action, input.category, input.description, input.entityId ?? null, timestamp);
	return { id, ...input, entityId: input.entityId ?? null, createdAt: timestamp };
}

/** Filter für die Admin-Übersicht (alle Kriterien optional, UND-verknüpft). */
export interface AuditLogFilter {
	userId?: string;
	/** Filter nach dem denormalisierten E-Mail-Snapshot (Admin-UI, URL-Param `?user=`). */
	userEmail?: string;
	category?: AuditCategory;
}

function buildFilterWhere(filter: AuditLogFilter): { where: string; params: string[] } {
	const conditions: string[] = [];
	const params: string[] = [];
	if (filter.userId) {
		conditions.push("user_id = ?");
		params.push(filter.userId);
	}
	if (filter.userEmail) {
		conditions.push("user_email = ?");
		params.push(filter.userEmail);
	}
	if (filter.category) {
		conditions.push("category = ?");
		params.push(filter.category);
	}
	return { where: conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "", params };
}

/**
 * Eine Seite der Log-Einträge, neueste zuerst. Tie-Breaker ist die implizite
 * SQLite-ROWID (spiegelt die Einfügereihenfolge wider), damit die Sortierung
 * auch bei Einträgen innerhalb derselben Millisekunde (gleicher created_at-
 * Zeitstempel, z. B. Bulk-Operationen) deterministisch bleibt.
 */
export function listAuditLogEntriesPage(filter: AuditLogFilter, limit: number, offset: number): AuditLogEntry[] {
	const { where, params } = buildFilterWhere(filter);
	return getDb()
		.prepare(`SELECT ${AUDIT_LOG_COLUMNS} FROM audit_log_entries${where} ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`)
		.all(...params, limit, offset) as AuditLogEntry[];
}

/**
 * Alle Log-Einträge, neueste zuerst (gleiche Sortierung wie
 * listAuditLogEntriesPage). Basis für die clientseitige Sortierung,
 * Filterung und Pagination der Admin-Übersicht.
 */
export function listAuditLogEntries(filter: AuditLogFilter = {}): AuditLogEntry[] {
	const { where, params } = buildFilterWhere(filter);
	return getDb()
		.prepare(`SELECT ${AUDIT_LOG_COLUMNS} FROM audit_log_entries${where} ORDER BY created_at DESC, rowid DESC`)
		.all(...params) as AuditLogEntry[];
}

export function countAuditLogEntries(filter: AuditLogFilter = {}): number {
	const { where, params } = buildFilterWhere(filter);
	const row = getDb().prepare(`SELECT COUNT(*) AS value FROM audit_log_entries${where}`).get(...params) as { value: number };
	return row.value;
}

/** Alle tatsächlich vorkommenden Kategorien (für das Filter-Dropdown). */
export function listAuditLogCategories(): AuditCategory[] {
	const rows = getDb().prepare("SELECT DISTINCT category FROM audit_log_entries ORDER BY category ASC").all() as {
		category: AuditCategory;
	}[];
	return rows.map((row) => row.category);
}

/**
 * Alle tatsächlich vorkommenden Nutzer-E-Mail-Snapshots (für das Filter-
 * Dropdown der Admin-Seite; enthält auch bereits gelöschte Konten).
 */
export function listAuditLogUserEmails(): string[] {
	const rows = getDb().prepare("SELECT DISTINCT user_email FROM audit_log_entries ORDER BY user_email ASC").all() as {
		user_email: string;
	}[];
	return rows.map((row) => row.user_email);
}
