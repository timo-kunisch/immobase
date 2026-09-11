import type { Migration } from "../migrate.ts";

/**
 * Papierkorb für Dokumente: Gelöschte hochgeladene DMS-Dokumente
 * (`documents`) und erzeugte Vorlagen-Schreiben (`generated_documents`)
 * werden nicht mehr sofort endgültig entfernt, sondern per `deleted_at`
 * in den Papierkorb verschoben (NULL = aktiv). Nach 28 Tagen werden sie
 * automatisch endgültig gelöscht (Scheduler in src/lib/document-trash.ts);
 * bis dahin können sie wiederhergestellt werden.
 *
 * Die Dateien in der Ablage bleiben beim Verschieben unangetastet und
 * werden erst bei der endgültigen Löschung (automatisch nach Ablauf der
 * Aufbewahrungsfrist oder manuell aus dem Papierkorb) entfernt.
 *
 * Die Spalte ist nicht Teil von Indizes, Constraints oder Fremdschlüsseln
 * - daher genügt ein einfaches ADD/DROP COLUMN (Muster wie 0018). Beim
 * Down landen im Papierkorb liegende Dokumente wieder aktiv in der
 * normalen Ansicht (Downgrade-Verlust, bewusst akzeptiert).
 */
export const migration0019: Migration = {
	version: 19,
	name: "documents_trash",
	up: `
		ALTER TABLE documents ADD COLUMN deleted_at text;
		ALTER TABLE generated_documents ADD COLUMN deleted_at text;
	`,
	down: `
		ALTER TABLE documents DROP COLUMN deleted_at;
		ALTER TABLE generated_documents DROP COLUMN deleted_at;
	`,
};
