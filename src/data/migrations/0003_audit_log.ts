import type { Migration } from "../migrate.ts";

/**
 * 0003_audit_log - Aktivitätsprotokoll (Audit Log): Nachvollziehbarkeit,
 * welcher Nutzer wann was in der App geändert hat. Einsicht nur für
 * Administratoren (/admin/logs).
 *
 * `user_email` wird bewusst denormalisiert mitgeschrieben, damit Einträge
 * auch nach einer (manuellen) Löschung des Nutzerkontos lesbar bleiben -
 * der Fremdschlüssel ist daher ON DELETE SET NULL. `category` ist ein
 * stabiler Modul-Schlüssel (Filter in der UI), `description` der fertig
 * formulierte deutsche Satz (wird am Aufrufort gebaut, weil nur dort die
 * fachlichen Bezeichnungen - z. B. Mietername - bekannt sind).
 *
 * Es gibt bewusst keinen Updated-Zeitstempel und keine Update-/Delete-
 * Operationen im Repository: Log-Einträge sind append-only.
 */
export const migration0003: Migration = {
	version: 3,
	name: "audit_log",
	up: `
CREATE TABLE audit_log_entries (
	id text PRIMARY KEY NOT NULL,
	user_id text,
	user_email text NOT NULL,
	action text NOT NULL,
	category text NOT NULL,
	description text NOT NULL,
	entity_id text,
	created_at text NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE set null
);
CREATE INDEX audit_log_entries_created_at_idx ON audit_log_entries (created_at DESC);
CREATE INDEX audit_log_entries_user_id_idx ON audit_log_entries (user_id);
CREATE INDEX audit_log_entries_category_idx ON audit_log_entries (category);
`,
	down: `
DROP TABLE IF EXISTS audit_log_entries;
`,
};
