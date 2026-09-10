/**
 * Namespace "calendar" (Deutsch): Kalender-Modul (/kalender) - Monatsraster,
 * manuelle Ereignisse, automatische Termine (Einzug/Auszug, Versammlungen)
 * und der Ereignis-Dialog.
 */
export const calendar = {
	title: "Kalender",
	description: "Manuelle Ereignisse und automatische Termine (Einzug/Auszug, Versammlungen).",
	// Blättern-Navigation + Anlegen-Button
	"actions.prevMonth": "Vorheriger Monat",
	"actions.nextMonth": "Nächster Monat",
	"actions.new": "Neues Ereignis",
	// Legende der Termin-Arten (Farbpunkte unter dem Monatsraster)
	"kind.MANUAL": "Eigenes Ereignis (bearbeitbar per Klick)",
	"kind.LEASE_START": "Einzug (Mietbeginn)",
	"kind.LEASE_END": "Auszug (Mietende)",
	"kind.MEETING": "Eigentümerversammlung",
	// Titel-Präfixe der automatischen Termine (src/lib/calendar.ts, labels-Parameter)
	"labels.leaseStart": "Einzug",
	"labels.leaseEnd": "Auszug",
	"labels.meeting": "Versammlung",
	// Ereignis-Dialog (Anlegen/Bearbeiten)
	"dialog.newTitle": "Neues Ereignis",
	"dialog.editTitle": "Ereignis bearbeiten",
	"dialog.description": "Manuellen Termin im Kalender eintragen (z. B. Wartung, Abnahme, Behördentermin).",
	"fields.title": "Titel *",
	"fields.titlePlaceholder": "z. B. Heizungswartung",
	"fields.startDate": "Datum *",
	"fields.endDate": "Enddatum (optional)",
	"fields.startTime": "Startuhrzeit (optional)",
	"fields.endTime": "Enduhrzeit (optional)",
	"fields.descriptionPlaceholder": "Details zum Termin…",
	"confirm.delete": "Ereignis \"{title}\" wirklich löschen?",
	// Server Actions (Fehlermeldungen)
	"errors.titleAndStartRequired": "Bitte vergeben Sie einen Titel und ein Startdatum.",
	"errors.endBeforeStart": "Das Enddatum darf nicht vor dem Startdatum liegen.",
	"errors.timeInvalid": "Bitte geben Sie die Uhrzeiten im Format HH:MM an.",
	"errors.endTimeRequiresStart": "Eine Enduhrzeit erfordert eine Startuhrzeit.",
	"errors.endTimeBeforeStartTime": "Die Enduhrzeit darf nicht vor der Startuhrzeit liegen (am selben Tag).",
	"errors.saveFailed": "Das Ereignis konnte nicht gespeichert werden.",
	"errors.deleteFailed": "Das Ereignis konnte nicht gelöscht werden.",
};
