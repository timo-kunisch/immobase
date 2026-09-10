/**
 * Namespace "admin" (Deutsch): Admin-Bereich (Nutzerverwaltung,
 * Aktivitätsprotokoll) inkl. der Fehlertexte aus den Server Actions.
 * Die gespeicherten Log-Einträge selbst sind Daten und bleiben Deutsch -
 * hier liegen nur das UI-Gerüst und die Label-Zuordnungen der DB-Werte.
 * Schlüssel-Parität mit Englisch wird per Typ (en-Datei) und
 * src/lib/i18n/messages.test.ts erzwungen.
 */
export const admin = {
	// Nutzerverwaltung (/admin/users)
	"users.title": "Nutzerverwaltung",
	"users.description": "Registrierte Nutzer verwalten und Kontenfreigaben erteilen/entziehen.",
	"users.empty": "Keine Nutzer vorhanden.",
	"users.table.email": "E-Mail",
	"users.table.role": "Rolle",
	"users.table.emailVerified": "E-Mail bestätigt",
	"users.table.registeredAt": "Registriert am",
	"users.table.approved": "Freigegeben",
	"users.currentUser": "(Sie)",
	"users.role.ADMIN": "Admin",
	"users.role.USER": "Nutzer",
	"users.emailVerified.yes": "Ja",
	"users.emailVerified.pending": "Ausstehend",
	"users.approvalSwitchAria": "Freigabe umschalten",
	"users.errors.selfToggle": "Sie können Ihren eigenen Freigabestatus nicht ändern.",
	"users.errors.notFound": "Nutzer nicht gefunden.",
	"users.success.approvedWithoutEmail":
		"Freigabe erteilt. Hinweis: Es ist kein E-Mail-Server konfiguriert (Einstellungen → Integrationen & KI) - der Nutzer wurde nicht per E-Mail benachrichtigt.",

	// Aktivitätsprotokoll (/admin/logs)
	"logs.title": "Aktivitätsprotokoll",
	"logs.description": "Nachvollziehen, welcher Nutzer wann welche Änderungen in der App vorgenommen hat.",
	"logs.filter.user": "Nutzer",
	"logs.filter.allUsers": "Alle Nutzer",
	"logs.filter.category": "Bereich",
	"logs.filter.allCategories": "Alle Bereiche",
	"logs.filter.reset": "Zurücksetzen",
	"logs.empty.filtered": "Keine Einträge für die gewählten Filter.",
	"logs.empty.unfiltered": "Noch keine Aktivitäten protokolliert.",
	"logs.table.time": "Zeitpunkt",
	"logs.table.user": "Nutzer",
	"logs.table.action": "Aktion",
	"logs.table.category": "Bereich",
	"logs.table.description": "Beschreibung",

	// Aktions-Labels (DB-Werte von AuditAction)
	"action.CREATE": "Angelegt",
	"action.UPDATE": "Bearbeitet",
	"action.DELETE": "Gelöscht",
	"action.LOGIN": "Anmeldung",
	"action.LOGOUT": "Abmeldung",

	// Bereichs-Labels (DB-Werte von AuditCategory)
	"category.auth": "Anmeldung",
	"category.liegenschaften": "Liegenschaften",
	"category.einheiten": "Einheiten",
	"category.tickets": "Tickets",
	"category.dokumente": "Dokumente",
	"category.kalender": "Kalender",
	"category.wissen": "Wissensdatenbank",
	"category.mieter": "Mieter",
	"category.vertraege": "Verträge",
	"category.finanzen": "Finanzen",
	"category.abrechnung": "Abrechnung",
	"category.vorlagen": "Vorlagen",
	"category.weg": "WEGs",
	"category.eigentuemer": "Eigentümer",
	"category.eigentumsverhaeltnisse": "Eigentumsverhältnisse",
	"category.verteilerschluessel": "Verteilerschlüssel",
	"category.wirtschaftsplan": "Wirtschaftsplan",
	"category.jahresabrechnung": "Jahresabrechnung (WEG)",
	"category.hausgeld": "Hausgeld",
	"category.ruecklage": "Rücklage",
	"category.versammlungen": "Versammlungen",
	"category.beschluesse": "Beschluss-Sammlung",
	"category.admin": "Nutzerverwaltung",
	"category.einstellungen": "Einstellungen",
	"category.postversand": "Postversand",
	"category.postfach": "Postfach",
	"category.system": "System",
};
